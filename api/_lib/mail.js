// Utilidades compartidas por /api/contact y /api/calculadora.
// Los archivos de /api que empiezan por "_" no se publican como funciones en Vercel.

import nodemailer from 'nodemailer';

export const TELEFONO = '+34614149465';
export const TELEFONO_VISIBLE = '+34 614 149 465';

// Escapa cualquier texto del usuario antes de meterlo en el HTML de un email
export function esc(valor) {
  return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Recorta y limpia un campo de texto
export function campo(valor, max) {
  return String(valor == null ? '' : valor).replace(/\u0000/g, '').trim().slice(0, max || 200);
}

export function emailValido(e) {
  return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(String(e || '').trim());
}

export function telefonoValido(t) {
  const limpio = String(t || '').replace(/[^\d+]/g, '');
  const nacional = limpio.replace(/^\+34/, '').replace(/^0034/, '');
  return /^[6789]\d{8}$/.test(nacional) || /^\+\d{8,15}$/.test(limpio);
}

// Lee el cuerpo tanto si llega en JSON (fetch) como en formulario clásico (sin JavaScript)
export function leerCuerpo(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch (e) {
      return Object.fromEntries(new URLSearchParams(b));
    }
  }
  return b;
}

export function quiereJson(req) {
  const accept = String(req.headers['accept'] || '');
  const tipo = String(req.headers['content-type'] || '');
  return accept.includes('application/json') || tipo.includes('application/json');
}

// Antispam muy ligero: campo trampa + tiempo mínimo de relleno
export function pareceBot(datos) {
  if (datos.website && String(datos.website).trim() !== '') return true;
  const t = Number(datos.t);
  if (datos.t !== undefined && Number.isFinite(t) && t < 2500) return true;
  return false;
}

// Límite de envíos por IP (best effort: la memoria vive mientras la instancia esté caliente)
const envios = new Map();
export function limiteSuperado(req, maximo, ventanaMs) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'desconocida').split(',')[0].trim();
  const ahora = Date.now();
  const lista = (envios.get(ip) || []).filter((ts) => ahora - ts < ventanaMs);
  lista.push(ahora);
  envios.set(ip, lista);
  if (envios.size > 5000) envios.clear();
  return lista.length > maximo;
}

let transporter = null;
function crearTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ionos.es',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,          // STARTTLS en el puerto 587
    requireTLS: true,       // nunca enviar credenciales sin cifrar
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

// Envía un email. Con MAIL_DRY_RUN=1 no envía nada: lo deja en la consola (para pruebas).
export async function enviar(mensaje) {
  if (process.env.MAIL_DRY_RUN === '1') {
    globalThis.__correosEnviados = globalThis.__correosEnviados || [];
    globalThis.__correosEnviados.push(mensaje);
    return { dryRun: true };
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Faltan las variables SMTP_USER / SMTP_PASS');
  }
  return crearTransporter().sendMail(mensaje);
}

export function remitente(nombre) {
  return `"${nombre || 'Avalium Consulting Group'}" <${process.env.SMTP_USER || 'info@avalium.es'}>`;
}

export function destinoInterno() {
  return process.env.LEADS_TO || process.env.SMTP_USER || 'info@avalium.es';
}

// Página HTML mínima para quien envía el formulario sin JavaScript
export function paginaRespuesta(titulo, texto) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(titulo)} | Avalium</title><link rel="stylesheet" href="/styles.css"></head><body style="background:#F5EFE3"><main class="container-narrow" style="padding:4rem 1.25rem"><h1 style="font-size:2.2rem">${esc(titulo)}</h1><p class="lede" style="margin:1.25rem 0 2rem">${texto}</p><a class="btn btn-primary" href="/">Volver a la web</a></main></body></html>`;
}
