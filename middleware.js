// Protege todo /admin: si no hay sesión válida, redirige a la pantalla de login.
// No afecta a la web pública ni al login de GitHub del CMS (/api/*).
// Requiere la variable de entorno ADMIN_SECRET (la misma que usa /api/admin-login).

import { next } from '@vercel/edge';

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};

function b64urlFromBytes(bytes) {
  let bin = '';
  new Uint8Array(bytes).forEach(function (b) { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function isValid(token, secret) {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const expected = b64urlFromBytes(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  );
  if (expected !== sig) return false;

  try {
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, function (c) { return c.charCodeAt(0); });
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data.exp || Date.now() > data.exp) return false;
    return true;
  } catch (e) {
    return false;
  }
}

export default async function middleware(request) {
  const pathname = new URL(request.url).pathname;

  // La pantalla de login debe ser accesible sin sesión.
  if (pathname === '/admin/login' || pathname === '/admin/login.html') {
    return next();
  }

  const SECRET = process.env.ADMIN_SECRET;
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)avalium_admin=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : '';

  if (SECRET && (await isValid(token, SECRET))) {
    return next();
  }

  return Response.redirect(new URL('/admin/login', request.url), 302);
}
