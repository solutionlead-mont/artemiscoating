/* =========================================================
   Artemis Coating — Shopify Storefront API
   ---------------------------------------------------------
   Catalogue en direct (fetch navigateur, jeton PUBLIC) + panier
   Shopify (cartCreate → checkoutUrl). Aucun jeton Admin ici.

   CONFIGURATION (une seule fois) :
   1. Boutique Shopify → Paramètres → Applications et canaux de vente
      → Développer des applications → créer une app → « Configurer
      l'API Storefront ».
   2. Copier le jeton public « Storefront API access token ».
   3. Remplir `domain` et `storefrontToken` ci-dessous.
   4. Autoriser les domaines du site (localhost + Cloudflare Pages)
      dans la configuration de l'app.

   Tant que `domain` ou `storefrontToken` est vide, la page produits
   affiche un message d'attente et le panier renvoie vers contact.html.
   ========================================================= */
(function () {
  'use strict';

  /* ===================== CONFIGURATION ===================== */
  var CONFIG = Object.assign({
    domain: 'kqa3nt-0d.myshopify.com', // boutique Shopify
    storefrontToken: '683a98a6adad84d70c23e25e344e6b29',   // jeton PUBLIC Storefront API (jamais Admin)
    apiVersion: '2026-07',
    locale: 'fr-CA',
    currency: 'CAD'
  }, window.ARTEMIS_SHOPIFY || {});

  /* ===================== ÉTAT LOCAL ======================== */
  var STATE = {
    products: [],
    query: '',
    cats: [],
    inStock: false,
    sort: 'popular',
    loading: false,
    error: false
  };

  var PRODUCTS_QUERY = [
    'query Products($first: Int!, $after: String) {',
    '  products(first: $first, after: $after) {',
    '    pageInfo { hasNextPage endCursor }',
    '    edges { node {',
    '      id handle title description descriptionHtml productType vendor tags availableForSale createdAt',
    '      featuredImage { url altText width height }',
    '      priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }',
    '      compareAtPriceRange { minVariantPrice { amount currencyCode } }',
    '      variants(first: 100) { edges { node {',
    '        id title availableForSale',
    '        price { amount currencyCode }',
    '        compareAtPrice { amount currencyCode }',
    '        image { url altText width height }',
    '        selectedOptions { name value }',
    '      } } }',
    '    } }',
    '  }',
    '}'
  ].join('\n');

  var CART_CREATE = [
    'mutation CartCreate($input: CartInput!) {',
    '  cartCreate(input: $input) {',
    '    cart { id checkoutUrl }',
    '    userErrors { field message }',
    '  }',
    '}'
  ].join('\n');

  /* ===================== OUTILS ============================ */
  function shopDomain() {
    return String(CONFIG.domain || '')
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '');
  }

  function configured() {
    return !!(shopDomain() && CONFIG.storefrontToken);
  }

  function endpoint() {
    return 'https://' + shopDomain() + '/api/' + CONFIG.apiVersion + '/graphql.json';
  }

  function graphql(query, variables) {
    return fetch(endpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Shopify-Storefront-Access-Token': CONFIG.storefrontToken
      },
      body: JSON.stringify({ query: query, variables: variables || {} })
    }).then(function (r) {
      if (!r.ok) throw new Error('Shopify HTTP ' + r.status);
      return r.json();
    }).then(function (json) {
      if (json.errors && json.errors.length) {
        throw new Error(json.errors[0].message || 'Erreur GraphQL Shopify');
      }
      return json.data;
    });
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(amount, currency) {
    var n = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (n == null || !isFinite(n)) return '';
    try {
      return new Intl.NumberFormat(CONFIG.locale || 'fr-CA', {
        style: 'currency',
        currency: currency || CONFIG.currency || 'CAD'
      }).format(n);
    } catch (err) {
      return n.toFixed(2) + ' $';
    }
  }

  function norm(value) {
    var s = String(value == null ? '' : value).toLowerCase();
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (err) {}
    return s;
  }

  function truncate(text, max) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    if (s.length <= max) return s;
    var cut = s.slice(0, max);
    var space = cut.lastIndexOf(' ');
    if (space > max * 0.6) cut = cut.slice(0, space);
    return cut.replace(/[.,;:!?–-]$/, '') + '…';
  }

  function stripHtml(html) {
    if (!html) return '';
    var div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('br').forEach(function (n) { n.replaceWith(' '); });
    div.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,div,tr').forEach(function (n) { n.append(' '); });
    return String(div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function imageUrl(url, width) {
    if (!url) return '';
    if (url.indexOf('cdn.shopify.com') === -1) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'width=' + width;
  }

  function numericVariantId(gid) {
    var parts = String(gid || '').split('/');
    return parts[parts.length - 1];
  }

  /* ===================== PRODUITS ========================== */
  function normalizeProduct(node) {
    var variants = ((node.variants && node.variants.edges) || []).map(function (e) { return e.node; });
    if (!variants.length) return null;

    var min = parseFloat(node.priceRange.minVariantPrice.amount);
    var max = parseFloat(node.priceRange.maxVariantPrice.amount);
    var compare = node.compareAtPriceRange && node.compareAtPriceRange.minVariantPrice
      ? parseFloat(node.compareAtPriceRange.minVariantPrice.amount)
      : 0;

    return {
      id: node.id,
      handle: node.handle,
      title: node.title,
      description: stripHtml(node.descriptionHtml || node.description || ''),
      descriptionHtml: node.descriptionHtml || '',
      productType: node.productType || '',
      vendor: node.vendor || '',
      tags: node.tags || [],
      available: variants.some(function (v) { return v.availableForSale; }),
      createdAt: node.createdAt || '',
      image: node.featuredImage || null,
      min: isFinite(min) ? min : 0,
      max: isFinite(max) ? max : 0,
      compareAt: isFinite(compare) ? compare : 0,
      currency: node.priceRange.minVariantPrice.currencyCode || CONFIG.currency,
      variants: variants
    };
  }

  function fetchAllProducts() {
    var all = [];

    function page(cursor) {
      return graphql(PRODUCTS_QUERY, { first: 100, after: cursor || null }).then(function (data) {
        var conn = data && data.products;
        if (!conn) throw new Error('Réponse Shopify inattendue');
        (conn.edges || []).forEach(function (edge) {
          var p = normalizeProduct(edge.node);
          if (p) all.push(p);
        });
        if (conn.pageInfo && conn.pageInfo.hasNextPage && all.length < 500) {
          return page(conn.pageInfo.endCursor);
        }
        return all;
      });
    }

    return page(null);
  }

  function defaultVariant(p) {
    return p.variants.filter(function (v) { return v.availableForSale; })[0] || p.variants[0];
  }

  function priceHTML(price, compare, currency) {
    var html = money(price, currency);
    if (compare && compare > price) {
      html = '<s>' + money(compare, currency) + '</s> ' + html;
    }
    return html;
  }

  function variantOptions(p, selectedId) {
    return p.variants.map(function (v) {
      var label = v.title + (v.availableForSale ? '' : ' — épuisé');
      var src = v.image ? imageUrl(v.image.url, 800) : '';
      return '<option value="' + esc(v.id) + '"' +
        ' data-title="' + esc(v.title) + '"' +
        ' data-price="' + esc(v.price.amount) + '"' +
        ' data-compare="' + esc(v.compareAtPrice ? v.compareAtPrice.amount : '') + '"' +
        ' data-currency="' + esc(v.price.currencyCode) + '"' +
        ' data-image="' + esc(src) + '"' +
        ' data-available="' + (v.availableForSale ? 'true' : 'false') + '"' +
        (v.id === selectedId ? ' selected' : '') +
        (v.availableForSale ? '' : ' disabled') +
        '>' + esc(label) + '</option>';
    }).join('');
  }

  function cardHTML(p) {
    var v = defaultVariant(p);
    var imgSource = v.image ? v.image.url : (p.image ? p.image.url : '');
    var src = imgSource ? imageUrl(imgSource, 800) : '';
    var srcset = imgSource
      ? [400, 600, 900].map(function (w) { return imageUrl(imgSource, w) + ' ' + w + 'w'; }).join(', ')
      : '';
    var alt = (v.image && v.image.altText) || (p.image && p.image.altText) || p.title;
    var href = 'produit.html?handle=' + encodeURIComponent(p.handle);

    var out = !p.available;
    var price = parseFloat(v.price.amount);
    var compare = v.compareAtPrice ? parseFloat(v.compareAtPrice.amount) : 0;
    var currency = v.price.currencyCode;
    var from = p.min !== p.max;
    var shownPrice = from ? p.min : price;
    var shownCompare = from ? p.compareAt : compare;

    return '<article class="shop-card" data-product-id="' + esc(p.id) + '" data-handle="' + esc(p.handle) + '">' +
      '<div class="shop-card__media">' +
        (src
          ? '<img src="' + esc(src) + '" srcset="' + esc(srcset) + '" sizes="(max-width:640px) 100vw, (max-width:1100px) 50vw, 33vw" alt="' + esc(alt) + '" loading="lazy" decoding="async">'
          : '<span class="shop-card__noimg" aria-hidden="true"></span>') +
        (out
          ? '<span class="shop-card__badge shop-card__badge--out">Épuisé</span>'
          : (compare > price ? '<span class="shop-card__badge">En solde</span>' : '')) +
      '</div>' +
      '<div class="shop-card__body">' +
        '<h2 class="shop-card__name"><a class="shop-card__link" href="' + esc(href) + '">' + esc(p.title) + '</a></h2>' +
        '<p class="shop-card__price">' +
          (from ? '<span class="shop-card__from">À partir de</span> ' : '') +
          priceHTML(shownPrice, shownCompare, currency) +
        '</p>' +
        '<span class="shop-card__cta" aria-hidden="true">Voir le produit <span>→</span></span>' +
      '</div>' +
    '</article>';
  }

  /* ===================== RENDU ============================= */
  function gridEl() { return document.querySelector('[data-product-grid]'); }
  function filtersEl() { return document.querySelector('[data-shop-filters]'); }
  function fallbackEl() { return document.querySelector('[data-product-fallback]'); }
  function emptyEl() { return document.querySelector('[data-shop-empty]'); }
  function noticeEl() { return document.querySelector('[data-shop-notice]'); }

  function setCount(value) {
    var el = document.querySelector('[data-product-count]');
    if (!el) return;
    if (typeof value === 'number') {
      el.textContent = new Intl.NumberFormat('fr-CA').format(value) + (value > 1 ? ' produits' : ' produit');
    } else {
      el.textContent = value;
    }
  }

  function setControlsEnabled(on) {
    var search = document.querySelector('[data-shop-search]');
    var sort = document.querySelector('[data-shop-sort]');
    if (search) search.disabled = !on;
    if (sort) sort.disabled = !on;
  }

  function showLoading() {
    var grid = gridEl();
    if (!grid) return;
    grid.hidden = false;
    grid.innerHTML = new Array(6 + 1).join('<div class="shop-skeleton" aria-hidden="true"></div>');
    var fallback = fallbackEl(); if (fallback) fallback.hidden = true;
    var empty = emptyEl(); if (empty) empty.hidden = true;
    var notice = noticeEl(); if (notice) notice.hidden = true;
    var filters = filtersEl(); if (filters) filters.parentElement.hidden = true;
    setControlsEnabled(false);
    setCount('Chargement…');
  }

  function showLive() {
    var fallback = fallbackEl(); if (fallback) fallback.hidden = true;
    var notice = noticeEl(); if (notice) notice.hidden = true;
    var filters = filtersEl(); if (filters) filters.parentElement.hidden = false;
    setControlsEnabled(true);
  }

  function showFallback(reason) {
    var grid = gridEl(); if (grid) { grid.innerHTML = ''; grid.hidden = true; }
    var empty = emptyEl(); if (empty) empty.hidden = true;
    var notice = noticeEl(); if (notice) notice.hidden = true;
    var filters = filtersEl(); if (filters) filters.parentElement.hidden = true;
    setControlsEnabled(false);

    var fallback = fallbackEl();
    if (!fallback) return;
    fallback.hidden = false;

    var title = fallback.querySelector('[data-fallback-title]');
    var text = fallback.querySelector('[data-fallback-text]');
    var retry = fallback.querySelector('[data-shop-retry]');

    if (reason === 'error') {
      if (title) title.textContent = 'Catalogue momentanément indisponible';
      if (text) text.textContent = 'Impossible de charger la boutique pour le moment. Réessayez dans un instant ou écrivez-nous : nous vous donnons le prix et la disponibilité.';
    } else if (reason === 'empty') {
      if (title) title.textContent = 'Aucun produit en ligne pour le moment';
      if (text) text.textContent = 'Le catalogue est en préparation. Contactez-nous pour connaître les produits disponibles et leurs prix.';
    } else {
      if (title) title.textContent = 'Boutique en ligne bientôt disponible';
      if (text) text.textContent = 'Le catalogue Shopify n\'est pas encore connecté. En attendant, écrivez-nous : nous vous conseillons le bon produit et vous donnons le prix.';
    }
    if (retry) retry.hidden = reason !== 'error';

    setCount('Catalogue');
  }

  function buildFilters() {
    var filters = filtersEl();
    if (!filters) return;

    var counts = {};
    STATE.products.forEach(function (p) {
      var seen = {};
      [p.productType].concat(p.tags).forEach(function (raw) {
        var key = String(raw || '').trim();
        if (!key || seen[key]) return;
        seen[key] = true;
        counts[key] = (counts[key] || 0) + 1;
      });
    });

    var keys = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a] || a.localeCompare(b, 'fr');
    }).slice(0, 10);

    var html = '';
    if (keys.length) {
      html += '<fieldset class="shop-filter-group"><legend>Application</legend>';
      keys.forEach(function (key) {
        html += '<label class="shop-filter"><input type="checkbox" value="' + esc(key) + '" data-shop-filter> ' +
          '<span>' + esc(key) + '</span><span class="shop-filter__n">' + counts[key] + '</span></label>';
      });
      html += '</fieldset>';
    }
    html += '<fieldset class="shop-filter-group"><legend>Disponibilité</legend>' +
      '<label class="shop-filter"><input type="checkbox" data-shop-stock> <span>En stock</span></label>' +
      '</fieldset>';

    filters.innerHTML = html;
  }

  function applyFilters() {
    if (STATE.loading || STATE.error) return;
    if (!STATE.products.length) return;
    var grid = gridEl();
    if (!grid) return;

    var list = STATE.products.slice();
    var q = norm(STATE.query);

    if (q) {
      list = list.filter(function (p) {
        return norm([p.title, p.productType, p.vendor, p.tags.join(' '), p.description].join(' ')).indexOf(q) !== -1;
      });
    }

    if (STATE.cats.length) {
      var wanted = STATE.cats.map(norm);
      list = list.filter(function (p) {
        var cats = [p.productType].concat(p.tags).map(norm);
        return wanted.some(function (c) { return cats.indexOf(c) !== -1; });
      });
    }

    if (STATE.inStock) {
      list = list.filter(function (p) { return p.available; });
    }

    var sorted = list.slice();
    if (STATE.sort === 'price-asc') sorted.sort(function (a, b) { return a.min - b.min; });
    else if (STATE.sort === 'price-desc') sorted.sort(function (a, b) { return b.min - a.min; });
    else if (STATE.sort === 'new') sorted.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });

    grid.hidden = false;
    grid.innerHTML = sorted.map(cardHTML).join('');

    var empty = emptyEl();
    if (empty) empty.hidden = sorted.length > 0;
    setCount(sorted.length);
  }

  /* ===================== CHARGEMENT ======================== */
  function load() {
    STATE.loading = true;
    STATE.error = false;
    showLoading();

    fetchAllProducts().then(function (products) {
      STATE.products = products;
      STATE.loading = false;
      if (!products.length) { showFallback('empty'); return; }
      buildFilters();
      showLive();
      applyFilters();
    }).catch(function (err) {
      STATE.loading = false;
      STATE.error = true;
      console.error('[Artemis] Catalogue Shopify indisponible :', err);
      showFallback('error');
    });
  }

  /* ===================== PANIER / CHECKOUT ================= */
  function permalinkCheckout(items) {
    var parts = [];
    items.forEach(function (item) {
      if (!item.variantId) return;
      parts.push(numericVariantId(item.variantId) + ':' + (item.qty || 1));
    });
    if (!parts.length) return null;
    return 'https://' + shopDomain() + '/cart/' + parts.join(',');
  }

  function checkout(items) {
    return new Promise(function (resolve, reject) {
      if (!configured()) return reject(new Error('shopify-not-configured'));

      var lines = [];
      var missing = false;
      (items || []).forEach(function (item) {
        if (!item.variantId) { missing = true; return; }
        lines.push({ merchandiseId: item.variantId, quantity: item.qty || 1 });
      });

      if (missing || !lines.length) return reject(new Error('missing-variant'));

      var fallbackUrl = permalinkCheckout(items);

      graphql(CART_CREATE, {
        input: { lines: lines, buyerIdentity: { countryCode: 'CA' } }
      }).then(function (data) {
        var res = data && data.cartCreate;
        if (!res || (res.userErrors && res.userErrors.length)) {
          throw new Error(res && res.userErrors && res.userErrors[0] ? res.userErrors[0].message : 'Panier Shopify refusé');
        }
        var url = res.cart && res.cart.checkoutUrl;
        if (!url) throw new Error('checkoutUrl absent');
        window.location.href = url;
        resolve(url);
      }).catch(function (err) {
        // Repli sans jeton d'écriture : lien panier Shopify classique.
        if (fallbackUrl) {
          console.warn('[Artemis] cartCreate indisponible — lien panier utilisé :', err);
          window.location.href = fallbackUrl;
          resolve(fallbackUrl);
          return;
        }
        reject(err);
      });
    });
  }

  /* ===================== INITIALISATION ==================== */
  function wireControls() {
    var search = document.querySelector('[data-shop-search]');
    if (search) {
      search.addEventListener('input', function () {
        STATE.query = search.value;
        applyFilters();
      });
    }

    var sort = document.querySelector('[data-shop-sort]');
    if (sort) {
      sort.addEventListener('change', function () {
        STATE.sort = sort.value;
        applyFilters();
      });
    }

    var filters = filtersEl();
    if (filters) {
      filters.addEventListener('change', function (e) {
        var t = e.target;
        if (t.matches('[data-shop-filter]')) {
          var value = t.value;
          var index = STATE.cats.indexOf(value);
          if (t.checked && index === -1) STATE.cats.push(value);
          if (!t.checked && index !== -1) STATE.cats.splice(index, 1);
          applyFilters();
        } else if (t.matches('[data-shop-stock]')) {
          STATE.inStock = t.checked;
          applyFilters();
        }
      });
    }

    var grid = gridEl();
    if (grid) {
      grid.addEventListener('change', function (e) {
        var select = e.target.closest && e.target.closest('[data-variant-select]');
        if (!select) return;
        var card = select.closest('.shop-card');
        var btn = card && card.querySelector('[data-add-to-cart]');
        var opt = select.options[select.selectedIndex];
        if (!btn || !opt) return;

        btn.setAttribute('data-variant-id', opt.value);
        btn.setAttribute('data-variant-title', opt.getAttribute('data-title') || '');
        btn.setAttribute('data-price', opt.getAttribute('data-price') || '');
        btn.setAttribute('data-currency', opt.getAttribute('data-currency') || CONFIG.currency);
        btn.setAttribute('data-image', opt.getAttribute('data-image') || '');
        var available = opt.getAttribute('data-available') === 'true';
        btn.disabled = !available;
        btn.textContent = available ? 'Ajouter' : 'Épuisé';

        var priceEl = card.querySelector('.shop-card__price');
        if (priceEl) {
          var compare = parseFloat(opt.getAttribute('data-compare'));
          priceEl.innerHTML = priceHTML(parseFloat(opt.getAttribute('data-price')), compare, opt.getAttribute('data-currency'));
        }
      });
    }

    var retry = document.querySelector('[data-shop-retry]');
    if (retry) retry.addEventListener('click', load);
  }

  function init() {
    var grid = gridEl();
    if (!grid) return;

    wireControls();

    if (!configured()) {
      showFallback('unconfigured');
      return;
    }

    load();
  }

  /* API publique (utilisée par js/main.js et la fiche produit) */
  window.ArtemisShopify = {
    configured: configured,
    checkout: checkout,
    money: money,
    config: CONFIG,
    graphql: graphql,
    esc: esc,
    imageUrl: imageUrl,
    truncate: truncate,
    stripHtml: stripHtml,
    normalizeProduct: normalizeProduct,
    defaultVariant: defaultVariant,
    cardHTML: cardHTML
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
