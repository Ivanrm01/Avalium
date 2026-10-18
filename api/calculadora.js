// Envía por email el informe de la calculadora pública y avisa a Avalium del nuevo contacto.
// El cálculo se repite aquí con el mismo motor que usa la web (assets/calc-garantias.js),
// de modo que el informe nunca depende de lo que diga el navegador.

import Calc from '../assets/calc-garantias.js';
import {
  esc, campo, emailValido, telefonoValido, leerCuerpo, pareceBot, limiteSuperado,
  enviar, remitente, destinoInterno, TELEFONO, TELEFONO_VISIBLE,
} from './_lib/mail.js';

const fmt = (x) => Calc.fmt(x);
const pct = (x) => Calc.pct(x);

function filaTabla(concepto, importe, fuerte) {
  return `<tr><td style="padding:9px 0;border-bottom:1px solid #e3dccd;font-size:14px;color:${fuerte ? '#0A1F33' : '#1A3247'};${fuerte ? 'font-weight:bold;' : ''}">${concepto}</td><td style="padding:9px 0;border-bottom:1px solid #e3dccd;font-size:14px;text-align:right;white-space:nowrap;${fuerte ? 'font-weight:bold;color:#0A1F33;' : ''}">${importe}</td></tr>`;
}

function bloque(titulo, contenido) {
  return `<h2 style="font-family:Georgia,serif;font-weight:400;font-size:19px;color:#0A1F33;margin:32px 0 12px">${titulo}</h2>${contenido}`;
}

function listaAvisos(avisos) {
  if (!avisos.length) return '';
  return `<ul style="padding-left:18px;margin:0">${avisos.map((a) => `<li style="font-size:14px;line-height:1.6;color:${a.nivel === 'alto' ? '#A84A1F' : '#1A3247'};margin-bottom:8px">${esc(a.texto)}</li>`).join('')}</ul>`;
}

function documentacion(r) {
  const docs = r.modo === 'suspension'
    ? [
      'Copia del acto recurrido (liquidación, derivación o providencia) y del recurso o reclamación presentados.',
      'Escritura de hipoteca unilateral a favor de la AEAT (o documento de la garantía) e inscripción en el Registro.',
      'Tasación por sociedad o profesional inscrito en el registro oficial de tasadores (obligatorio en suspensiones).',
      'Nota simple actualizada del inmueble y, si hay cargas, certificado del saldo pendiente.',
      'Justificación de que no puedes obtener aval bancario ni seguro de caución (denegaciones por escrito).',
    ]
    : [
      'Solicitud de aplazamiento o fraccionamiento en la Sede electrónica con la propuesta de plazos.',
      'Justificación de la dificultad transitoria de tesorería (balance, previsión de cobros, extractos).',
      'Compromiso de constitución de la garantía o la garantía ya formalizada (hipoteca unilateral inscrita, aval…).',
      'Tasación del inmueble (preferentemente por tasador inscrito; ya no es obligatorio en aplazamientos).',
      'Si ofreces hipoteca: denegaciones de aval de al menos dos entidades financieras.',
      'Si es IVA u otro tributo repercutido: prueba de que las cuotas repercutidas no se han cobrado.',
    ];
  return `<ol style="padding-left:18px;margin:0">${docs.map((t) => `<li style="font-size:14px;line-height:1.6;color:#1A3247;margin-bottom:6px">${t}</li>`).join('')}</ol>`;
}

function informeHtml(r, nombre) {
  const e = r.entrada;
  let resumen = '';
  let desglose = '';
  let calendario = '';

  if (r.modo === 'suspension') {
    resumen = `
      ${filaTabla('Importe recurrido', fmt(e.deuda))}
      ${r.sancionesExcluidas ? filaTabla('Sanciones (suspendidas sin garantía)', '− ' + fmt(r.sancionesExcluidas)) : ''}
      ${filaTabla('Vía', esc(r.etiquetas.via) + (e.reposicionPrevia ? ' (con reposición previa)' : ''))}
      ${filaTabla('Garantía', esc(r.etiquetas.garantia))}
      ${filaTabla('Tipo de suspensión', r.automatica ? 'Automática (art. 233.2 LGT)' : 'Con otras garantías (art. 233.3 LGT)')}`;
    desglose = `
      ${filaTabla('Deuda a garantizar', fmt(r.base))}
      ${filaTabla(`Intereses (${pct(r.tipoInteres)} · ${r.meses} meses)`, fmt(r.intereses))}
      ${filaTabla('Recargo si se ejecuta la garantía (20 %)', fmt(r.recargo))}
      ${filaTabla('IMPORTE A GARANTIZAR', fmt(r.importeGarantizar), true)}`;
  } else {
    resumen = `
      ${filaTabla('Deuda', fmt(e.deuda))}
      ${e.otrasDeudas ? filaTabla('Otras deudas computables', fmt(e.otrasDeudas)) : ''}
      ${filaTabla('Situación', e.periodo === 'ejecutivo' ? 'Periodo ejecutivo' : 'Periodo voluntario')}
      ${filaTabla('Forma de pago', e.modalidad === 'aplazamiento' ? `Pago único a ${e.meses} meses` : `${e.meses} cuotas mensuales`)}
      ${filaTabla('Garantía', r.exento ? 'No se exige (≤ 50.000 €)' : esc(r.etiquetas.garantia))}
      ${filaTabla('Plazo máximo habitual', r.plazoMax + ' meses')}
      ${filaTabla('Tipo de interés', pct(r.tipoInteres) + (r.interesLegal ? ' (interés legal)' : ' (interés de demora)'))}`;
    desglose = r.exento
      ? `${filaTabla('Garantía', 'Exento de garantía', true)}${filaTabla('Intereses estimados del aplazamiento', fmt(r.intereses))}${r.recargo ? filaTabla('Recargo del periodo ejecutivo (20 %)', fmt(r.recargo)) : ''}${filaTabla('Total a pagar estimado', fmt(r.totalAPagar), true)}`
      : `
      ${filaTabla('Deuda', fmt(e.deuda))}
      ${r.recargo ? filaTabla('Recargo del periodo ejecutivo (20 %)', fmt(r.recargo)) : ''}
      ${filaTabla(`Intereses (${pct(r.tipoInteres)})`, fmt(r.intereses))}
      ${filaTabla(`Margen exigido (${r.margenPct} %)`, fmt(r.margen))}
      ${filaTabla(r.dispensa ? 'IMPORTE A GARANTIZAR SI NO SE CONCEDE LA DISPENSA' : 'IMPORTE A GARANTIZAR', fmt(r.importeGarantizar), true)}`;

    const filasCal = r.cuadro.map((c) => `<tr>
        <td style="padding:6px 4px;border-bottom:1px solid #eee;font-size:12.5px">${e.modalidad === 'aplazamiento' ? 'Pago único · mes ' + c.mes : 'Cuota ' + c.n}</td>
        <td style="padding:6px 4px;border-bottom:1px solid #eee;font-size:12.5px;text-align:right">${fmt(c.principal + c.recargo)}</td>
        <td style="padding:6px 4px;border-bottom:1px solid #eee;font-size:12.5px;text-align:right">${fmt(c.intereses)}</td>
        <td style="padding:6px 4px;border-bottom:1px solid #eee;font-size:12.5px;text-align:right;font-weight:bold">${fmt(c.total)}</td></tr>`).join('');
    calendario = bloque('Calendario estimado de pagos', `
      <table style="width:100%;border-collapse:collapse">
        <tr><th style="text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#888;padding:6px 4px">Plazo</th><th style="text-align:right;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#888;padding:6px 4px">Deuda${r.recargo ? ' + recargo' : ''}</th><th style="text-align:right;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#888;padding:6px 4px">Intereses</th><th style="text-align:right;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#888;padding:6px 4px">Total</th></tr>
        ${filasCal}
      </table>
      <p style="font-size:12px;color:#6B6F75;margin:10px 0 0">Meses contados desde hoy${e.mesesTranscurridos ? ` más ${e.mesesTranscurridos} meses ya transcurridos desde el fin del periodo voluntario` : ''}. La AEAT calcula los intereses por días hasta cada vencimiento; las cifras finales pueden variar ligeramente.</p>`);
  }

  const bien = r.bien ? bloque('Inmueble que necesitas', `
    <table style="width:100%;border-collapse:collapse">
      ${filaTabla('Cobertura exigida', Math.round(r.bien.cobertura * 100) + ' % del importe a garantizar')}
      ${r.bien.cargas ? filaTabla('Cargas previas que se descuentan', fmt(r.bien.cargas)) : ''}
      ${filaTabla('VALOR MÍNIMO DE TASACIÓN', fmt(r.bien.tasacionMinima) + (r.bien.estricto ? ' (y algo más)' : ''), true)}
    </table>`) : '';

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#0A1F33;background:#FAF6EE">
    <div style="background:#0A1F33;padding:24px 32px">
      <p style="color:#B8895C;font-size:11px;letter-spacing:.18em;text-transform:uppercase;margin:0 0 6px">Informe de la calculadora</p>
      <h1 style="font-family:Georgia,serif;color:#FAF6EE;font-size:22px;margin:0;font-weight:400">${r.modo === 'suspension' ? 'Garantía para suspender la deuda' : 'Garantía para aplazar o fraccionar la deuda'}</h1>
    </div>
    <div style="padding:28px 32px">
      <p style="font-size:15px;line-height:1.6;margin:0 0 6px">Hola${nombre ? ' ' + esc(nombre) : ''},</p>
      <p style="font-size:15px;line-height:1.6;margin:0;color:#1A3247">Aquí tienes el detalle del cálculo que has hecho en avalium.es, con la normativa vigente en ${Calc.NORMATIVA.revision}.</p>
      <div style="background:#fff;border-left:3px solid #C75D2C;padding:18px 20px;margin:24px 0 0">
        <p style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#888;margin:0 0 6px">${r.modo !== 'suspension' && r.exento ? 'Resultado' : (r.dispensa ? 'Garantía si no se concede la dispensa' : 'Importe a garantizar')}</p>
        <p style="font-family:Georgia,serif;font-size:30px;margin:0;color:#0A1F33">${r.modo !== 'suspension' && r.exento ? 'No necesitas garantía' : fmt(r.importeGarantizar)}</p>
        ${r.bien ? `<p style="font-size:14px;margin:8px 0 0;color:#A84A1F">Valor mínimo de tasación del inmueble: <strong>${fmt(r.bien.tasacionMinima)}</strong></p>` : ''}
      </div>
      ${bloque('Datos del cálculo', `<table style="width:100%;border-collapse:collapse">${resumen}</table>`)}
      ${bloque('Desglose', `<table style="width:100%;border-collapse:collapse">${desglose}</table>`)}
      ${bien}
      ${calendario}
      ${bloque('A tener en cuenta', listaAvisos(r.avisos))}
      ${bloque('Documentación que te pedirán', documentacion(r))}
      ${bloque('Normativa aplicada', `<ul style="padding-left:18px;margin:0">${r.fundamentos.map((f) => `<li style="font-size:13px;line-height:1.6;color:#1A3247">${esc(f)}</li>`).join('')}</ul>`)}
      <div style="background:#0A1F33;padding:22px 24px;margin:32px 0 0;text-align:center">
        <p style="font-family:Georgia,serif;color:#FAF6EE;font-size:18px;margin:0 0 8px">¿Lo revisamos juntos?</p>
        <p style="color:rgba(250,246,238,.8);font-size:14px;line-height:1.6;margin:0 0 16px">Un abogado del equipo comprueba gratis si tu inmueble sirve y cómo presentar la solicitud. Si hay embargos o un plazo corriendo, te llamamos hoy.</p>
        <a href="tel:${TELEFONO}" style="display:inline-block;background:#C75D2C;color:#fff;padding:12px 26px;text-decoration:none;font-size:14px">Llamar al ${TELEFONO_VISIBLE}</a>
        <p style="color:rgba(250,246,238,.7);font-size:13px;margin:12px 0 0">o responde a este correo</p>
      </div>
      <p style="font-size:11.5px;line-height:1.6;color:#6B6F75;margin:24px 0 0">Cálculo orientativo elaborado con la normativa vigente en ${Calc.NORMATIVA.revision}. No sustituye al análisis del expediente ni constituye asesoramiento jurídico: la cuantía exacta la fija la AEAT o el órgano que resuelva. Avalium Consulting Group, S.L. · B-27525328 · C/ Juan Álvarez Mendizábal, 57, 4.º, 28008 Madrid. Recibes este correo porque lo has solicitado en avalium.es; tus datos se tratan conforme a nuestra política de privacidad (avalium.es/legal/privacidad).</p>
    </div>
  </div>`;
}

function avisoInterno(r, datos) {
  const e = r.entrada;
  const lineas = [
    ['Nombre', esc(datos.nombre || '—')],
    ['Email', `<a href="mailto:${esc(datos.email)}">${esc(datos.email)}</a>`],
    ['Teléfono', datos.telefono ? `<a href="tel:${esc(datos.telefono.replace(/[^\d+]/g, ''))}">${esc(datos.telefono)}</a>` : '—'],
    ['Comunicaciones comerciales', datos.comercial ? 'Sí, acepta' : 'No'],
    ['Modo', r.modo === 'suspension' ? 'Suspensión' : 'Aplazamiento / fraccionamiento'],
    ['Deuda', fmt(e.deuda)],
    ['Resultado', r.modo !== 'suspension' && r.exento ? 'Exento de garantía' : fmt(r.importeGarantizar)],
    ['Valor mínimo del inmueble', r.bien ? fmt(r.bien.tasacionMinima) : '—'],
    ['Garantía', esc(r.etiquetas.garantia)],
    ['Detalle', esc(JSON.stringify(e))],
  ];
  return `<div style="font-family:Arial,sans-serif;max-width:600px">
    <h2 style="font-family:Georgia,serif;font-weight:400">Nuevo contacto desde la calculadora</h2>
    <table style="border-collapse:collapse;width:100%">${lineas.map(([k, v]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #ddd;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:.08em;width:190px;vertical-align:top">${k}</td><td style="padding:8px 0;border-bottom:1px solid #ddd;font-size:14px">${v}</td></tr>`).join('')}</table>
  </div>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const d = leerCuerpo(req);
  if (pareceBot(d)) return res.status(200).json({ ok: true });
  if (limiteSuperado(req, 6, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes seguidas. Inténtalo en unos minutos.' });
  }

  const email = campo(d.email, 160);
  const nombre = campo(d.nombre, 120);
  const telefono = campo(d.telefono, 25);
  const acepta = d.acepta === true || d.acepta === 'true' || d.acepta === '1' || d.acepta === 'on';
  const comercial = d.comercial === true || d.comercial === 'true' || d.comercial === '1' || d.comercial === 'on';
  const modo = d.modo === 'suspension' ? 'suspension' : 'aplazamiento';

  if (!emailValido(email)) return res.status(400).json({ error: 'Revisa el correo electrónico.' });
  if (telefono && !telefonoValido(telefono)) return res.status(400).json({ error: 'Revisa el teléfono o déjalo en blanco.' });
  if (!acepta) return res.status(400).json({ error: 'Debes aceptar la política de privacidad.' });

  const entrada = d.entrada && typeof d.entrada === 'object' ? d.entrada : {};
  const r = Calc.calcular(modo, entrada);
  if (!r.entrada.deuda) return res.status(400).json({ error: 'Introduce el importe de la deuda.' });

  try {
    await enviar({
      from: remitente('Avalium Consulting Group'),
      to: email,
      replyTo: destinoInterno(),
      subject: modo === 'suspension'
        ? `Tu cálculo: garantía para suspender ${fmt(r.entrada.deuda)}`
        : `Tu cálculo: garantía para aplazar ${fmt(r.entrada.deuda)}`,
      html: informeHtml(r, nombre),
    });
    try {
      await enviar({
        from: remitente('Calculadora Avalium'),
        to: destinoInterno(),
        replyTo: email,
        subject: `🧮 Lead calculadora — ${fmt(r.entrada.deuda)} · ${modo === 'suspension' ? 'Suspensión' : 'Aplazamiento'}${telefono ? ' · con teléfono' : ''}`,
        html: avisoInterno(r, { email, nombre, telefono, comercial }),
      });
    } catch (e) {
      console.error('Aviso interno no enviado:', e.message);
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error enviando informe:', error);
    return res.status(500).json({ error: 'No hemos podido enviar el informe ahora mismo.' });
  }
}

// Exportado para las pruebas
export { informeHtml };
