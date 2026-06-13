// Protege todo el área /admin con usuario y contraseña (HTTP Basic Auth).
// No afecta a la web pública ni al login de GitHub del CMS (/api/auth, /api/callback).
//
// Configura en Vercel → Project → Settings → Environment Variables:
//   ADMIN_USER      = (el usuario que elijas)
//   ADMIN_PASSWORD  = (la contraseña que elijas)
// Tras guardarlas, vuelve a desplegar.

export const config = {
  matcher: '/admin/:path*',
};

export default function middleware(request) {
  const USER = process.env.ADMIN_USER;
  const PASS = process.env.ADMIN_PASSWORD;

  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');

  if (USER && PASS && scheme === 'Basic' && encoded) {
    let decoded = '';
    try { decoded = atob(encoded); } catch (e) { decoded = ''; }
    const i = decoded.indexOf(':');
    const user = decoded.slice(0, i);
    const pass = decoded.slice(i + 1);
    if (user === USER && pass === PASS) {
      return; // credenciales correctas → continúa hacia el panel
    }
  }

  return new Response('Acceso restringido — Panel de Avalium', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Avalium Admin", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
