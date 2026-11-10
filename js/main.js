/* =========================================================
   Artemis Coating — comportements du site
   Chaque module est indépendant : si un élément manque sur la
   page (menu non chargé, pas de formulaire…), les autres
   continuent de fonctionner.
   ========================================================= */
(function () {
  'use strict';

  function safe(name, fn) {
    try { fn(); } catch (err) { console.error('[Artemis] Module « ' + name + ' » :', err); }
  }

  /* ---------- 1. Formulaire de redirection (accueil) ----------
     Délégation d'événements : fonctionne même si le HTML est
     inséré ou remplacé après le chargement du script. */
  function initRouter() {
    if (window.__artemisRouter) return;
    window.__artemisRouter = true;

    function showStep(form, n) {
      var s1 = form.querySelector('#step-1'), s2 = form.querySelector('#step-2');
      var label = form.querySelector('#step-label'), bar2 = form.querySelector('#bar-2');
      if (s1) s1.hidden = n !== 1;
      if (s2) s2.hidden = n !== 2;
      if (label) label.textContent = 'Étape ' + n + ' / 2';
      if (bar2) bar2.classList.toggle('is-on', n === 2);
      var first = (n === 2 ? s2 : s1);
      first = first && first.querySelector('input');
      if (first) first.focus({ preventScroll: true });
    }

    function setStatus(form, text) {
      var st = form.querySelector('.router-status');
      if (!st) {
        st = document.createElement('p');
        st.className = 'router-status';
        st.setAttribute('role', 'status');
        form.appendChild(st);
      }
      st.textContent = text;
    }

    function choose(input) {
      var form = input.closest('#router');
      if (!form) return;
      // une seule case cochée par étape
      form.querySelectorAll('input[name="' + input.name + '"]').forEach(function (o) { o.checked = (o === input); });

      if (input.getAttribute('data-step') === '2') {
        setTimeout(function () { showStep(form, 2); }, 200);
        return;
      }
      var url = input.getAttribute('data-go');
      if (!url) return;
      var label = input.closest('.choice');
      label = label ? label.querySelector('strong') : null;
      setStatus(form, 'Redirection… ' + (label ? label.textContent : ''));
      setTimeout(function () { window.location.href = url; }, 300);
    }

    // « change » couvre clic, toucher et clavier (barre espace)
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.matches && t.matches('#router input[type="checkbox"]') && t.checked) choose(t);
    });

    // Bouton « Modifier » de l'étape 2
    document.addEventListener('click', function (e) {
      var back = e.target.closest && e.target.closest('#step-back');
      if (!back) return;
      var form = back.closest('#router');
      form.querySelectorAll('input').forEach(function (o) { o.checked = false; });
      var st = form.querySelector('.router-status'); if (st) st.textContent = '';
      showStep(form, 1);
    });

    // Retour arrière du navigateur : décocher (le navigateur garde parfois l'état coché)
    window.addEventListener('pageshow', function () {
      document.querySelectorAll('#router input').forEach(function (o) { o.checked = false; });
      var st = document.querySelector('#router .router-status'); if (st) st.textContent = '';
    });
  }

  /* ---------- 2. Barre de navigation collante ---------- */
  function initSticky() {
    var header = document.getElementById('header');
    if (!header) return;
    function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 40); }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 3. Menus déroulants (clic + clavier ; survol en CSS) ---------- */
  function initDropdowns() {
    var header = document.getElementById('header');
    var items = document.querySelectorAll('[data-dropdown]');
    if (!items.length) return;
    function closeAll() {
      items.forEach(function (i) {
        i.classList.remove('is-open');
        var b = i.querySelector('.nav-link'); if (b) b.setAttribute('aria-expanded', 'false');
      });
      if (header) header.classList.remove('has-open');
    }
    items.forEach(function (item) {
      var btn = item.querySelector('.nav-link');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var open = !item.classList.contains('is-open');
        closeAll();
        item.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
        if (header) header.classList.toggle('has-open', open);
      });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('[data-dropdown]')) closeAll(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
  }

  /* ---------- 4. Menu mobile ---------- */
  function initMobileMenu() {
    var menu = document.getElementById('mobile-menu');
    var burger = document.getElementById('burger');
    var close = document.getElementById('mm-close');
    if (!menu || !burger) return;
    function openMenu() { menu.classList.add('is-open'); burger.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; }
    function closeMenu() { menu.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; }
    burger.addEventListener('click', openMenu);
    if (close) close.addEventListener('click', closeMenu);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    menu.querySelectorAll('[data-acc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panel = document.getElementById(btn.getAttribute('data-acc'));
        var open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(open));
        if (panel) panel.classList.toggle('is-open', open);
        var pl = btn.querySelector('.plus'); if (pl) pl.textContent = open ? '−' : '+';
      });
    });
  }

  /* ---------- 5. Panier ----------
     Les produits sont enregistrés dans le localStorage du navigateur.
     Le même script gère l'ajout depuis la boutique, la pastille du menu
     et l'affichage de la page panier.html. */
  var CART_KEY = 'artemis-cart-v1';

  function cartRead() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) { return []; }
  }

  function cartWrite(list) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(list)); } catch (err) {}
    cartRefresh();
  }

  function cartCount() {
    return cartRead().reduce(function (sum, item) { return sum + (item.qty || 1); }, 0);
  }

  function cartMoney(value) {
    if (value == null || !isFinite(value)) return null;
    try {
      return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(value);
    } catch (err) { return value.toFixed(2) + ' $'; }
  }

  function cartParsePrice(text) {
    if (!text) return null;
    var match = String(text).replace(/\u00a0/g, ' ').match(/(\d+(?:[.,]\d+)?)/);
    if (!match) return null;
    var n = parseFloat(match[1].replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function cartUpdateBadges() {
    var count = cartCount();
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = String(count);
      el.hidden = count === 0;
      if (count > 0) {
        el.classList.remove('is-bump');
        void el.offsetWidth;
        el.classList.add('is-bump');
      }
    });
  }

  function cartEscape(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function cartProductFrom(btn) {
    var card = btn.closest('article');
    if (!card) return null;
    var nameEl = card.querySelector('h2');
    // Le premier span du bloc d'information (à côté du h2) est la catégorie,
    // pas la légende affichée sur l'image.
    var infoEl = nameEl ? nameEl.parentElement : card;
    var metaEl = infoEl ? infoEl.querySelector('span') : null;
    var imgEl = card.querySelector('img');
    var priceEl = btn.parentElement ? btn.parentElement.querySelector('span') : null;
    var image = imgEl ? imgEl.getAttribute('src') : '';
    var name = nameEl ? nameEl.textContent.replace(/\s+/g, ' ').trim() : 'Produit';
    var meta = metaEl ? metaEl.textContent.replace(/\s+/g, ' ').trim() : '';
    return {
      id: card.getAttribute('data-product-id') || image || ('p:' + name + '|' + meta),
      name: name,
      meta: meta,
      image: image,
      price: cartParsePrice(priceEl ? priceEl.textContent : '')
    };
  }

  function cartAdd(product) {
    if (!product) return;
    var list = cartRead();
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === product.id) { found = list[i]; break; }
    }
    if (found) {
      found.qty = (found.qty || 1) + 1;
      found.price = product.price;
      found.name = product.name;
      found.meta = product.meta;
      found.image = product.image;
    } else {
      list.push({
        id: product.id,
        name: product.name,
        meta: product.meta,
        image: product.image,
        price: product.price,
        qty: 1
      });
    }
    cartWrite(list);
    cartToast(product.name);
  }

  function cartAction(action, id) {
    var list = cartRead();
    if (action === 'clear') {
      list = [];
    } else {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id !== id) continue;
        if (action === 'inc') list[i].qty = (list[i].qty || 1) + 1;
        else if (action === 'dec') {
          list[i].qty = (list[i].qty || 1) - 1;
          if (list[i].qty < 1) list.splice(i, 1);
        } else if (action === 'remove') {
          list.splice(i, 1);
        }
        break;
      }
    }
    cartWrite(list);
  }

  function cartToast(name) {
    var toast = document.querySelector('.cart-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'cart-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.innerHTML = '<span class="cart-toast__text"></span><a href="panier.html">Voir le panier →</a>';
      document.body.appendChild(toast);
    }
    var text = toast.querySelector('.cart-toast__text');
    if (text) text.textContent = (name ? name + ' ajouté au panier' : 'Produit ajouté au panier');
    toast.classList.add('is-on');
    clearTimeout(cartToast._timer);
    cartToast._timer = setTimeout(function () { toast.classList.remove('is-on'); }, 2600);
  }

  function cartRender() {
    var itemsEl = document.querySelector('[data-cart-items]');
    if (!itemsEl) return;

    var list = cartRead();
    var count = list.reduce(function (sum, item) { return sum + (item.qty || 1); }, 0);
    var content = document.querySelector('[data-cart-content]');
    var empty = document.querySelector('[data-cart-empty]');
    var clearBtns = document.querySelectorAll('[data-cart-action="clear"]');

    document.querySelectorAll('[data-cart-count-label]').forEach(function (el) {
      el.textContent = String(count);
    });

    if (!list.length) {
      itemsEl.innerHTML = '';
      if (content) content.hidden = true;
      if (empty) empty.hidden = false;
      clearBtns.forEach(function (b) { b.hidden = true; });
      return;
    }

    if (content) content.hidden = false;
    if (empty) empty.hidden = true;
    clearBtns.forEach(function (b) { b.hidden = false; });

    itemsEl.innerHTML = list.map(function (item) {
      var qty = item.qty || 1;
      var unit = cartMoney(item.price);
      var line = item.price != null ? cartMoney(item.price * qty) : null;
      return '' +
        '<article class="cart-item">' +
          (item.image
            ? '<a class="cart-item__media" href="produits.html"><img src="' + cartEscape(item.image) + '" alt="' + cartEscape(item.name) + '" loading="lazy"></a>'
            : '<span class="cart-item__media cart-item__media--empty" aria-hidden="true"></span>') +
          '<div class="cart-item__info">' +
            (item.meta ? '<span class="cart-item__meta">' + cartEscape(item.meta) + '</span>' : '') +
            '<h2 class="cart-item__name">' + cartEscape(item.name) + '</h2>' +
            '<span class="cart-item__unit">' + (unit || 'Prix sur demande') + '</span>' +
            '<div class="cart-item__controls">' +
              '<div class="qty" role="group" aria-label="Quantité">' +
                '<button type="button" data-cart-action="dec" data-id="' + cartEscape(item.id) + '" aria-label="Diminuer la quantité">−</button>' +
                '<span aria-live="polite">' + qty + '</span>' +
                '<button type="button" data-cart-action="inc" data-id="' + cartEscape(item.id) + '" aria-label="Augmenter la quantité">+</button>' +
              '</div>' +
              '<button type="button" class="cart-item__remove" data-cart-action="remove" data-id="' + cartEscape(item.id) + '">Retirer</button>' +
            '</div>' +
          '</div>' +
          '<div class="cart-item__line">' + (line || '—') + '</div>' +
        '</article>';
    }).join('');

    var subtotal = 0;
    var allPriced = true;
    list.forEach(function (item) {
      if (item.price == null) allPriced = false;
      else subtotal += item.price * (item.qty || 1);
    });
    var total = allPriced ? cartMoney(subtotal) : null;
    var subtotalEl = document.querySelector('[data-cart-subtotal]');
    var totalEl = document.querySelector('[data-cart-total]');
    var noteEl = document.querySelector('[data-cart-note]');
    if (subtotalEl) subtotalEl.textContent = total || 'Sur demande';
    if (totalEl) totalEl.textContent = total || 'Sur demande';
    if (noteEl) noteEl.textContent = allPriced
      ? 'Taxes et livraison à confirmer.'
      : 'Certains prix sont à confirmer : nous vous enverrons une soumission détaillée.';
  }

  function cartRefresh() {
    cartUpdateBadges();
    if (document.querySelector('[data-cart-page]')) cartRender();
  }

  function initCart() {
    if (!window.__artemisCart) {
      window.__artemisCart = true;
      document.addEventListener('click', function (e) {
        var add = e.target.closest && e.target.closest('[data-add-to-cart]');
        if (add) {
          e.preventDefault();
          var product = cartProductFrom(add);
          if (product) {
            cartAdd(product);
            var original = add.getAttribute('data-label') || add.textContent;
            add.setAttribute('data-label', original);
            add.textContent = 'Ajouté ✓';
            add.classList.add('is-added');
            clearTimeout(add._cartTimer);
            add._cartTimer = setTimeout(function () {
              add.textContent = original;
              add.classList.remove('is-added');
            }, 1600);
          }
          return;
        }
        var action = e.target.closest && e.target.closest('[data-cart-action]');
        if (!action) return;
        var name = action.getAttribute('data-cart-action');
        if (name === 'clear') {
          if (window.confirm('Vider le panier ?')) cartAction('clear');
        } else {
          cartAction(name, action.getAttribute('data-id'));
        }
      });
      window.addEventListener('storage', function (e) {
        if (e.key === CART_KEY) cartRefresh();
      });
    }
    cartRefresh();
  }

  /* ---------- 6. Divers ---------- */
  function initMisc() {
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
    var v = document.querySelector('.hero__bg');
    if (v && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { v.removeAttribute('autoplay'); v.pause(); }
  }

  /* ---------- Démarrage ----------
     Le formulaire démarre tout de suite.
     Le menu et le pied de page démarrent quand ils sont présents :
     immédiatement (fichier unique) ou après leur insertion (version modulaire). */
  function startPage() { safe('formulaire', initRouter); safe('panier', initCart); safe('divers', initMisc); }
  function startLayout() {
    if (window.__artemisLayout) return;
    window.__artemisLayout = true;
    safe('barre collante', initSticky);
    safe('menus déroulants', initDropdowns);
    safe('menu mobile', initMobileMenu);
    safe('panier', initCart);
    safe('divers', initMisc);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startPage);
  else startPage();

  var usesIncludes = document.querySelector('[data-include]') && !window.__partialsLoaded;
  if (usesIncludes) document.addEventListener('partials:loaded', startLayout, { once: true });
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startLayout);
  else startLayout();
})();
