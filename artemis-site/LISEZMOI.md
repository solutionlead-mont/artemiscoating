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
├── gabarit-page.html       ← modèle à copier pour créer les autres pages
├── partials/
│   ├── header.html         ← menu (navigation avec méga-menu, menu mobile)
│   └── footer.html         ← pied de page
├── css/style.css           ← tous les styles
├── js/include.js           ← le script qui insère le menu et le pied de page
├── js/main.js              ← menus déroulants, barre collante, menu mobile, formulaire
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

- **VS Code** : installez l'extension « Live Server », faites un clic droit sur `index.html` puis choisissez « Open with Live Server ».
- **Terminal** : ouvrez le dossier `artemis-site` puis lancez `python -m http.server 8000`, et allez sur http://localhost:8000.
- **En ligne** : tout hébergeur web normal fonctionne tel quel.

## Créer une nouvelle page
1. Copiez `gabarit-page.html` et renommez la copie, par exemple `contact.html`.
2. Changez le `<title>`, le titre et `data-page="contact"` sur la balise `<body>`. Le lien correspondant s'allume alors en or dans le menu.
3. Ajoutez votre contenu entre `<main>` et `</main>`.

## À remplacer avant la mise en ligne
- `[TÉLÉPHONE]`, `tel:[TELEPHONE]`, `[COURRIEL]`, `mailto:[COURRIEL]`, `LICENCE RBQ [XXXX-XXXX-XX]`
- Les liens Facebook, Instagram et TikTok (`href="#"`)
- `[PRIX]` et les noms `[Produit Artemis System …]`
- `assets/pour.mp4` : la vidéo de fond est un test, à remplacer par la vidéo validée au CDC2
- Les liens vers les pages pas encore créées (`installation-residentielle.html`, `estimateur.html`, etc.)
