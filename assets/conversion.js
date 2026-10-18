/* ============================================================
   AVALIUM — Conversión: eventos de Analytics, barra de llamada
   en móvil y formularios cortos de contacto.

   - Los eventos se envían con gtag(), que define /assets/cookies.js.
     Si el visitante no ha aceptado las cookies analíticas, Google
     Analytics no se carga y los eventos no salen del navegador.
   - Nunca se envían a Analytics datos personales (nombre, teléfono,
     email): solo la página, la sección y rangos genéricos.

   Eventos (márcalos como "eventos clave" en GA4):
     generate_lead      -> formulario enviado con éxito (corto, contacto
                           o calculadora). Parámetro lead_source.
     click_to_call      -> pulsación en cualquier enlace tel:
     click_email        -> pulsación en cualquier enlace mailto:
   Eventos de apoyo (embudo):
     lead_form_start    -> primer campo tocado de un formulario
     cta_click          -> pulsación en un botón que lleva a /contacto
                           o a la calculadora
     calculator_start / calculator_result -> los lanza la calculadora
   ============================================================ */
(function () {
  'use strict';

  var TELEFONO = '+34614149465';
  var TELEFONO_VISIBLE = '614 149 465';
  // Hora límite (Madrid) para prometer la llamada "hoy" a un caso urgente
  var HORA_LIMITE_HOY = 17;

  /* ---------- Envío de eventos ---------- */
  function track(evento, params) {
    var p = params || {};
    p.page_path = p.page_path || location.pathname;
    try {
      if (typeof window.gtag === 'function') window.gtag('event', evento, p);
    } catch (e) { /* nunca romper la página por la analítica */ }
  }
  window.avaliumTrack = track;

  function ubicacion(el) {
    var marcado = el.closest('[data-track-location]');
    if (marcado) return marcado.getAttribute('data-track-location');
    if (el.closest('.mobile-cta-bar')) return 'barra_movil';
    if (el.closest('.top-bar')) return 'barra_superior';
    if (el.closest('.nav')) return 'cabecera';
    if (el.closest('.footer')) return 'pie';
    if (el.closest('.contact-info')) return 'contacto_datos';
    if (el.closest('.lead-success, .success-message')) return 'confirmacion';
    if (el.closest('.cta-section, .cta-band')) return 'cta_final';
    if (el.closest('.hero, .page-hero')) return 'cabecera_pagina';
    return 'contenido';
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/^tel:/i.test(href)) {
      track('click_to_call', { link_location: ubicacion(a) });
    } else if (/^mailto:/i.test(href)) {
      track('click_email', { link_location: ubicacion(a) });
    } else if (/(^|\/)(contacto|calculadora-garantia-aeat)(\.html)?(#.*)?$/.test(href) &&
               (a.classList.contains('btn') || a.classList.contains('pillar-link') || a.closest('.mobile-cta-bar'))) {
      track('cta_click', {
        link_location: ubicacion(a),
        cta_text: (a.textContent || '').replace(/\s+/g, ' ').replace('→', '').trim().slice(0, 80),
        cta_destination: href.replace(/^\//, '')
      });
    }
  }, true);

  /* ---------- Horario: ¿podemos prometer llamada hoy? ---------- */
  function ahoraMadrid() {
    try {
      var partes = new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid', weekday: 'short', hour: 'numeric', hour12: false
      }).formatToParts(new Date());
      var dia = '', hora = 0;
      partes.forEach(function (p) {
        if (p.type === 'weekday') dia = p.value.toLowerCase();
        if (p.type === 'hour') hora = parseInt(p.value, 10);
      });
      var laborable = !/^(sáb|sab|dom)/.test(dia);
      return { laborable: laborable, hora: hora };
    } catch (e) {
      var d = new Date();
      return { laborable: d.getDay() > 0 && d.getDay() < 6, hora: d.getHours() };
    }
  }
  function llamadaHoyPosible() {
    var m = ahoraMadrid();
    return m.laborable && m.hora >= 7 && m.hora < HORA_LIMITE_HOY;
  }
  window.avaliumLlamadaHoy = llamadaHoyPosible;

  /* ---------- Barra fija de llamada en móvil ---------- */
  function montarBarraMovil() {
    if (/^\/admin/.test(location.pathname)) return;
    if (document.querySelector('.mobile-cta-bar')) return;
    var irAFormulario = document.querySelector('[data-lead-form]') ? '#te-llamamos' : '/contacto#te-llamamos';
    var bar = document.createElement('div');
    bar.className = 'mobile-cta-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Contacto rápido');
    bar.innerHTML =
      '<a class="mcb-call" href="tel:' + TELEFONO + '" aria-label="Llamar ahora al ' + TELEFONO_VISIBLE + '">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
        '<span>Llamar ahora</span></a>' +
      '<a class="mcb-form" href="' + irAFormulario + '"><span>Te llamamos</span></a>';
    document.body.appendChild(bar);
    document.body.classList.add('has-mcb');
  }

  /* ---------- Formularios cortos ---------- */
  var URGENCIAS_SIN_PRISA = ['Sin urgencia inmediata'];

  function limpiarTelefono(t) { return String(t || '').replace(/[^\d+]/g, ''); }
  function telefonoValido(t) {
    var d = limpiarTelefono(t).replace(/^\+?34/, '').replace(/^0034/, '');
    // España: 9 dígitos empezando por 6, 7, 8 o 9. Internacional: 8-15 dígitos con prefijo +
    if (/^[6789]\d{8}$/.test(d)) return true;
    return /^\+\d{8,15}$/.test(limpiarTelefono(t));
  }
  function emailValido(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim()); }

  function escapar(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function marcarError(campo, mensaje) {
    var wrap = campo.closest('.lf-field') || campo.parentElement;
    if (wrap) wrap.classList.add('lf-invalid');
    campo.setAttribute('aria-invalid', 'true');
    return mensaje;
  }
  function limpiarErrores(form) {
    form.querySelectorAll('.lf-invalid').forEach(function (w) { w.classList.remove('lf-invalid'); });
    form.querySelectorAll('[aria-invalid]').forEach(function (c) { c.removeAttribute('aria-invalid'); });
    var err = form.querySelector('.lf-error');
    if (err) { err.hidden = true; err.textContent = ''; }
  }

  function validar(form) {
    var errores = [];
    var f = form.elements;
    if (!f.nombre.value.trim()) errores.push(marcarError(f.nombre, 'Indica tu nombre.'));
    if (!telefonoValido(f.telefono.value)) errores.push(marcarError(f.telefono, 'Revisa el teléfono (9 cifras, o con prefijo internacional).'));
    if (f.importe && !f.importe.value) errores.push(marcarError(f.importe, 'Elige el importe aproximado.'));
    if (f.urgencia && !f.urgencia.value) errores.push(marcarError(f.urgencia, 'Indica la urgencia.'));
    if (f.email && f.email.value.trim() && !emailValido(f.email.value)) errores.push(marcarError(f.email, 'Revisa el correo electrónico.'));
    if (f.acepta && !f.acepta.checked) errores.push(marcarError(f.acepta, 'Debes aceptar la política de privacidad.'));
    return errores;
  }

  function mensajeExito(urgente, telefono) {
    var tel = escapar(telefono);
    var cuando;
    if (urgente) {
      cuando = llamadaHoyPosible()
        ? '<strong>Te llamamos hoy</strong> al ' + tel + '.'
        : 'Te llamamos <strong>a primera hora del próximo día laborable</strong> al ' + tel + '.';
    } else {
      cuando = 'Te llamamos al ' + tel + ' en menos de <strong>48 horas laborables</strong>.';
    }
    return '<p class="lead-success-title">Solicitud recibida</p>' +
      '<p>' + cuando + ' Un profesional del equipo revisará tu caso antes de la llamada.</p>' +
      '<p class="lead-success-small">¿No puedes esperar? Llámanos ahora: <a href="tel:' + TELEFONO + '">' + TELEFONO_VISIBLE + '</a> (lunes a viernes, 8:00 a 19:00).</p>';
  }

  function prepararFormulario(form) {
    var empezado = false;
    var inicio = Date.now();
    var ubic = form.getAttribute('data-form-location') || 'formulario';

    form.addEventListener('focusin', function () {
      if (empezado) return;
      empezado = true;
      track('lead_form_start', { form_location: ubic });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      limpiarErrores(form);
      var errores = validar(form);
      var cajaError = form.querySelector('.lf-error');
      if (errores.length) {
        if (cajaError) { cajaError.textContent = errores[0]; cajaError.hidden = false; }
        var primero = form.querySelector('[aria-invalid="true"]');
        if (primero) primero.focus();
        return;
      }

      var datos = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.disabled) return;
        if (el.type === 'checkbox') { datos[el.name] = el.checked; return; }
        datos[el.name] = el.value;
      });
      datos.origen = location.pathname + ' · ' + ubic;
      datos.t = Date.now() - inicio;

      var boton = form.querySelector('button[type="submit"]');
      var textoBoton = boton ? boton.innerHTML : '';
      if (boton) { boton.disabled = true; boton.innerHTML = 'Enviando…'; }

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(datos)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, json: j }; });
      }).then(function (res) {
        if (!res.ok) throw new Error(res.json.error || 'No hemos podido enviar la solicitud.');
        var urgente = URGENCIAS_SIN_PRISA.indexOf(datos.urgencia) === -1;
        track('generate_lead', {
          lead_source: form.getAttribute('data-lead-source') || 'formulario_corto',
          form_location: ubic,
          urgencia: datos.urgencia || '',
          importe_rango: datos.importe || '',
          urgente: urgente ? 'si' : 'no'
        });
        var exito = document.createElement('div');
        exito.className = 'lead-success';
        exito.setAttribute('role', 'status');
        exito.setAttribute('tabindex', '-1');
        exito.innerHTML = mensajeExito(urgente, datos.telefono);
        form.parentNode.replaceChild(exito, form);
        exito.focus({ preventScroll: true });
        exito.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).catch(function (err) {
        if (boton) { boton.disabled = false; boton.innerHTML = textoBoton; }
        if (cajaError) {
          cajaError.innerHTML = escapar(err.message) + ' Si lo prefieres, llámanos al <a href="tel:' + TELEFONO + '">' + TELEFONO_VISIBLE + '</a>.';
          cajaError.hidden = false;
        }
      });
    });
  }

  function init() {
    montarBarraMovil();
    document.querySelectorAll('form[data-lead-form]').forEach(prepararFormulario);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
