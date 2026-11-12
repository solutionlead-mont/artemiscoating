# Artemis Coating — page d'accueil (HTML)

## Deux façons d'utiliser le site

### 1. Fichier unique (pour voir la page tout de suite)
`artemis-accueil-complet.html` contient **tout** dans un seul fichier : le menu, la page, le pied de page, les styles, les scripts, les images et la vidéo.
Double-cliquez dessus et il s'ouvre dans votre navigateur. Pas besoin de serveur.

### 2. Version modulaire (pour construire le site)
Le menu et le pied de page sont écrits **une seule fois**, puis insérés automatiquement dans chaque page :

```
artemis-site/
├── index.html              ← la page d'accueil
├── produits.html           ← boutique (catalogue Shopify en direct)
├── produit.html            ← fiche produit (image, variantes, quantité, ajout au panier)
├── panier.html             ← page du panier
├── gabarit-page.html       ← modèle à copier pour créer les autres pages
├── partials/
│   ├── header.txt          ← menu (navigation avec méga-menu, menu mobile)
│   └── footer.txt          ← pied de page
├── css/style.css           ← tous les styles
├── css/cart.css            ← styles de la page panier
├── css/boutique.css        ← styles du catalogue produits
├── css/produit.css         ← styles de la fiche produit
├── css/responsive-pages.css ← correctifs responsive des pages de contenu
├── js/include.js           ← le script qui insère le menu et le pied de page
├── js/shopify.js           ← Storefront API Shopify (catalogue + paiement)
├── js/produit.js           ← logique de la fiche produit (variantes, galerie, quantité)
├── js/main.js              ← menus déroulants, barre collante, menu mobile, formulaire, panier
├── estimateur.html         ← estimateur de prix
├── estimateur/prices.json  ← tarifs de l'estimateur
├── estimateur/admin.html   ← édition des tarifs
├── estimateur/save-prices.php ← enregistrement direct via WAMP/PHP (local)
├── serveur-enregistrement.js ← serveur local Node (site + sauvegarde directe des tarifs)
├── Demarrer-le-site.bat    ← lance le serveur local Node (Windows)
└── assets/                 ← images et vidéo
```

Dans chaque page, deux lignes suffisent pour afficher le menu et le pied de page :

```html
<div data-include="partials/header.html"></div>
  … contenu de la page …
<div data-include="partials/footer.html"></div>

<script src="js/include.js"></script>
<script src="js/main.js"></script>
```

**Important :** cette version charge les fichiers avec `fetch()`. Elle doit donc être ouverte **via un serveur** et non en double-cliquant. Par exemple :

- **WAMP (recommandé si vous l'utilisez déjà)** : copiez le dossier du site dans `C:\wamp64\www\artemis-site`, démarrez WAMP (icône verte), puis ouvrez http://localhost/artemis-site/. L'admin y enregistre les tarifs directement grâce à `estimateur/save-prices.php`.
- **Serveur local fourni (Node.js)** : double-cliquez sur `Demarrer-le-site.bat` (ou lancez `node serveur-enregistrement.js`), puis ouvrez http://127.0.0.1:8090/. Ce serveur sert aussi à enregistrer les tarifs directement depuis l'admin, sans WAMP.
- **VS Code** : installez l'extension « Live Server », faites un clic droit sur `index.html` puis choisissez « Open with Live Server » (mais l'enregistrement direct des tarifs n'y fonctionne pas : utilisez WAMP ou le serveur fourni).
- **Terminal** : ouvrez le dossier `artemis-site` puis lancez `python -m http.server 8000`, et allez sur http://localhost:8000.
- **En ligne** : tout hébergeur web normal fonctionne tel quel.

**Pourquoi les partials sont en `.txt` :** Live Server (VS Code) injecte son script de rechargement automatique dans tous les fichiers `.html`, y compris les fragments. Comme `header` et `footer` ne sont pas des pages complètes (pas de `<body>`), cette injection les corrompt et le menu ne s'affiche plus. Les stocker en `.txt` évite l'injection. `js/include.js` convertit automatiquement `partials/header.html` → `partials/header.txt` (avec repli sur le `.html` si besoin), donc les pages gardent leurs attributs `data-include="partials/header.html"` et `data-include="partials/footer.html"` sans modification.

## Créer une nouvelle page
1. Copiez `gabarit-page.html` et renommez la copie, par exemple `contact.html`.
2. Changez le `<title>`, le titre et `data-page="contact"` sur la balise `<body>`. Le lien correspondant s'allume alors en or dans le menu.
3. Ajoutez votre contenu entre `<main>` et `</main>`.

## Responsive (mobile, tablette, ordinateur)

L'accueil (`index.html`) et l'estimateur (`estimateur.html`) ont leurs propres styles responsive dans `css/style.css`.

Les autres pages (`a-propos.html`, `contact.html`, `formation-epoxy-a-z.html`, `Installation-Commerciale.html`, `Installation-industrielle.html`, `Installation-residentielle.html`, `produits.html`, `services-installation.html`) viennent d'un design à largeur fixe (1440 px) avec beaucoup de styles inline. Elles chargent en plus `css/responsive-pages.css`, qui adapte uniquement le contenu de `<main id="contenu">` :

- à partir de 1439 px et moins : les conteneurs figés à 1440 px s'adaptent à l'écran ;
- à partir de 1100 px et moins : les grilles passent en une colonne, les titres et les marges deviennent fluides ;
- à partir de 640 px et moins : les textes longs peuvent se couper et les blocs visuels s'ajustent.

Le menu et le pied de page ne sont pas modifiés par cette feuille.

La page `panier.html` a sa propre feuille `css/cart.css` : sous 900 px, la liste et le résumé passent en une seule colonne et le résumé n'est plus collant ; sous 560 px, les vignettes et les titres réduisent pour rester lisibles sur téléphone.

## Boutique Shopify (produits, panier et paiement)

La boutique est branchée sur **Shopify Storefront API** : le catalogue est lu en direct dans Shopify, et le bouton de paiement crée un panier Shopify (`cartCreate`) puis redirige vers le paiement sécurisé Shopify.

### Fichiers concernés

- `produits.html` : grille de produits rendue par `js/shopify.js` (recherche, filtres, tri, variantes). Un clic sur l'image ou le titre ouvre la fiche du produit.
- `produit.html` : fiche produit rendue par `js/produit.js` à partir du paramètre `?handle=…` (grande image, galerie, variantes, prix, quantité, ajout au panier, description, caractéristiques, produits similaires).
- `panier.html` : panier local, résumé, bouton « Passer à la caisse ».
- `js/shopify.js` : configuration, requête GraphQL du catalogue, rendu des cartes, création du panier Shopify.
- `js/produit.js` : requête `product(handle:)`, variantes, galerie, prix, description, produits similaires.
- `js/main.js` : panier `localStorage`, ajout d'articles, interception du bouton de paiement.
- `css/boutique.css` : styles du catalogue.
- `css/produit.css` : styles de la fiche produit.

### Brancher la boutique (une seule fois)

> **Boutique actuelle :** `kqa3nt-0d.myshopify.com`. Le jeton public est déjà inscrit dans `js/shopify.js`. Le produit **Signature 401** est en ligne et visible sur le site. Ajoutez les autres produits dans Shopify et publiez-les sur le canal « Boutique en ligne » pour qu'ils apparaissent automatiquement.

1. Dans Shopify : **Paramètres → Applications et canaux de vente → Développer des applications → Créer une application**.
2. Ouvrez **Configurer l'API Storefront**, cochez les scopes :
   - `unauthenticated_read_product_listings` (lire les produits) ;
   - `unauthenticated_write_checkouts` (créer le panier et le paiement).
3. Enregistrez, puis copiez le **jeton public** « Storefront API access token ».
4. Dans `js/shopify.js`, remplissez les deux premières valeurs de `CONFIG` :

```js
var CONFIG = Object.assign({
  domain: 'votre-boutique.myshopify.com',
  storefrontToken: 'jeton-public-storefront',
  apiVersion: '2026-07',
  locale: 'fr-CA',
  currency: 'CAD'
}, window.ARTEMIS_SHOPIFY || {});
```

5. Dans la configuration de l'application Shopify, autorisez les domaines du site : `localhost`, `127.0.0.1`, le domaine Cloudflare Pages (`*.pages.dev`) et le domaine final.
6. Rechargez `produits.html` : les produits apparaissent.

**Tant que `domain` et `storefrontToken` sont vides**, la page produits affiche le message « Boutique en ligne bientôt disponible » et le panier renvoie vers `contact.html` (« Demander une soumission »). Aucune erreur n'est visible pour le visiteur.

### Fiche produit

- L'adresse est `produit.html?handle=HANDLE` (ex. `produit.html?handle=signature-401`). Le lien est posé sur l'image et le titre de chaque carte du catalogue.
- La page interroge la Storefront API (`product(handle:)`) et affiche : galerie, prix, variantes, quantité, stock, description Shopify, caractéristiques, livraison/retours et produits similaires.
- Le bouton « Ajouter au panier » utilise le même mécanisme que le catalogue (`data-variant-id`, `data-price`, `data-qty`) ; la quantité choisie est respectée dans le panier.
- Si le produit n'existe pas ou n'est plus publié, la page affiche un état « Produit introuvable » avec un retour vers le catalogue.

### Fonctionnement du panier

- Sur `produits.html`, chaque carte affiche l'image, le titre et le prix, et toute la carte ouvre la fiche produit. Le choix de la variante et l'ajout au panier se font sur la fiche.
- Les articles sont conservés dans le `localStorage` sous la clé **`artemis-cart-v1`** (`variantId`, `variantTitle`, `price`, `currency`, `qty`).
- Le bouton « Passer à la caisse » crée le panier Shopify avec `cartCreate`, puis redirige vers `checkoutUrl`. En cas d'échec (jeton sans droit d'écriture, réseau), le script utilise le **lien panier Shopify** classique (`https://boutique.myshopify.com/cart/ID_VARIANTE:QUANTITÉ`).
- Les taxes et la livraison sont calculées par Shopify **à l'étape du paiement** ; le panier local affiche seulement le sous-total.
- Pour repartir de zéro : `localStorage.removeItem('artemis-cart-v1')` dans la console, puis rechargez.

### Mode sans Shopify

Si la boutique n'est pas configurée (ou si l'API est indisponible), tout le site continue de fonctionner : la page produits affiche un message d'attente avec un lien vers `contact.html`, et le panier propose « Demander une soumission ».

## Estimateur et gestion des prix

L'estimateur se trouve dans `estimateur.html` (à la racine, lien depuis la page d'accueil). Il lit ses tarifs dans `estimateur/prices.json`.

- L'estimateur est un **parcours unique** : les sections s'affichent l'une sous l'autre au fur et à mesure (Projet → Type de plancher → Superficie → **Coordonnées** → Qualité → Contact), sans bouton Retour. Les coordonnées (prénom + courriel, avec une mention au lieu d'une case de consentement) sont demandées **au milieu du parcours, juste avant le choix de la qualité**, pour que le prix apparaisse immédiatement après. Le prix se calcule dans la carte de droite (au-dessus sur mobile), sans verrou ni flou.
- Trois types d'installation : **résidentiel, commercial et industriel**. La surcharge `industrial` se règle dans `prices.json` (section « surcharges ») et apparaît dans l'admin.
- Les styles de l'estimateur sont dans `css/style.css`, sous la classe `.fe-estimator`. Un bloc d'isolation à la fin de `style.css` annule les styles globaux du site **à l'intérieur de l'estimateur uniquement** (le reste du site n'est pas affecté).
- Pour modifier les prix : ouvrez `estimateur/admin.html`, changez les valeurs, puis cliquez sur **Enregistrer dans prices.json**.
  - **Avec WAMP (recommandé si WAMP est déjà installé) :** ouvrez `http://localhost/artemis-site/estimateur/admin.html`. Le bandeau affiche « ✓ Enregistrement direct actif (WAMP/PHP) » et **Enregistrer** écrit directement dans `estimateur/prices.json`, sans fenêtre. Une copie de l'ancien fichier est conservée dans `estimateur/prices.backup.json`. Le fichier `estimateur/save-prices.php` assure l'écriture (réservée aux requêtes locales).
  - **Avec le serveur fourni (Node.js) :** double-cliquez sur `Demarrer-le-site.bat` (ou lancez `node serveur-enregistrement.js`), puis ouvrez `http://127.0.0.1:8090/estimateur/admin.html`. Même résultat, sans WAMP.
  - **Sans serveur d'enregistrement, dans Chrome ou Edge :** au clic sur **Enregistrer**, le navigateur demande une fois où sauvegarder ; choisissez `estimateur/prices.json` et confirmez le remplacement. Le fichier choisi reste utilisé pour les enregistrements suivants tant que la page reste ouverte (après un rechargement, il redemande le fichier).
  - **Autres navigateurs, ou si l'enregistrement direct est indisponible :** cliquez sur **Télécharger une copie**, remplacez `estimateur/prices.json` par le fichier téléchargé, puis republiez le site.
- Le serveur local (`serveur-enregistrement.js`) sert aussi tout le site sur `http://127.0.0.1:8090/`. Il écoute uniquement sur `127.0.0.1` et n'est pas destiné à la production.
- Comme l'estimateur et l'admin utilisent `fetch()`, ces pages doivent être ouvertes **via un serveur** (`http://`), pas en double-cliquant (`file://`).

### Capture des demandes (leads) et GoHighLevel

- Le prénom et le courriel sont demandés **à l'étape 4, juste avant la qualité**. Une mention indique que demander l'estimation vaut consentement à être contacté au sujet du projet (aucune case à cocher). Le lead `estimate_started` est envoyé dès cette étape, puis `booking` à la réservation de la visite.
- Les demandes sont pour l'instant conservées **dans le navigateur du visiteur** (`localStorage`, clé `artemis_leads`) et affichées dans la console. **Elles ne sont pas encore envoyées à l'entreprise.**
- Pour brancher GoHighLevel : dans `estimateur.html`, remplacez `var LEAD_WEBHOOK_URL = '';` par l'URL du webhook entrant de votre CRM. Chaque demande (`estimate_started` et `booking`) sera alors envoyée en JSON à GoHighLevel.
- La page `politique-de-confidentialite.html` contient la politique de confidentialité (Loi 25 / LPRPDE) liée à la mention de consentement.

## Mise en ligne sur Cloudflare Pages

Le site est **statique** (HTML/CSS/JS + `prices.json`) : il se publie tel quel sur **Cloudflare Pages**, gratuitement, sans base de données. Le panier, l'estimateur et le site fonctionnent normalement.

### 1. Préparer un dossier propre

Cloudflare publie **tout** le dossier envoyé. Préparez une copie du site **sans** les outils locaux :

- à exclure : `serveur-enregistrement.js`, `Demarrer-le-site.bat`, `estimateur/save-prices.php`, `estimateur/prices.backup.json`, `estimateur/prices.json.tmp`, `estimateur/admin.html`, `estimateur/estimateur-old-standalone.html`, `LISEZMOI.md`, `gabarit-page.html`, `README.md`, `CNAME`, le dossier `.git` et tout dossier de copie imbriqué (`artemis-site/`) ;
- conservez tout le reste : `*.html`, `css/`, `js/`, `partials/*.txt`, `assets/`, `estimateur/prices.json`.

> L'admin `estimateur/admin.html` est volontairement exclu : il n'a pas de mot de passe et doit rester en local (WAMP). Pour le modifier en ligne plus tard, voir « Protéger l'admin ».

Exemple sous Windows (PowerShell), depuis le dossier `artemis-site` :

```powershell
$src = Get-Location
$dst = Join-Path $env:TEMP "artemis-publication"
Remove-Item $dst -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item $src $dst -Recurse
$exclude = @(
  "serveur-enregistrement.js","Demarrer-le-site.bat","LISEZMOI.md","gabarit-page.html","README.md","CNAME",
  "estimateur\save-prices.php","estimateur\prices.backup.json","estimateur\prices.json.tmp",
  "estimateur\admin.html","estimateur\estimateur-old-standalone.html"
)
foreach ($f in $exclude) { Remove-Item (Join-Path $dst $f) -Force -ErrorAction SilentlyContinue }
Remove-Item "$dst\.git","$dst\artemis-site" -Recurse -Force -ErrorAction SilentlyContinue
explorer $dst
```

### 2. Publier (deux méthodes)

- **Upload direct (le plus simple, sans Git) :** dans le tableau de bord Cloudflare → **Workers & Pages** → **Créer** → **Pages** → **Upload direct**. Donnez un nom au projet (ex. `artemis-coating`), glissez le contenu du dossier préparé (pas le dossier lui-même), puis **Déployer**. Le site est en ligne sur `https://artemis-coating.pages.dev`.
- **Via Git (mises à jour automatiques) :** poussez le dossier sur GitHub/GitLab, puis dans Cloudflare Pages choisissez **Connecter à Git**, sélectionnez le dépôt, la branche `main`, et laissez la commande de build **vide** avec le dossier de sortie à `/` (site statique). Chaque `git push` republie le site.

Le site pèse ~12,8 Mo et son plus gros fichier fait 1,86 Mo : très en dessous de la limite Cloudflare Pages (25 Mo par fichier).

### 3. Mettre à jour les prix en ligne

Sur Cloudflare Pages, l'admin **ne peut pas écrire** dans le `prices.json` du site : l'hébergement est statique.

1. Modifiez les prix en local via WAMP (`http://localhost/artemis-site/estimateur/admin.html`) ou avec `Demarrer-le-site.bat` + `http://127.0.0.1:8090/estimateur/admin.html` (écriture directe), ou via **Télécharger une copie**.
2. Republiez `estimateur/prices.json` : upload direct (nouveau déploiement avec le dossier complet) ou `git push` si vous utilisez Git.
3. Rechargez l'estimateur : les nouveaux prix sont utilisés.

### 4. Protéger l'admin

`estimateur/admin.html` n'a **pas de mot de passe**. Il est donc **exclu du dossier publié** : l'admin reste accessible uniquement en local via WAMP. Si vous voulez un jour le publier, deux options :

- **Cloudflare Access (Zero Trust)** : créez une application Access sur le domaine et une règle qui n'autorise que votre e-mail sur le chemin `/estimateur/admin.html`. Les visiteurs non autorisés sont bloqués avant même de voir la page.
- **Ou** gardez-le hors ligne et modifiez les prix en local, puis republiez `estimateur/prices.json`.

### 5. Modifier les prix directement en ligne (facultatif)

Cloudflare le permet avec **Pages Functions** + **KV** (ou R2) : une petite API protégée par mot de passe qui lit/écrit `prices.json`, et un admin adapté. Le site actuel n'en a pas besoin ; cette évolution peut être ajoutée plus tard.

### Bon à savoir

- Cloudflare Pages sert le site en **HTTPS**, ce qui est nécessaire pour le presse-papiers, les polices et certaines API navigateur.
- Le fichier `_headers` (facultatif) permet d'ajouter du cache ou des en-têtes de sécurité ; il n'est pas requis pour commencer.
- `file://` ne fonctionne pas (chargement des partials et de `prices.json` via `fetch`) : utilisez toujours `http://` en local et `https://` en ligne.

## À remplacer avant la mise en ligne
- `[TÉLÉPHONE]`, `tel:[TELEPHONE]`, `[COURRIEL]`, `mailto:[COURRIEL]`, `LICENCE RBQ [XXXX-XXXX-XX]`
- Les liens Facebook, Instagram et TikTok (`href="#"`)
- `[PRIX]` et les noms `[Produit Artemis System …]` sur `index.html` et `formation-epoxy-a-z.html` (la page `produits.html` lit désormais les vrais produits Shopify)
- `domain` et `storefrontToken` dans `js/shopify.js` (voir « Brancher la boutique »)
- `LEAD_WEBHOOK_URL` dans `estimateur.html` quand GoHighLevel sera prêt
- `assets/pour.mp4` : la vidéo de fond est un test, à remplacer par la vidéo validée au CDC2
- Les liens vers les pages pas encore créées (`installation-residentielle.html`, `estimateur.html`, etc.)
- Les pages `termes-et-conditions.html` et `politique-de-retours.html` restent à créer (liens actuellement sans cible).
