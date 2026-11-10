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

  /* ---------- 5. Divers ---------- */
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
  function startPage() { safe('formulaire', initRouter); safe('divers', initMisc); }
  function startLayout() {
    if (window.__artemisLayout) return;
    window.__artemisLayout = true;
    safe('barre collante', initSticky);
    safe('menus déroulants', initDropdowns);
    safe('menu mobile', initMobileMenu);
    safe('divers', initMisc);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startPage);
  else startPage();

  var usesIncludes = document.querySelector('[data-include]') && !window.__partialsLoaded;
  if (usesIncludes) document.addEventListener('partials:loaded', startLayout, { once: true });
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startLayout);
  else startLayout();
})();
