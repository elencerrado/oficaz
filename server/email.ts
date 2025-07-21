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

    // Use static logo URL for better email client compatibility
    const logoUrl = 'https://oficaz.es/email-logo.png';
    console.log('📧 Using static logo URL for welcome email:', logoUrl);

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
            <img src="${logoUrl}" alt="Oficaz" style="height: 35px; width: auto; max-width: 150px; display: block; margin: 0 auto;" />
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