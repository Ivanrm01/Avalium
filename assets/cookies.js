/* ============================================================
   AVALIUM — Gestor de consentimiento de cookies
   Conforme a: art. 22.2 LSSI-CE, arts. 6.1.a y 7 RGPD,
   Guía de cookies AEPD (jul. 2023, rev. may. 2024) y
   Directrices CEPD 03/2022 sobre patrones engañosos.

   Principios implementados:
   - Ninguna cookie no exenta se instala antes del consentimiento.
   - "Rechazar todas" en primera capa, mismo tamaño/peso que "Aceptar todas".
   - Granularidad por finalidad en la segunda capa.
   - Retirada del consentimiento tan fácil como su otorgamiento.
   - Registro probatorio: fecha, versión de la política y decisión.
   - Caducidad del consentimiento a los 12 meses.
   ============================================================ */
(function () {
  'use strict';

  var GA_ID = 'G-NFXW3NMEE7';
  var COOKIE_NAME = 'avalium_cookie_consent';
  var POLICY_VERSION = '2026-09-04';   // Subir al cambiar la política de cookies
  var MAX_AGE_DAYS = 365;              // Recabar de nuevo pasados 12 meses

  /* ---------- Utilidades de cookie ---------- */
  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; }
  }

  function writeCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 864e5);
    document.cookie = name + '=' + encodeURIComponent(JSON.stringify(value)) +
      ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax' +
      (location.protocol === 'https:' ? ';Secure' : '');
  }

  function deleteCookie(name) {
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.' + location.hostname;
  }

  /* ---------- Estado ---------- */
  function getConsent() {
    var c = readCookie(COOKIE_NAME);
    if (!c || c.v !== POLICY_VERSION) return null;
    if (!c.ts || (Date.now() - c.ts) > MAX_AGE_DAYS * 864e5) return null;
    return c;
  }

  function saveConsent(analytics, social) {
    var record = {
      v: POLICY_VERSION,
      ts: Date.now(),
      analytics: !!analytics,
      social: !!social
    };
    writeCookie(COOKIE_NAME, record, MAX_AGE_DAYS);
    return record;
  }

  /* ---------- Google Consent Mode v2 ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500
  });

  var gaLoaded = false;
  function loadAnalytics() {
    if (gaLoaded) return;
    gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
  }

  function purgeAnalyticsCookies() {
    document.cookie.split(';').forEach(function (raw) {
      var name = raw.split('=')[0].trim();
      if (/^_ga/.test(name) || name === '_gid' || /^_gat/.test(name)) deleteCookie(name);
    });
  }

  /* ---------- Contenido incrustado de terceros (LinkedIn / Instagram) ----------
     Marcar cualquier iframe o script social así para que quede bloqueado
     hasta que exista consentimiento:
       <div class="social-embed" data-embed-src="https://www.instagram.com/p/XXXX/embed"></div>
  --------------------------------------------------------------------------- */
  function loadSocialEmbeds() {
    document.querySelectorAll('[data-embed-src]').forEach(function (el) {
      if (el.dataset.loaded) return;
      var f = document.createElement('iframe');
      f.src = el.dataset.embedSrc;
      f.loading = 'lazy';
      f.style.cssText = 'width:100%;border:0;min-height:' + (el.dataset.embedHeight || '480') + 'px';
      f.setAttribute('title', el.dataset.embedTitle || 'Contenido de red social');
      el.innerHTML = '';
      el.appendChild(f);
      el.dataset.loaded = '1';
    });
  }

  function showSocialPlaceholders() {
    document.querySelectorAll('[data-embed-src]').forEach(function (el) {
      if (el.dataset.loaded) return;
      el.innerHTML =
        '<div class="embed-block">' +
        '<p>Este contenido procede de una red social externa e instala cookies de terceros. ' +
        'Para verlo debes aceptar las cookies de redes sociales.</p>' +
        '<button type="button" class="btn btn-primary btn-sm" data-cookie-accept-social>Aceptar y mostrar</button>' +
        '</div>';
    });
  }

  /* ---------- Aplicar decisión ---------- */
  function apply(consent) {
    gtag('consent', 'update', {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
      functionality_storage: consent.social ? 'granted' : 'denied',
      personalization_storage: consent.social ? 'granted' : 'denied'
    });

    if (consent.analytics) loadAnalytics(); else purgeAnalyticsCookies();
    if (consent.social) loadSocialEmbeds(); else showSocialPlaceholders();
  }

  /* ---------- Interfaz ---------- */
  var CSS = '\
#av-cookie-banner,#av-cookie-panel{position:fixed;z-index:9999;font-family:var(--font-body,system-ui,sans-serif);color:var(--ink,#15243B)}\
#av-cookie-banner{left:0;right:0;bottom:0;background:var(--cream,#F5EFE3);border-top:1px solid var(--line-strong,rgba(10,31,51,.25));box-shadow:0 -8px 32px rgba(10,31,51,.12);padding:1.5rem var(--pad,1.5rem)}\
.av-cookie-inner{max-width:var(--maxw,1280px);margin:0 auto;display:flex;gap:1.75rem;align-items:center;flex-wrap:wrap}\
.av-cookie-text{flex:1 1 340px;min-width:0}\
.av-cookie-text h2{font-family:var(--font-display,serif);font-weight:400;font-size:1.15rem;margin:0 0 .4rem;color:var(--navy,#0A1F33)}\
.av-cookie-text p{font-size:.88rem;line-height:1.6;color:var(--navy-soft,#1A3247);margin:0}\
.av-cookie-text a{color:var(--terracotta,#C75D2C);border-bottom:1px solid currentColor}\
.av-cookie-actions{display:flex;gap:.65rem;flex-wrap:wrap;flex-shrink:0}\
.av-btn{font-family:inherit;font-size:.85rem;font-weight:500;letter-spacing:.02em;padding:.75rem 1.5rem;border:1px solid var(--navy,#0A1F33);border-radius:2px;cursor:pointer;background:transparent;color:var(--navy,#0A1F33);transition:opacity .15s;min-width:150px;text-align:center}\
.av-btn:hover{opacity:.75}\
.av-btn-solid{background:var(--navy,#0A1F33);color:var(--cream,#F5EFE3)}\
.av-btn-link{border:none;min-width:0;text-decoration:underline;padding:.75rem .5rem}\
#av-cookie-panel{inset:0;background:rgba(10,31,51,.55);display:flex;align-items:center;justify-content:center;padding:1.25rem;overflow-y:auto}\
.av-panel-box{background:var(--cream,#F5EFE3);max-width:660px;width:100%;max-height:88vh;overflow-y:auto;padding:2rem;border-radius:3px}\
.av-panel-box h2{font-family:var(--font-display,serif);font-weight:400;font-size:1.45rem;color:var(--navy,#0A1F33);margin:0 0 .75rem}\
.av-panel-box>p{font-size:.88rem;line-height:1.65;color:var(--navy-soft,#1A3247);margin:0 0 1.5rem}\
.av-cat{border-top:1px solid var(--line,rgba(10,31,51,.12));padding:1.1rem 0;display:flex;gap:1rem;align-items:flex-start}\
.av-cat-body{flex:1}\
.av-cat h3{font-size:.95rem;font-weight:600;margin:0 0 .3rem;color:var(--navy,#0A1F33)}\
.av-cat p{font-size:.82rem;line-height:1.55;color:var(--muted,#6B6F75);margin:0}\
.av-cat input{width:20px;height:20px;margin-top:.15rem;accent-color:var(--terracotta,#C75D2C);flex-shrink:0}\
.av-cat input:disabled{opacity:.45}\
.av-panel-actions{display:flex;gap:.65rem;flex-wrap:wrap;margin-top:1.5rem;padding-top:1.25rem;border-top:1px solid var(--line,rgba(10,31,51,.12))}\
#av-cookie-reopen{position:fixed;left:1rem;bottom:1rem;z-index:9990;background:var(--navy,#0A1F33);color:var(--cream,#F5EFE3);border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;box-shadow:0 4px 14px rgba(10,31,51,.28);border:none;cursor:pointer}\
.embed-block{border:1px dashed var(--line-strong,rgba(10,31,51,.25));padding:1.5rem;text-align:center;background:var(--cream-deep,#EDE5D3)}\
.embed-block p{font-size:.85rem;color:var(--navy-soft,#1A3247);margin:0 0 .9rem}\
@media(max-width:720px){.av-cookie-inner{flex-direction:column;align-items:stretch}.av-cookie-actions{flex-direction:column}.av-btn{width:100%}}';

  function injectCSS() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function buildBanner() {
    var d = document.createElement('div');
    d.id = 'av-cookie-banner';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-live', 'polite');
    d.setAttribute('aria-label', 'Consentimiento de cookies');
    d.innerHTML = '\
<div class="av-cookie-inner">\
  <div class="av-cookie-text">\
    <h2>Cookies en avalium.es</h2>\
    <p>Utilizamos cookies propias necesarias para el funcionamiento del sitio y, solo si lo autorizas, cookies analíticas de Google Analytics (Google Ireland Ltd., con transferencia a EE. UU.) para medir el uso de la web. No instalamos ninguna cookie no necesaria sin tu consentimiento. Puedes aceptarlas, rechazarlas o elegir por categorías. Más información en la <a href="/legal/cookies">política de cookies</a>.</p>\
  </div>\
  <div class="av-cookie-actions">\
    <button type="button" class="av-btn" data-av="reject">Rechazar todas</button>\
    <button type="button" class="av-btn" data-av="config">Configurar</button>\
    <button type="button" class="av-btn av-btn-solid" data-av="accept">Aceptar todas</button>\
  </div>\
</div>';
    document.body.appendChild(d);
    return d;
  }

  function buildPanel(current) {
    var c = current || { analytics: false, social: false };
    var d = document.createElement('div');
    d.id = 'av-cookie-panel';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.setAttribute('aria-label', 'Configuración de cookies');
    d.innerHTML = '\
<div class="av-panel-box">\
  <h2>Configuración de cookies</h2>\
  <p>Las cookies no necesarias están desactivadas por defecto. Activa únicamente las categorías que quieras autorizar. Puedes cambiar esta decisión cuando quieras desde el enlace «Configurar cookies» del pie de página.</p>\
  <div class="av-cat">\
    <input type="checkbox" checked disabled aria-label="Cookies técnicas, siempre activas">\
    <div class="av-cat-body">\
      <h3>Técnicas o necesarias (siempre activas)</h3>\
      <p>Imprescindibles para que el sitio funcione y para recordar tu decisión sobre cookies. Exentas de consentimiento conforme al art. 22.2 LSSI-CE.</p>\
    </div>\
  </div>\
  <div class="av-cat">\
    <input type="checkbox" id="av-c-analytics" ' + (c.analytics ? 'checked' : '') + '>\
    <div class="av-cat-body">\
      <h3>Analíticas</h3>\
      <p>Google Analytics 4 (Google Ireland Ltd.). Miden páginas vistas y comportamiento agregado para mejorar el sitio. Implican transferencia internacional a EE. UU. amparada en el Marco de Privacidad de Datos UE-EE. UU. Duración máxima: 24 meses.</p>\
    </div>\
  </div>\
  <div class="av-cat">\
    <input type="checkbox" id="av-c-social" ' + (c.social ? 'checked' : '') + '>\
    <div class="av-cat-body">\
      <h3>Redes sociales y contenido incrustado</h3>\
      <p>Permiten mostrar publicaciones de LinkedIn e Instagram integradas en la web. Las gestionan LinkedIn Ireland Unlimited Company y Meta Platforms Ireland Ltd., que pueden instalar sus propias cookies de seguimiento.</p>\
    </div>\
  </div>\
  <div class="av-panel-actions">\
    <button type="button" class="av-btn" data-av="reject">Rechazar todas</button>\
    <button type="button" class="av-btn" data-av="save">Guardar preferencias</button>\
    <button type="button" class="av-btn av-btn-solid" data-av="accept">Aceptar todas</button>\
  </div>\
</div>';
    document.body.appendChild(d);
    return d;
  }

  function buildReopen() {
    if (document.getElementById('av-cookie-reopen')) return;
    var b = document.createElement('button');
    b.id = 'av-cookie-reopen';
    b.type = 'button';
    b.setAttribute('aria-label', 'Configurar cookies');
    b.title = 'Configurar cookies';
    b.textContent = '⚙';
    b.addEventListener('click', function () { openPanel(); });
    document.body.appendChild(b);
  }

  /* ---------- Flujo ---------- */
  var bannerEl = null, panelEl = null;

  function closeBanner() { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }
  function closePanel() { if (panelEl) { panelEl.remove(); panelEl = null; } }

  function decide(analytics, social) {
    var record = saveConsent(analytics, social);
    apply(record);
    closeBanner();
    closePanel();
    buildReopen();
  }

  function openPanel() {
    closePanel();
    panelEl = buildPanel(getConsent());
    panelEl.addEventListener('click', function (e) {
      var action = e.target.getAttribute && e.target.getAttribute('data-av');
      if (action === 'accept') decide(true, true);
      if (action === 'reject') decide(false, false);
      if (action === 'save') {
        decide(
          document.getElementById('av-c-analytics').checked,
          document.getElementById('av-c-social').checked
        );
      }
      if (e.target === panelEl && getConsent()) closePanel();
    });
  }

  function openBanner() {
    bannerEl = buildBanner();
    bannerEl.addEventListener('click', function (e) {
      var action = e.target.getAttribute && e.target.getAttribute('data-av');
      if (action === 'accept') decide(true, true);
      if (action === 'reject') decide(false, false);
      if (action === 'config') openPanel();
    });
  }

  function init() {
    injectCSS();

    // Enlaces "Configurar cookies" del pie de página / política
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
      if (t) { e.preventDefault(); openPanel(); }
      if (e.target.hasAttribute && e.target.hasAttribute('data-cookie-accept-social')) {
        var cur = getConsent() || { analytics: false };
        decide(cur.analytics, true);
      }
    });

    var consent = getConsent();
    if (consent) {
      apply(consent);
      buildReopen();
    } else {
      apply({ analytics: false, social: false });   // bloquea todo mientras no decida
      openBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
