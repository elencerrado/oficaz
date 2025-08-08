import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

// Initialize SendGrid (fallback)
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY not found. Using Nodemailer instead.');
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
  try {
    console.log(`📧 Starting sendEmployeeWelcomeEmail for: ${employeeEmail}`);
    
    // Configure Nodemailer with Hostinger SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true, // SSL
      auth: {
        user: 'soy@oficaz.es',
        pass: 'Sanisidro@2025',
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Professional logo implementation with base64 embedded image for maximum compatibility
    let baseUrl;
    if (process.env.REPLIT_DOMAINS) {
      const firstDomain = process.env.REPLIT_DOMAINS.split(',')[0];
      baseUrl = `https://${firstDomain}`;
    } else if (process.env.REPLIT_DEV_DOMAIN) {
      baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    } else {
      baseUrl = 'https://oficaz-employee-management.replit.app';
    }
    
    // Use embedded base64 logo for maximum email client compatibility
    let logoHtml;
    try {
      const logoPath = path.join(process.cwd(), 'attached_assets', 'oficaz logo_1750516757063.png');
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 = logoBuffer.toString('base64');
        logoHtml = `
          <a href="https://oficaz.es" style="text-decoration: none;" target="_blank">
            <img src="data:image/png;base64,${logoBase64}" alt="Oficaz - Sistema de Gestión Empresarial" 
                 style="height: 45px; width: auto; max-width: 200px; display: block; margin: 0 auto; border: none; outline: none;" />
          </a>
        `;
        console.log(`📧 Using embedded base64 logo (${logoBase64.length} chars)`);
      } else {
        logoHtml = `
          <div style="text-align: center; padding: 10px;">
            <h2 style="color: #007AFF; margin: 0; font-size: 24px; font-weight: bold;">Oficaz</h2>
            <p style="color: #666; margin: 5px 0 0 0; font-size: 12px;">Sistema de Gestión Empresarial</p>
          </div>
        `;
        console.log('📧 Using fallback text logo');
      }
    } catch (error) {
      console.error('Error loading logo:', error);
      logoHtml = `
        <div style="text-align: center; padding: 10px;">
          <h2 style="color: #007AFF; margin: 0; font-size: 24px; font-weight: bold;">Oficaz</h2>
          <p style="color: #666; margin: 5px 0 0 0; font-size: 12px;">Sistema de Gestión Empresarial</p>
        </div>
      `;
    }
    
    const logoUrl = `${baseUrl}/images/oficaz-logo.png`; // Keep for backwards compatibility
    const websiteUrl = 'https://oficaz.es';
    
    console.log('📧 Professional logo with base64 embedded → Website:', websiteUrl);

    const subject = `Bienvenido a ${companyName} - Configurar contraseña`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenido a ${companyName}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          
          <!-- Header with logo -->
          <div style="background-color: #ffffff; padding: 15px; text-align: center; border-bottom: 1px solid #e5e7eb;">
            ${logoHtml}
          </div>
          
          <!-- Content -->
          <div style="padding: 30px 20px;">
            <h1 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 20px 0; text-align: center;">
              ¡Bienvenido a ${companyName}!
            </h1>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
                Hola <strong>${employeeName}</strong>,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">
                Te damos la bienvenida al equipo de <strong>${companyName}</strong>. Tu cuenta ha sido creada y ahora necesitas configurar tu contraseña para acceder a la plataforma Oficaz.
              </p>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${activationLink}" 
                 style="background: #007AFF; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
                Configurar mi contraseña
              </a>
            </div>

            <!-- Features -->
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <p style="color: #1976d2; font-weight: 600; margin: 0 0 10px 0; font-size: 16px;">
                ¿Qué puedes hacer en Oficaz?
              </p>
              <ul style="color: #374151; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li>Fichar entrada y salida</li>
                <li>Solicitar vacaciones</li>
                <li>Gestionar documentos</li>
                <li>Comunicarte con tu equipo</li>
              </ul>
            </div>

            <!-- Warning -->
            <div style="margin: 25px 0; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>Importante:</strong> Este enlace de activación expirará en 7 días. Si tienes problemas para acceder, contacta con tu administrador.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0;">
              Este email fue enviado desde <strong>Oficaz</strong>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              La plataforma de gestión empresarial para equipos modernos
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Bienvenido a ${companyName}

Hola ${employeeName},

Te damos la bienvenida al equipo de ${companyName}. Tu cuenta ha sido creada y ahora necesitas configurar tu contraseña para acceder a la plataforma Oficaz.

Configura tu contraseña usando este enlace: ${activationLink}

¿Qué puedes hacer en Oficaz?
• Fichar entrada y salida
• Solicitar vacaciones  
• Gestionar documentos
• Comunicarte con tu equipo

Importante: Este enlace de activación expirará en 7 días. Si tienes problemas para acceder, contacta con tu administrador.

Este email fue enviado desde Oficaz - La plataforma de gestión empresarial para equipos modernos
    `;

    const mailOptions = {
      from: '"Oficaz" <soy@oficaz.es>',
      to: employeeEmail,
      subject,
      text: textContent,
      html: htmlContent,
    };

    console.log(`📧 Attempting to send email with options:`, {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Employee welcome email sent successfully to ${employeeEmail}`);
    console.log(`📧 SMTP Response:`, result);
    return true;

  } catch (error) {
    console.error('❌ Error sending employee welcome email:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  userFullName: string,
  companyName: string,
  resetToken: string,
  resetLink: string
): Promise<boolean> {
  try {
    console.log(`📧 Starting sendPasswordResetEmail for: ${email}`);
    
    // Configure Nodemailer with Hostinger SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true, // SSL
      auth: {
        user: 'soy@oficaz.es',
        pass: 'Sanisidro@2025',
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // ⚠️ PROTECTED - DO NOT MODIFY
    // Use static logo URL - this is the ONLY solution that works
    const logoUrl = 'https://oficaz.es/email-logo.png';
    const websiteUrl = 'https://oficaz.es';
    
    console.log('📧 Using static logo URL:', logoUrl);

    const subject = `Recuperar contraseña - ${companyName}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperar contraseña</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          
          <!-- Header with logo -->
          <div style="background-color: #ffffff; padding: 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
            <a href="${websiteUrl}" style="text-decoration: none;" target="_blank">
              <img src="${logoUrl}" alt="Oficaz - Sistema de Gestión Empresarial" 
                   style="height: 45px; width: auto; max-width: 200px; display: block; margin: 0 auto; border: none; outline: none;" />
            </a>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <h1 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 20px 0; text-align: center;">
              Recuperar contraseña
            </h1>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
                Hola <strong>${userFullName}</strong>,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">
                Hemos recibido una solicitud para cambiar la contraseña de tu cuenta en <strong>${companyName}</strong>. 
                Si no solicitaste este cambio, puedes ignorar este email.
              </p>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="${resetLink}" 
                 style="background: #007AFF; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
                Cambiar mi contraseña
              </a>
            </div>

            <!-- Security info -->
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 30px 0;">
              <p style="color: #856404; font-weight: 600; margin: 0 0 10px 0; font-size: 16px;">
                🔒 Información de seguridad
              </p>
              <ul style="color: #856404; margin: 0; padding-left: 20px; line-height: 1.8; font-size: 14px;">
                <li>Este enlace expirará en <strong>1 hora</strong></li>
                <li>Solo funciona una vez</li>
                <li>Si no fuiste tú, ignora este email</li>
                <li>Tu contraseña actual sigue siendo válida hasta que la cambies</li>
              </ul>
            </div>

            <!-- Alternative access -->
            <div style="margin: 25px 0; padding: 15px; background: #e3f2fd; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #1976d2; text-align: center;">
                ¿Problemas con el enlace? Copia y pega esta URL en tu navegador:
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #1976d2; text-align: center; word-break: break-all;">
                ${resetLink}
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 25px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0;">
              Este email fue enviado desde <strong>Oficaz</strong>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              La plataforma de gestión empresarial para equipos modernos
            </p>
            <p style="color: #9ca3af; font-size: 11px; margin: 15px 0 0 0;">
              Si no solicitaste este cambio de contraseña, puedes ignorar este email de forma segura.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Recuperar contraseña - ${companyName}

Hola ${userFullName},

Hemos recibido una solicitud para cambiar la contraseña de tu cuenta en ${companyName}. 
Si no solicitaste este cambio, puedes ignorar este email.

Cambia tu contraseña usando este enlace: ${resetLink}

INFORMACIÓN DE SEGURIDAD:
• Este enlace expirará en 1 hora
• Solo funciona una vez
• Si no fuiste tú, ignora este email
• Tu contraseña actual sigue siendo válida hasta que la cambies

Si tienes problemas con el enlace, copia y pega esta URL en tu navegador:
${resetLink}

Este email fue enviado desde Oficaz - La plataforma de gestión empresarial para equipos modernos

Si no solicitaste este cambio de contraseña, puedes ignorar este email de forma segura.
    `;

    const mailOptions = {
      from: '"Oficaz" <soy@oficaz.es>',
      to: email,
      subject,
      text: textContent,
      html: htmlContent,
    };

    console.log(`📧 Attempting to send password reset email with options:`, {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent successfully to ${email}`);
    console.log(`📧 SMTP Response:`, result);
    return true;

  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return false;
  }
}