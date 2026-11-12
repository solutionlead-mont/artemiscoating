/* =========================================================
   Artemis Coating — fiche produit (Shopify Storefront API)
   Lit ?handle=… et affiche le produit, ses variantes, son prix
   et l'ajout au panier. Le panier est géré par js/main.js.
   ========================================================= */
(function () {
  'use strict';

  var S = window.ArtemisShopify;

  var PRODUCT_QUERY = [
    'query Product($handle: String!) {',
    '  product(handle: $handle) {',
    '    id handle title description descriptionHtml productType vendor tags availableForSale createdAt',
    '    featuredImage { url altText width height }',
    '    priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }',
    '    compareAtPriceRange { minVariantPrice { amount currencyCode } }',
    '    options { name values }',
    '    variants(first: 100) { edges { node {',
    '      id title availableForSale',
    '      price { amount currencyCode }',
    '      compareAtPrice { amount currencyCode }',
    '      image { url altText width height }',
    '      selectedOptions { name value }',
    '    } } }',
    '  }',
    '}'
  ].join('\n');

  var RELATED_QUERY = [
    'query Related {',
    '  products(first: 8) {',
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

  var state = {
    product: null,
    variants: [],
    selected: null,
    images: [],
    handle: ''
  };

  /* ---------- Utilitaires ---------- */
  function q(sel) { return document.querySelector(sel); }
  function esc(v) { return S.esc(v); }
  function money(amount, currency) { return S.money(amount, currency); }

  function parseAmount(value) {
    var n = typeof value === 'string' ? parseFloat(value) : value;
    return isFinite(n) ? n : 0;
  }

  function sanitize(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    tpl.content.querySelectorAll('script,style,iframe,object,embed,form,input,button,link,meta').forEach(function (n) { n.remove(); });
    tpl.content.querySelectorAll('*').forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        if (/^on/i.test(a.name)) el.removeAttribute(a.name);
        if ((a.name === 'href' || a.name === 'src') && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
        if (a.name === 'target') el.removeAttribute(a.name);
      });
    });
    return tpl.innerHTML;
  }

  function htmlToText(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    tpl.content.querySelectorAll('br').forEach(function (n) { n.replaceWith(' '); });
    tpl.content.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,div,tr').forEach(function (n) { n.append(' '); });
    return String(tpl.content.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function firstSentence(text, max) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    var cut = clean.slice(0, max);
    var stop = cut.search(/[.!?](\s|$)/);
    if (stop > 40) cut = cut.slice(0, stop + 1);
    else {
      var space = cut.lastIndexOf(' ');
      if (space > max * 0.6) cut = cut.slice(0, space);
      cut += '…';
    }
    return cut;
  }

  function priceHTML(price, compare, currency) {
    var html = '<span class="pdp-price__now">' + esc(money(price, currency)) + '</span>';
    if (compare && compare > price) {
      html = '<s>' + esc(money(compare, currency)) + '</s> ' + html;
    }
    return html;
  }

  /* ---------- États ---------- */
  function showLoading() {
    var loading = q('[data-pdp-loading]');
    if (loading) loading.hidden = false;
    var error = q('[data-pdp-error]');
    if (error) error.hidden = true;
    var main = q('[data-pdp-main]');
    if (main) main.hidden = true;
  }

  function showError(title, text, retry) {
    var loading = q('[data-pdp-loading]');
    if (loading) loading.hidden = true;
    var main = q('[data-pdp-main]');
    if (main) main.hidden = true;

    var error = q('[data-pdp-error]');
    if (!error) return;
    error.hidden = false;

    var t = q('[data-pdp-error-title]');
    var p = q('[data-pdp-error-text]');
    var r = q('[data-pdp-retry]');
    if (t) t.textContent = title;
    if (p) p.textContent = text;
    if (r) r.hidden = !retry;
    document.title = title + ' — Artemis Coating';
  }

  /* ---------- Galerie ---------- */
  function collectImages(product) {
    var list = [];
    var seen = {};
    function add(img) {
      if (!img || !img.url || seen[img.url]) return;
      seen[img.url] = true;
      list.push(img);
    }
    add(product.featuredImage);
    product.variants.forEach(function (v) { add(v.image); });
    return list;
  }

  function renderGallery() {
    var main = q('[data-pdp-image]');
    var thumbs = q('[data-pdp-thumbs]');
    if (!main) return;

    if (!state.images.length) {
      main.removeAttribute('src');
      main.alt = state.product.title;
      if (thumbs) thumbs.hidden = true;
      return;
    }

    setMainImage(state.images[0]);

    if (thumbs) {
      if (state.images.length < 2) {
        thumbs.hidden = true;
        thumbs.innerHTML = '';
      } else {
        thumbs.hidden = false;
        thumbs.innerHTML = state.images.map(function (img, i) {
          return '<button type="button" class="pdp-thumb' + (i === 0 ? ' is-on' : '') + '" data-pdp-thumb="' + i + '" aria-label="Voir l\'image ' + (i + 1) + '">' +
            '<img src="' + esc(S.imageUrl(img.url, 160)) + '" alt="' + esc(img.altText || state.product.title) + '" loading="lazy">' +
          '</button>';
        }).join('');
      }
    }
  }

  function setMainImage(img) {
    var main = q('[data-pdp-image]');
    if (!main || !img) return;
    main.src = S.imageUrl(img.url, 1200);
    main.srcset = [600, 900, 1200].map(function (w) { return S.imageUrl(img.url, w) + ' ' + w + 'w'; }).join(', ');
    main.sizes = '(max-width: 900px) 100vw, 55vw';
    main.alt = img.altText || state.product.title;
  }

  /* ---------- Variantes ---------- */
  function variantLabel(v) {
    if (!v.title || v.title === 'Default Title') return 'Format unique';
    return v.title;
  }

  function renderVariants() {
    var wrap = q('[data-pdp-options-wrap]');
    var select = q('[data-pdp-variant]');
    if (!wrap || !select) return;

    if (state.variants.length < 2) {
      wrap.hidden = true;
      select.innerHTML = '';
      return;
    }

    wrap.hidden = false;
    select.innerHTML = state.variants.map(function (v) {
      return '<option value="' + esc(v.id) + '"' + (v.id === state.selected.id ? ' selected' : '') + (v.availableForSale ? '' : ' disabled') + '>' +
        esc(variantLabel(v)) + (v.availableForSale ? '' : ' — épuisé') +
      '</option>';
    }).join('');
  }

  function selectVariant(id) {
    var variant = null;
    for (var i = 0; i < state.variants.length; i++) {
      if (state.variants[i].id === id) { variant = state.variants[i]; break; }
    }
    if (!variant) return;
    state.selected = variant;

    var price = parseAmount(variant.price.amount);
    var compare = variant.compareAtPrice ? parseAmount(variant.compareAtPrice.amount) : 0;
    var currency = variant.price.currencyCode;

    var priceEl = q('[data-pdp-price]');
    if (priceEl) priceEl.innerHTML = priceHTML(price, compare, currency);

    if (variant.image) {
      setMainImage(variant.image);
      var thumbs = document.querySelectorAll('[data-pdp-thumb]');
      for (var j = 0; j < thumbs.length; j++) {
        var img = state.images[Number(thumbs[j].getAttribute('data-pdp-thumb'))];
        thumbs[j].classList.toggle('is-on', !!(img && variant.image.url === img.url));
      }
    }

    updateBuyButton();
    updateStock();
    updateBadge();
  }

  function updateBuyButton() {
    var btn = q('[data-add-to-cart]');
    if (!btn || !state.selected) return;
    var v = state.selected;
    var image = v.image ? S.imageUrl(v.image.url, 800) : (state.product.featuredImage ? S.imageUrl(state.product.featuredImage.url, 800) : '');
    btn.setAttribute('data-product-id', state.product.id);
    btn.setAttribute('data-variant-id', v.id);
    btn.setAttribute('data-variant-title', v.title);
    btn.setAttribute('data-price', v.price.amount);
    btn.setAttribute('data-currency', v.price.currencyCode);
    btn.setAttribute('data-image', image);
    btn.setAttribute('data-name', state.product.title);
    btn.setAttribute('data-meta', productMeta());
    btn.disabled = !v.availableForSale;
    btn.textContent = v.availableForSale ? 'Ajouter au panier' : 'Épuisé';
  }

  function updateStock() {
    var el = q('[data-pdp-stock]');
    if (!el || !state.selected) return;
    if (state.selected.availableForSale) {
      el.innerHTML = '<span class="pdp-stock__dot" aria-hidden="true"></span> En stock — prêt à expédier';
      el.classList.remove('is-out');
    } else {
      el.innerHTML = '<span class="pdp-stock__dot" aria-hidden="true"></span> Épuisé — réapprovisionnement à venir';
      el.classList.add('is-out');
    }
  }

  function updateBadge() {
    var badge = q('[data-pdp-badge]');
    if (!badge || !state.selected) return;
    var v = state.selected;
    var compare = v.compareAtPrice ? parseAmount(v.compareAtPrice.amount) : 0;
    var price = parseAmount(v.price.amount);
    if (!v.availableForSale) {
      badge.hidden = false;
      badge.textContent = 'Épuisé';
      badge.className = 'pdp-gallery__badge pdp-gallery__badge--out';
    } else if (compare > price) {
      badge.hidden = false;
      badge.textContent = 'En solde';
      badge.className = 'pdp-gallery__badge';
    } else {
      badge.hidden = true;
    }
  }

  /* ---------- Contenu ---------- */
  function productMeta() {
    var bits = [];
    if (state.product.productType) bits.push(state.product.productType);
    if (state.product.vendor && state.product.vendor !== 'Ma boutique') bits.push(state.product.vendor);
    if (state.product.tags && state.product.tags.length) bits.push(state.product.tags[0]);
    return bits.length ? bits.join(' · ').toUpperCase() : 'BOUTIQUE ARTEMIS';
  }

  function renderSpecs() {
    var el = q('[data-pdp-specs]');
    if (!el) return;

    var rows = [];
    if (state.product.productType) rows.push(['Type', state.product.productType]);
    if (state.product.vendor && state.product.vendor !== 'Ma boutique') rows.push(['Marque', state.product.vendor]);

    var formats = state.variants.map(function (v) { return variantLabel(v); })
      .filter(function (label, i, arr) { return label !== 'Format unique' && arr.indexOf(label) === i; });
    if (formats.length) rows.push(['Format', formats.join(', ')]);

    (state.product.options || []).forEach(function (opt) {
      if (!opt.values || !opt.values.length) return;
      if (opt.name === 'Title' && opt.values.length === 1 && opt.values[0] === 'Default Title') return;
      if (opt.name === 'Format') return;
      rows.push([opt.name, opt.values.join(', ')]);
    });
    if (state.product.tags && state.product.tags.length) rows.push(['Tags', state.product.tags.join(', ')]);

    el.innerHTML = rows.map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('');

    var details = el.closest('details');
    if (details && !rows.length) details.hidden = true;
  }

  function renderDescription() {
    var el = q('[data-pdp-description]');
    if (!el) return;
    var html = state.product.descriptionHtml;
    if (html) {
      el.innerHTML = sanitize(html);
    } else {
      var text = String(state.product.description || '').trim();
      el.innerHTML = text
        ? text.split(/\n{2,}/).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('')
        : '<p>Aucune description pour ce produit. Écrivez-nous pour plus de détails.</p>';
    }
  }

  function renderRelated(products) {
    var section = q('[data-pdp-related]');
    var grid = q('[data-pdp-related-grid]');
    if (!section || !grid) return;

    var list = (products || []).filter(function (p) { return p.id !== state.product.id; }).slice(0, 4);
    if (!list.length) { section.hidden = true; return; }

    section.hidden = false;
    grid.innerHTML = list.map(S.cardHTML).join('');
  }

  /* ---------- Rendu principal ---------- */
  function render(product) {
    state.product = product;
    state.variants = product.variants;
    state.selected = S.defaultVariant(product);
    state.images = collectImages(product);

    var plain = htmlToText(product.descriptionHtml) || String(product.description || '');

    document.title = product.title + ' — Artemis Coating';
    var desc = q('meta[name="description"]');
    if (desc) desc.setAttribute('content', firstSentence(plain, 155) || 'Fiche produit Artemis Coating.');

    var crumb = q('[data-pdp-crumb]');
    if (crumb) crumb.textContent = product.title.toUpperCase();

    var meta = q('[data-pdp-meta]');
    if (meta) meta.textContent = productMeta();

    var title = q('[data-pdp-title]');
    if (title) title.textContent = product.title;

    var lead = q('[data-pdp-lead]');
    if (lead) {
      var short = firstSentence(plain, 190);
      lead.textContent = short;
      lead.hidden = !short;
    }

    var priceEl = q('[data-pdp-price]');
    if (priceEl) {
      priceEl.innerHTML = priceHTML(
        parseAmount(state.selected.price.amount),
        state.selected.compareAtPrice ? parseAmount(state.selected.compareAtPrice.amount) : 0,
        state.selected.price.currencyCode
      );
    }

    renderGallery();
    renderVariants();
    renderSpecs();
    renderDescription();
    updateBuyButton();
    updateStock();
    updateBadge();

    var loading = q('[data-pdp-loading]');
    if (loading) loading.hidden = true;
    var error = q('[data-pdp-error]');
    if (error) error.hidden = true;
    var main = q('[data-pdp-main]');
    if (main) main.hidden = false;
  }

  /* ---------- Interactions ---------- */
  function wire() {
    var select = q('[data-pdp-variant]');
    if (select) {
      select.addEventListener('change', function () { selectVariant(select.value); });
    }

    var thumbs = q('[data-pdp-thumbs]');
    if (thumbs) {
      thumbs.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-pdp-thumb]');
        if (!btn) return;
        var img = state.images[Number(btn.getAttribute('data-pdp-thumb'))];
        if (!img) return;
        setMainImage(img);
        Array.prototype.forEach.call(thumbs.querySelectorAll('[data-pdp-thumb]'), function (b) {
          b.classList.toggle('is-on', b === btn);
        });
      });
    }

    var qtyInput = q('[data-pdp-qty-input]');
    var addBtn = q('[data-add-to-cart]');

    function syncQty() {
      if (!qtyInput) return;
      var n = parseInt(qtyInput.value, 10);
      if (!isFinite(n) || n < 1) n = 1;
      if (n > 99) n = 99;
      qtyInput.value = String(n);
      if (addBtn) addBtn.setAttribute('data-qty', String(n));
    }

    document.addEventListener('click', function (e) {
      var step = e.target.closest && e.target.closest('[data-pdp-qty]');
      if (!step || !qtyInput) return;
      var current = parseInt(qtyInput.value, 10) || 1;
      qtyInput.value = String(step.getAttribute('data-pdp-qty') === 'inc' ? current + 1 : Math.max(1, current - 1));
      syncQty();
    });

    if (qtyInput) {
      qtyInput.addEventListener('input', syncQty);
      qtyInput.addEventListener('change', syncQty);
    }

    /* Après un ajout, main.js remet le libellé du bouton : on garde le bon texte. */
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        syncQty();
        setTimeout(function () {
          if (state.selected) {
            addBtn.textContent = state.selected.availableForSale ? 'Ajouter au panier' : 'Épuisé';
          }
        }, 1700);
      });
    }

    var retry = q('[data-pdp-retry]');
    if (retry) retry.addEventListener('click', load);
  }

  /* ---------- Chargement ---------- */
  function load() {
    if (!S) {
      showError('Boutique indisponible', 'Le module boutique n\'a pas pu être chargé. Rechargez la page ou écrivez-nous.', false);
      return;
    }

    var page = q('[data-product-page]');
    var params = new URLSearchParams(window.location.search);
    state.handle = params.get('handle') || (page && page.getAttribute('data-handle')) || '';

    if (!state.handle) {
      showError('Produit introuvable', 'Aucun produit n\'a été indiqué. Retournez au catalogue pour choisir un produit.', false);
      return;
    }

    if (!S.configured()) {
      showError('Boutique en ligne bientôt disponible', 'Le catalogue Shopify n\'est pas encore connecté. En attendant, écrivez-nous : nous vous conseillons le bon produit et vous donnons le prix.', false);
      return;
    }

    showLoading();

    Promise.all([
      S.graphql(PRODUCT_QUERY, { handle: state.handle }),
      S.graphql(RELATED_QUERY, {}).catch(function () { return null; })
    ]).then(function (results) {
      var data = results[0];
      var relatedData = results[1];
      var node = data && data.product;
      if (!node) {
        showError('Produit introuvable', 'Ce produit n\'existe pas ou n\'est plus disponible. Retournez au catalogue pour voir les produits actuels.', false);
        return;
      }

      var product = S.normalizeProduct(node);
      if (!product) {
        showError('Produit indisponible', 'Ce produit n\'a pas de variante disponible pour le moment.', false);
        return;
      }

      render(product);

      var related = [];
      if (relatedData && relatedData.products) {
        (relatedData.products.edges || []).forEach(function (edge) {
          var p = S.normalizeProduct(edge.node);
          if (p) related.push(p);
        });
      }
      renderRelated(related);
    }).catch(function (err) {
      console.error('[Artemis] Fiche produit indisponible :', err);
      showError('Produit momentanément indisponible', 'Impossible de charger ce produit pour le moment. Réessayez dans un instant ou écrivez-nous.', true);
    });
  }

  function init() {
    if (!q('[data-product-page]')) return;
    wire();
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
