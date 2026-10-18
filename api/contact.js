import {
  esc, campo, emailValido, telefonoValido, leerCuerpo, quiereJson, pareceBot,
  limiteSuperado, enviar, remitente, destinoInterno, paginaRespuesta, TELEFONO, TELEFONO_VISIBLE,
} from './_lib/mail.js';

const IMPORTES = [
  'Menos de 50.000 €', '50.000 € - 200.000 €', '200.000 € - 500.000 €',
  '500.000 € - 1.000.000 €', 'Más de 1.000.000 €',
];
const URGENCIAS = [
  'Embargos en curso', 'Providencia de apremio recibida', 'Plazo de recurso abierto', 'Sin urgencia inmediata',
];

// ¿Se puede prometer la llamada hoy? Lunes a viernes antes de las 17:00 (hora de Madrid)
function llamadaHoyPosible() {
  const partes = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', weekday: 'short', hour: 'numeric', hour12: false,
  }).formatToParts(new Date());
  const dia = (partes.find((p) => p.type === 'weekday') || {}).value || '';
  const hora = parseInt((partes.find((p) => p.type === 'hour') || {}).value || '0', 10);
  return !/^(sáb|sab|dom)/i.test(dia) && hora >= 7 && hora < 17;
}

function fila(etiqueta, valor, destacar) {
  return `<tr><td style="padding:10px 0;border-bottom:1px solid #ddd;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#888;width:160px;vertical-align:top">${etiqueta}</td><td style="padding:10px 0;border-bottom:1px solid #ddd;font-size:15px;${destacar ? 'color:#C75D2C;font-weight:bold;' : ''}">${valor}</td></tr>`;
}

export default async function handler(req, res) {
  const json = quiereJson(req);
  const responder = (codigo, cuerpo, titulo, texto) => {
    if (json) return res.status(codigo).json(cuerpo);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(codigo).send(paginaRespuesta(titulo, texto));
  };

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const d = leerCuerpo(req);

  // Bots: respondemos "ok" para no darles pistas, pero no enviamos nada
  if (pareceBot(d)) {
    return responder(200, { ok: true }, 'Solicitud recibida', 'Gracias. Te contactaremos en breve.');
  }
  if (limiteSuperado(req, 5, 10 * 60 * 1000)) {
    return responder(429, { error: 'Demasiados envíos seguidos. Inténtalo en unos minutos o llámanos.' },
      'Demasiados envíos', `Inténtalo en unos minutos o llámanos al <a href="tel:${TELEFONO}">${TELEFONO_VISIBLE}</a>.`);
  }

  const nombre = campo(d.nombre, 120);
  const telefono = campo(d.telefono, 25);
  const email = campo(d.email, 160);
  const empresa = campo(d.empresa, 160);
  const tipo = campo(d.tipo, 120);
  const importe = IMPORTES.includes(d.importe) ? d.importe : campo(d.importe, 60);
  const urgencia = URGENCIAS.includes(d.urgencia) ? d.urgencia : campo(d.urgencia, 60);
  const mensaje = campo(d.mensaje, 5000);
  const origen = campo(d.origen, 200);
  const acepta = d.acepta === true || d.acepta === 'true' || d.acepta === '1' || d.acepta === 'on';

  // Validación: el formulario corto pide nombre, teléfono, importe y urgencia.
  // El email es opcional (si llega, tiene que ser válido).
  if (!nombre) return responder(400, { error: 'Indica tu nombre.' }, 'Falta un dato', 'Indica tu nombre y vuelve a enviar el formulario.');
  if (!telefonoValido(telefono) && !emailValido(email)) {
    return responder(400, { error: 'Indica un teléfono válido para poder llamarte.' }, 'Falta un dato', 'Indica un teléfono válido para poder llamarte.');
  }
  if (email && !emailValido(email)) return responder(400, { error: 'Revisa el correo electrónico.' }, 'Revisa el correo', 'El correo electrónico no es válido.');
  if (!acepta) return responder(400, { error: 'Debes aceptar la política de privacidad.' }, 'Falta la aceptación', 'Debes aceptar la política de privacidad.');

  const urgente = urgencia && urgencia !== 'Sin urgencia inmediata';
  const hoy = llamadaHoyPosible();
  const prefijo = urgente ? (hoy ? '🔴 URGENTE · LLAMAR HOY — ' : '🔴 URGENTE · llamar a primera hora — ') : '';

  const filas = [
    fila('Nombre', esc(nombre)),
    telefono ? fila('Teléfono', `<a href="tel:${esc(telefono.replace(/[^\d+]/g, ''))}" style="color:#C75D2C">${esc(telefono)}</a>`) : '',
    email ? fila('Email', `<a href="mailto:${esc(email)}" style="color:#C75D2C">${esc(email)}</a>`) : '',
    empresa ? fila('Empresa', esc(empresa)) : '',
    tipo ? fila('Tipo', esc(tipo)) : '',
    fila('Importe', esc(importe || '—')),
    fila('Urgencia', esc(urgencia || '—'), urgente),
    origen ? fila('Origen', esc(origen)) : '',
  ].join('');

  const correoInterno = {
    from: remitente('Formulario Avalium'),
    to: destinoInterno(),
    replyTo: email || undefined,
    subject: `${prefijo}Nueva solicitud — ${nombre}${importe ? ' · ' + importe : ''}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#0A1F33">
        <div style="background:${urgente ? '#C75D2C' : '#0A1F33'};padding:24px 32px">
          <h1 style="color:#FAF6EE;font-size:20px;margin:0;font-weight:400;letter-spacing:.05em">AVALIUM · ${urgente ? (hoy ? 'Caso urgente: llamar hoy' : 'Caso urgente: llamar a primera hora') : 'Nueva solicitud'}</h1>
        </div>
        <div style="padding:32px;background:#FAF6EE">
          <table style="width:100%;border-collapse:collapse">${filas}</table>
          ${mensaje ? `<div style="margin-top:24px;padding:20px;background:#fff;border-left:3px solid #C75D2C"><p style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#888;margin:0 0 10px">Mensaje</p><p style="font-size:15px;line-height:1.7;margin:0;white-space:pre-wrap">${esc(mensaje)}</p></div>` : ''}
          ${telefono ? `<div style="margin-top:24px;text-align:center"><a href="tel:${esc(telefono.replace(/[^\d+]/g, ''))}" style="display:inline-block;background:#C75D2C;color:#fff;padding:12px 28px;text-decoration:none;font-size:14px;letter-spacing:.05em">Llamar a ${esc(nombre)}</a></div>` : ''}
        </div>
      </div>`,
  };

  // Confirmación al cliente solo si ha dejado email
  const cuando = urgente
    ? (hoy ? 'hoy mismo' : 'a primera hora del próximo día laborable')
    : 'en menos de 48 horas laborables';
  const correoCliente = email ? {
    from: remitente('Avalium Consulting Group'),
    to: email,
    replyTo: destinoInterno(),
    subject: 'Hemos recibido tu solicitud — Avalium',
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#0A1F33">
        <div style="background:#0A1F33;padding:24px 32px"><h1 style="color:#FAF6EE;font-size:20px;margin:0;font-weight:400;letter-spacing:.05em">AVALIUM</h1></div>
        <div style="padding:40px 32px;background:#FAF6EE">
          <p style="font-size:17px;line-height:1.6;margin:0 0 20px">Hola ${esc(nombre)},</p>
          <p style="font-size:15px;line-height:1.7;color:#1A3247;margin:0 0 20px">Hemos recibido tu solicitud. Un profesional del equipo te llamará <strong>${cuando}</strong>${telefono ? ' al ' + esc(telefono) : ''}.</p>
          <p style="font-size:14px;line-height:1.7;color:#1A3247;margin:0 0 8px">Si no puedes esperar, llámanos:</p>
          <p style="font-size:18px;margin:0"><a href="tel:${TELEFONO}" style="color:#C75D2C;text-decoration:none">${TELEFONO_VISIBLE}</a></p>
        </div>
        <div style="padding:20px 32px;background:#0A1F33"><p style="color:rgba(250,246,238,.6);font-size:11px;margin:0;line-height:1.6">Avalium Consulting Group, S.L. · Madrid | Castellón · info@avalium.es</p></div>
      </div>`,
  } : null;

  try {
    await enviar(correoInterno);
    if (correoCliente) {
      // Si falla la confirmación al cliente, la solicitud ya nos ha llegado: no devolvemos error
      try { await enviar(correoCliente); } catch (e) { console.error('Confirmación al cliente no enviada:', e.message); }
    }
    return responder(200, { ok: true, urgente: !!urgente, hoy },
      'Solicitud recibida',
      `Te llamaremos ${cuando}. Si no puedes esperar, llámanos al <a href="tel:${TELEFONO}">${TELEFONO_VISIBLE}</a>.`);
  } catch (error) {
    console.error('Error enviando email:', error);
    return responder(500, { error: 'No hemos podido enviar la solicitud.' },
      'No se ha podido enviar', `Llámanos al <a href="tel:${TELEFONO}">${TELEFONO_VISIBLE}</a> o escríbenos a info@avalium.es.`);
  }
}
