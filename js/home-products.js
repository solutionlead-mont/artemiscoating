/* =========================================================
   Accueil — images produit synchronisées avec Shopify
   ---------------------------------------------------------
   Les cartes produits de l'accueil gardent une image locale
   en repli, mais dès que l'API Storefront répond, chaque
   image est remplacée par l'image « featuredImage » actuelle
   du produit Shopify. Ainsi, changer l'image dans Shopify
   met automatiquement à jour l'accueil, sans republier le
   site ni remplacer les fichiers assets/produits/.
   ========================================================= */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function start() {
    var S = window.ArtemisShopify;
    var images = Array.prototype.slice.call(document.querySelectorAll('img[data-shopify-handle]'));
    if (!S || typeof S.configured !== 'function' || !S.configured() || !images.length) return;

    var handles = [];
    var byHandle = {};
    images.forEach(function (img) {
      var handle = String(img.getAttribute('data-shopify-handle') || '').trim();
      if (!handle || byHandle[handle]) return;
      byHandle[handle] = img;
      handles.push(handle);
    });
    if (!handles.length) return;

    var declarations = handles.map(function (_, i) { return '$h' + i + ': String!'; }).join(', ');
    var fields = handles.map(function (_, i) {
      return 'p' + i + ': product(handle: $h' + i + ') { handle title featuredImage { url altText width height } }';
    }).join('\n');
    var variables = {};
    handles.forEach(function (h, i) { variables['h' + i] = h; });
    var query = 'query HomeProducts(' + declarations + ') {\n' + fields + '\n}';

    S.graphql(query, variables).then(function (data) {
      if (!data) return;
      handles.forEach(function (handle, i) {
        var product = data['p' + i];
        var img = byHandle[handle];
        if (!product || !img || !product.featuredImage || !product.featuredImage.url) return;
        var url = S.imageUrl ? S.imageUrl(product.featuredImage.url, 900) : product.featuredImage.url;
        if (url && img.getAttribute('src') !== url) img.src = url;
        if (product.featuredImage.altText) img.alt = product.featuredImage.altText;
        img.setAttribute('data-shopify-loaded', '1');
      });
    }).catch(function (err) {
      console.warn('[accueil] images Shopify indisponibles — images locales conservées.', err);
    });
  }

  ready(start);
})();
