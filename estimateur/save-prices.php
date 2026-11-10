<?php
/* =========================================================
   Artemis Coating — enregistrement local des tarifs (WAMP/PHP).

   Permet à estimateur/admin.html d'écrire DIRECTEMENT dans
   estimateur/prices.json, sans fenêtre « Enregistrer sous »,
   lorsque le site est servi par WAMP (Apache + PHP).

   Utilisation : ouvrez simplement l'admin via WAMP :
     http://localhost/artemis-site/estimateur/admin.html

   Sécurité :
   - n'accepte que les requêtes provenant de la machine locale ;
   - vérifie que le JSON contient « basePricing » et « surcharges » ;
   - conserve une copie de l'ancien fichier dans prices.backup.json ;
   - écriture atomique via un fichier .tmp puis renommage.

   API :
     GET  save-prices.php?status=1  → état du service
     POST save-prices.php           → écrit prices.json
   ========================================================= */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$target = __DIR__ . DIRECTORY_SEPARATOR . 'prices.json';
$backup = __DIR__ . DIRECTORY_SEPARATOR . 'prices.backup.json';

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$remote = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
$isLocal = in_array($remote, array('127.0.0.1', '::1', '::ffff:127.0.0.1'), true);
if (!$isLocal) {
    respond(403, array('ok' => false, 'error' => 'Enregistrement autorisé uniquement en local.'));
}

$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET';

if ($method === 'GET') {
    respond(200, array(
        'ok' => true,
        'service' => 'artemis-php-save',
        'target' => 'estimateur/prices.json',
        'exists' => is_file($target),
        'writable' => is_writable(__DIR__)
    ));
}

if ($method !== 'POST') {
    header('Allow: GET, POST');
    respond(405, array('ok' => false, 'error' => 'Méthode non autorisée.'));
}

$type = isset($_SERVER['CONTENT_TYPE']) ? (string) $_SERVER['CONTENT_TYPE'] : '';
if (stripos($type, 'application/json') !== 0) {
    respond(415, array('ok' => false, 'error' => 'Content-Type application/json attendu.'));
}

$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') {
    respond(400, array('ok' => false, 'error' => 'Corps de requête vide.'));
}
if (strlen($raw) > 5 * 1024 * 1024) {
    respond(413, array('ok' => false, 'error' => 'Corps trop volumineux (max 5 Mo).'));
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    respond(400, array('ok' => false, 'error' => 'JSON invalide : ' . json_last_error_msg()));
}
if (!isset($data['basePricing']) || !is_array($data['basePricing'])) {
    respond(400, array('ok' => false, 'error' => 'La propriété « basePricing » est manquante.'));
}
if (!isset($data['surcharges']) || !is_array($data['surcharges'])) {
    respond(400, array('ok' => false, 'error' => 'La propriété « surcharges » est manquante.'));
}

/* On réécrit le JSON reçu tel quel (déjà indenté par l'admin),
   avec un saut de ligne final, pour garder un diff lisible. */
$json = rtrim($raw) . "\n";

if (!is_writable(__DIR__)) {
    respond(500, array('ok' => false, 'error' => 'Le dossier estimateur n\'est pas accessible en écriture.'));
}

if (is_file($target)) {
    if (!@copy($target, $backup)) {
        respond(500, array('ok' => false, 'error' => 'Sauvegarde de l\'ancien fichier impossible.'));
    }
}

$tmp = $target . '.tmp';
if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
    respond(500, array('ok' => false, 'error' => 'Écriture du fichier temporaire impossible.'));
}
if (!@rename($tmp, $target)) {
    @unlink($tmp);
    respond(500, array('ok' => false, 'error' => 'Remplacement de prices.json impossible.'));
}

respond(200, array(
    'ok' => true,
    'service' => 'artemis-php-save',
    'file' => 'estimateur/prices.json',
    'backup' => 'estimateur/prices.backup.json',
    'bytes' => strlen($json),
    'updatedAt' => isset($data['updatedAt']) ? $data['updatedAt'] : null
));
