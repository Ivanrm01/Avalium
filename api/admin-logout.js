// Cierra la sesión del panel: borra la cookie y redirige al login.
export const config = { runtime: 'edge' };

export default function handler(request) {
  const cookie = 'avalium_admin=; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=0';
  return new Response(null, {
    status: 302,
    headers: { 'Set-Cookie': cookie, 'Location': '/admin/login' }
  });
}
