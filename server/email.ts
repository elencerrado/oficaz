import sgMail from '@sendgrid/mail';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY not found. Email functionality will be disabled.');
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid not configured. Email not sent.');
    return false;
  }

  try {
    await sgMail.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export async function sendEmployeeWelcomeEmail(
  employeeEmail: string,
  employeeName: string,
  companyName: string,
  activationToken: string,
  activationLink: string
): Promise<boolean> {
  const fromEmail: string = process.env.SENDGRID_FROM_EMAIL || 'noreply@oficaz.com';
  
  const subject = `Bienvenido a ${companyName} - Configurar contraseña`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenido a ${companyName}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" 
             alt="Oficaz" style="height: 40px; max-width: 150px;">
        <h1 style="color: #007AFF; margin: 10px 0;">¡Bienvenido a ${companyName}!</h1>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #333; margin-top: 0;">Hola ${employeeName},</h2>
        <p>Te damos la bienvenida al equipo de <strong>${companyName}</strong>. Tu cuenta ha sido creada y ahora necesitas configurar tu contraseña para acceder a la plataforma Oficaz.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${activationLink}" 
           style="background: #007AFF; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Configurar mi contraseña
        </a>
      </div>

      <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px;">
          <strong>¿Qué puedes hacer en Oficaz?</strong><br>
          • Fichar entrada y salida<br>
          • Solicitar vacaciones<br>
          • Gestionar documentos<br>
          • Comunicarte con tu equipo
        </p>
      </div>

      <div style="margin: 30px 0; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px;">
          <strong>Importante:</strong> Este enlace de activación expirará en 7 días. Si tienes problemas para acceder, contacta con tu administrador.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <div style="text-align: center; color: #666; font-size: 12px;">
        <p>Este email fue enviado desde <strong>Oficaz</strong><br>
        La plataforma de gestión empresarial para equipos modernos</p>
        
        <p style="margin-top: 20px;">
          Si no solicitaste esta cuenta, puedes ignorar este email.
        </p>
      </div>

    </body>
    </html>
  `;

  const textContent = `
    ¡Bienvenido a ${companyName}!

    Hola ${employeeName},

    Te damos la bienvenida al equipo de ${companyName}. Tu cuenta ha sido creada y ahora necesitas configurar tu contraseña para acceder a la plataforma Oficaz.

    Para configurar tu contraseña, haz clic en el siguiente enlace:
    ${activationLink}

    ¿Qué puedes hacer en Oficaz?
    • Fichar entrada y salida
    • Solicitar vacaciones
    • Gestionar documentos
    • Comunicarte con tu equipo

    IMPORTANTE: Este enlace de activación expirará en 7 días. Si tienes problemas para acceder, contacta con tu administrador.

    Este email fue enviado desde Oficaz - La plataforma de gestión empresarial para equipos modernos.

    Si no solicitaste esta cuenta, puedes ignorar este email.
  `;

  return await sendEmail({
    to: employeeEmail,
    from: fromEmail,
    subject,
    html: htmlContent,
    text: textContent
  });
}