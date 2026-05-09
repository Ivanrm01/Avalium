// Recibe el callback de GitHub y completa el login
export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Falta el código de autorización');
  }

  try {
    // Intercambiar el código por un access_token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.OAUTH_CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).send(`Error: ${tokenData.error_description}`);
    }

    // Devolver una página HTML que comunica el token a Decap CMS
    const responseBody = `
      <!DOCTYPE html>
      <html>
        <head><title>Autenticación completada</title></head>
        <body>
          <p>Autenticación correcta. Cierra esta ventana si no se cierra automáticamente.</p>
          <script>
            (function() {
              function receiveMessage(e) {
                window.opener.postMessage(
                  'authorization:github:success:${JSON.stringify({ token: tokenData.access_token, provider: 'github' })}',
                  e.origin
                );
                window.removeEventListener("message", receiveMessage, false);
              }
              window.addEventListener("message", receiveMessage, false);
              window.opener.postMessage("authorizing:github", "*");
            })();
          </script>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(responseBody);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
}
