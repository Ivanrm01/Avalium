import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { nombre, empresa, email, telefono, tipo, importe, urgencia, mensaje } = req.body;

  // Validación básica
  if (!nombre || !email || !mensaje) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // Configuración del servidor SMTP de IONOS
  const transporter = nodemailer.createTransport({
    host: 'smtp.ionos.es',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  // Email que recibes tú (Avalium)
  const emailParaAvalium = {
    from: `"Formulario Avalium" <${process.env.SMTP_USER}>`,
    to: process.env.SMTP_USER,
    replyTo: email,
    subject: `Nueva solicitud de contacto — ${nombre}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #0A1F33;">
        <div style="background: #0A1F33; padding: 24px 32px;">
          <h1 style="color: #FAF6EE; font-size: 20px; margin: 0; font-weight: 400; letter-spacing: 0.05em;">AVALIUM · Nueva solicitud</h1>
        </div>
        <div style="padding: 32px; background: #FAF6EE;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #888; width: 160px;">Nombre</td><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 15px;">${nombre}</td></tr>
            ${empresa ? `<tr><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #888;">Empresa</td><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 15px;">${empresa}</td></tr>` : ''}
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #888;">Email</td><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 15px;"><a href="mailto:${email}" style="color: #C75D2C;">${email}</a></td></tr>
            ${telefono ? `<tr><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #888;">Teléfono</td><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 15px;"><a href="tel:${telefono}" style="color: #C75D2C;">${telefono}</a></td></tr>` : ''}
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #888;">Tipo</td><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 15px;">${tipo}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #888;">Importe</td><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 15px;">${importe}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #888;">Urgencia</td><td style="padding: 10px 0; border-bottom: 1px solid #ddd; font-size: 15px; color: ${urgencia === 'Embargos en curso' ? '#C75D2C' : 'inherit'};">${urgencia}</td></tr>
          </table>
          <div style="margin-top: 24px; padding: 20px; background: white; border-left: 3px solid #C75D2C;">
            <p style="font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #888; margin: 0 0 10px;">Mensaje</p>
            <p style="font-size: 15px; line-height: 1.7; margin: 0; white-space: pre-wrap;">${mensaje}</p>
          </div>
          <div style="margin-top: 24px; text-align: center;">
            <a href="mailto:${email}" style="display: inline-block; background: #C75D2C; color: white; padding: 12px 28px; text-decoration: none; font-size: 14px; letter-spacing: 0.05em;">Responder a ${nombre}</a>
          </div>
        </div>
        <div style="padding: 16px 32px; background: #0A1F33; text-align: center;">
          <p style="color: rgba(250,246,238,0.5); font-size: 11px; margin: 0;">Avalium Consulting Group · info@avalium.es · +34 614 149 465</p>
        </div>
      </div>
    `,
  };

  // Email de confirmación automática que recibe el cliente
  const emailParaCliente = {
    from: `"Avalium Consulting Group" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Hemos recibido tu solicitud — Avalium',
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #0A1F33;">
        <div style="background: #0A1F33; padding: 24px 32px;">
          <h1 style="color: #FAF6EE; font-size: 20px; margin: 0; font-weight: 400; letter-spacing: 0.05em;">AVALIUM · Garantizamos tus deudas</h1>
        </div>
        <div style="padding: 40px 32px; background: #FAF6EE;">
          <p style="font-size: 17px; line-height: 1.6; margin: 0 0 20px;">Hola ${nombre},</p>
          <p style="font-size: 15px; line-height: 1.7; color: #1A3247; margin: 0 0 20px;">Hemos recibido tu solicitud y un profesional del equipo la revisará en persona. Te responderemos con un primer diagnóstico en menos de <strong>48 horas hábiles</strong>.</p>
          <div style="background: white; padding: 20px 24px; border-left: 3px solid #C75D2C; margin: 28px 0;">
            <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin: 0 0 8px;">Tu consulta</p>
            <p style="font-size: 14px; color: #1A3247; margin: 0; line-height: 1.6;">${tipo} · ${importe}</p>
          </div>
          <p style="font-size: 14px; line-height: 1.7; color: #1A3247; margin: 0 0 8px;">Si tu situación es urgente, puedes llamarnos directamente:</p>
          <p style="font-size: 18px; margin: 0;"><a href="tel:+34614149465" style="color: #C75D2C; text-decoration: none;">+34 614 149 465</a></p>
        </div>
        <div style="padding: 20px 32px; background: #0A1F33;">
          <p style="color: rgba(250,246,238,0.5); font-size: 11px; margin: 0; line-height: 1.6;">Avalium Consulting Group · Madrid | Castellón<br>Este email es una confirmación automática. Por favor no respondas a este mensaje — usa <a href="mailto:info@avalium.es" style="color: #C75D2C;">info@avalium.es</a> para cualquier consulta.</p>
        </div>
      </div>
    `,
  };

  try {
    // Enviar los dos emails
    await transporter.sendMail(emailParaAvalium);
    await transporter.sendMail(emailParaCliente);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error enviando email:', error);
    return res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
}
