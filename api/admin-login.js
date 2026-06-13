// Valida usuario/contraseña del panel y crea una sesión firmada (cookie HMAC).
// Variables de entorno requeridas en Vercel:
//   ADMIN_USER, ADMIN_PASSWORD, ADMIN_SECRET (cadena larga y aleatoria)

export const config = { runtime: 'edge' };

const SESSION_HOURS = 8;

function b64urlFromBytes(bytes) {
  let bin = '';
  new Uint8Array(bytes).forEach(function (b) { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlFromString(str) {
  return b64urlFromBytes(new TextEncoder().encode(str));
}
async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64urlFromBytes(sig);
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const USER = process.env.ADMIN_USER;
  const PASS = process.env.ADMIN_PASSWORD;
  const SECRET = process.env.ADMIN_SECRET;
  if (!USER || !PASS || !SECRET) {
    return json({ error: 'El panel aún no está configurado. Define ADMIN_USER, ADMIN_PASSWORD y ADMIN_SECRET en Vercel.' }, 500);
  }

  let body = {};
  try { body = await request.json(); } catch (e) {}
  const user = String(body.user || '').trim();
  const pass = String(body.password || '');

  if (user !== USER || pass !== PASS) {
    return json({ error: 'Usuario o contraseña incorrectos.' }, 401);
  }

  const exp = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = b64urlFromString(JSON.stringify({ u: USER, exp: exp }));
  const sig = await sign(payload, SECRET);
  const token = payload + '.' + sig;

  const cookie = 'avalium_admin=' + token +
    '; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=' + (SESSION_HOURS * 60 * 60);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie }
  });
}
