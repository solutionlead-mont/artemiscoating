/* =========================================================
   Artemis Coating — insère le menu et le pied de page partagés.
   Utilisation dans une page :
     <div data-include="partials/header.html"></div>
     <div data-include="partials/footer.html"></div>
   Les chemins sont résolus depuis la racine du site (le dossier
   qui contient js/), donc ça marche aussi pour des pages placées
   dans des sous-dossiers.
   À ouvrir via un serveur (Live Server, hébergeur…), pas en double-cliquant.
   ========================================================= */
(function () {
  'use strict';
  var me = document.currentScript && document.currentScript.src;
  var root = me ? me.replace(/js\/include\.js(\?.*)?$/, '') : '';

  function done() {
    var page = document.body.getAttribute('data-page');
    if (page) document.querySelectorAll('[data-nav="' + page + '"]').forEach(function (a) {
      a.setAttribute('aria-current', 'page'); a.classList.add('is-current');
    });
    window.__partialsLoaded = true;
    document.dispatchEvent(new Event('partials:loaded'));
  }

  function load() {
    var slots = Array.prototype.slice.call(document.querySelectorAll('[data-include]'));
    if (!slots.length) return done();
    Promise.all(slots.map(function (el) {
      var path = el.getAttribute('data-include');
      var url = /^(https?:)?\/\//.test(path) || path.charAt(0) === '/' ? path : root + path;
      return fetch(url, { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + url); return r.text(); })
        .then(function (html) {
          // Retire un éventuel script injecté par un serveur de développement
          html = html.replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/i, '');
          el.outerHTML = html;
        })
        .catch(function (err) {
          console.error('[Artemis] Inclusion impossible :', err);
          el.innerHTML = '<p style="margin:0;padding:16px;background:#5a1d1d;color:#fff;font:14px sans-serif">' +
            'Impossible de charger « ' + path + ' ». Vérifiez que le dossier partials/ est à côté de index.html ' +
            'et que le site est ouvert via un serveur.</p>';
        });
    })).then(done, done);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
