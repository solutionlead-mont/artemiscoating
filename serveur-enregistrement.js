#!/usr/bin/env node
/* =========================================================
   Artemis Coating — serveur local (site + enregistrement des tarifs).

   Rôle :
   - sert le site (HTML, CSS, JS, images, vidéo…) ;
   - permet à estimateur/admin.html d'écrire DIRECTEMENT dans
     estimateur/prices.json, sans fenêtre « Enregistrer sous ».

   Utilisation :
     node serveur-enregistrement.js
   ou double-cliquez sur Demarrer-le-site.bat.

   Puis ouvrez :  http://127.0.0.1:8090/
   Admin       :  http://127.0.0.1:8090/estimateur/admin.html

   Le serveur écoute uniquement sur 127.0.0.1 (votre machine).
   Laissez sa fenêtre ouverte pendant que vous modifiez les prix.

   API :
     GET  /api/prices/status  → indique si le fichier existe
     POST /api/prices         → écrit le JSON reçu dans prices.json
   ========================================================= */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = Number(process.env.ARTEMIS_SAVE_PORT || 8090);
var HOST = '127.0.0.1';
var ROOT = __dirname;
var TARGET = path.join(ROOT, 'estimateur', 'prices.json');
var BACKUP = path.join(ROOT, 'estimateur', 'prices.backup.json');
var MAX_BODY = 5 * 1024 * 1024; // 5 Mo

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8'
};

function isAllowedOrigin(origin) {
  if (!origin) return true; // requête locale (curl, script)
  try {
    var host = new URL(origin).hostname;
    return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1';
  } catch (e) {
    return false;
  }
}

function corsHeaders(req) {
  var origin = req.headers.origin;
  var headers = { Vary: 'Origin' };
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, HEAD, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '600';
  }
  return headers;
}

function sendJSON(req, res, status, payload) {
  var body = JSON.stringify(payload);
  var headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  }, corsHeaders(req));
  res.writeHead(status, headers);
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var size = 0;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Corps trop volumineux (max 5 Mo).'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Le JSON doit être un objet.';
  }
  if (!data.basePricing || typeof data.basePricing !== 'object') {
    return 'La propriété « basePricing » est manquante.';
  }
  if (!data.surcharges || typeof data.surcharges !== 'object') {
    return 'La propriété « surcharges » est manquante.';
  }
  return null;
}

function notFound(res, route) {
  var body = '404 — ' + route;
  res.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendFile(req, res, filePath, stat) {
  var ext = path.extname(filePath).toLowerCase();
  var type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': 'no-store'
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  var stream = fs.createReadStream(filePath);
  stream.on('error', function () { res.destroy(); });
  stream.pipe(res);
}

function serveStatic(req, res, route) {
  var urlPath;
  try {
    urlPath = decodeURIComponent(route);
  } catch (e) {
    res.writeHead(400);
    res.end('Requête invalide');
    return;
  }

  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  var resolved = path.resolve(path.join(ROOT, urlPath));
  if (resolved !== ROOT && resolved.indexOf(ROOT + path.sep) !== 0) {
    res.writeHead(403);
    res.end('Accès interdit');
    return;
  }

  fs.stat(resolved, function (err, stat) {
    if (!err && stat.isDirectory()) {
      var index = path.join(resolved, 'index.html');
      fs.stat(index, function (err2, stat2) {
        if (err2 || !stat2.isFile()) { notFound(res, route); return; }
        sendFile(req, res, index, stat2);
      });
      return;
    }
    if (err || !stat.isFile()) { notFound(res, route); return; }
    sendFile(req, res, resolved, stat);
  });
}

var server = http.createServer(function (req, res) {
  var route = (req.url || '').split('?')[0];

  if (req.method === 'OPTIONS') {
    if (!isAllowedOrigin(req.headers.origin)) {
      res.writeHead(403);
      res.end();
      return;
    }
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  if (route === '/api/prices/status' && req.method === 'GET') {
    sendJSON(req, res, 200, {
      ok: true,
      service: 'artemis-save-server',
      target: TARGET,
      exists: fs.existsSync(TARGET)
    });
    return;
  }

  if ((route === '/api/prices' || route === '/api/prices/') && req.method === 'POST') {
    if (!isAllowedOrigin(req.headers.origin)) {
      sendJSON(req, res, 403, { ok: false, error: 'Origine non autorisée.' });
      return;
    }
    var contentType = String(req.headers['content-type'] || '');
    if (contentType.indexOf('application/json') !== 0) {
      sendJSON(req, res, 415, { ok: false, error: 'Content-Type application/json attendu.' });
      return;
    }

    readBody(req).then(function (text) {
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        sendJSON(req, res, 400, { ok: false, error: 'JSON invalide : ' + e.message });
        return;
      }

      var problem = validate(data);
      if (problem) {
        sendJSON(req, res, 400, { ok: false, error: problem });
        return;
      }

      var json = JSON.stringify(data, null, 2) + '\n';
      try {
        fs.mkdirSync(path.dirname(TARGET), { recursive: true });
        if (fs.existsSync(TARGET)) fs.copyFileSync(TARGET, BACKUP);
        var tmp = TARGET + '.tmp';
        fs.writeFileSync(tmp, json, 'utf8');
        fs.renameSync(tmp, TARGET);
      } catch (e) {
        sendJSON(req, res, 500, { ok: false, error: 'Écriture impossible : ' + e.message });
        return;
      }

      console.log('[' + new Date().toLocaleTimeString('fr-FR') + '] prices.json enregistré (' + Buffer.byteLength(json) + ' octets)');
      sendJSON(req, res, 200, {
        ok: true,
        file: 'estimateur/prices.json',
        backup: 'estimateur/prices.backup.json',
        bytes: Buffer.byteLength(json),
        updatedAt: data.updatedAt || null
      });
    }).catch(function (err) {
      sendJSON(req, res, 413, { ok: false, error: err.message });
    });
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res, route);
    return;
  }

  sendJSON(req, res, 405, { ok: false, error: 'Méthode non autorisée.' });
});

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('  Le port ' + PORT + ' est déjà utilisé.');
    console.error('  Fermez l\'autre programme, ou lancez avec un autre port :');
    console.error('    set ARTEMIS_SAVE_PORT=8091 && node serveur-enregistrement.js');
    console.error('');
  } else {
    console.error('  Erreur du serveur : ' + err.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, function () {
  console.log('');
  console.log('  Artemis Coating — serveur local');
  console.log('  ------------------------------------------------------');
  console.log('  Site       : http://' + HOST + ':' + PORT + '/');
  console.log('  Admin      : http://' + HOST + ':' + PORT + '/estimateur/admin.html');
  console.log('  Fichier    : ' + TARGET);
  console.log('  Sauvegarde : ' + BACKUP);
  console.log('');
  console.log('  Ouvrez l\'admin, modifiez les prix, cliquez sur');
  console.log('  « Enregistrer dans prices.json ».');
  console.log('  Aucune fenêtre « Enregistrer sous » ne s\'affichera.');
  console.log('');
  console.log('  Ctrl+C ou fermez cette fenêtre pour arrêter.');
  console.log('');
});

process.on('SIGINT', function () {
  console.log('');
  console.log('  Serveur arrêté.');
  process.exit(0);
});
