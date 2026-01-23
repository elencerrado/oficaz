// 🔒 SECURITY: TOTP (Time-based One-Time Password) para Super Admin
// Requiere Google Authenticator, Authy, Microsoft Authenticator, etc.

import speakeasy from 'speakeasy';

const TOTP_SERVICE_NAME = 'Oficaz';
const TOTP_SERVICE_ACCOUNT = 'super-admin@oficaz.es';

// 🔒 Generar secret TOTP durante setup del super admin (se hace una sola vez)
export function generateTOTPSecret(): {
  secret: string;
  qrCode: string;
} {
  const secret = speakeasy.generateSecret({
    name: `${TOTP_SERVICE_NAME} (${TOTP_SERVICE_ACCOUNT})`,
    issuer: TOTP_SERVICE_NAME,
    length: 32, // 32 characters = 256 bits (máxima seguridad)
  });

  return {
    secret: secret.base32, // Base32 encoded secret (para copiar manualmente si QR falla)
    qrCode: secret.otpauth_url || '', // URL para generar QR en cliente
  };
}

// 🔒 Verificar código TOTP (6 dígitos que cambian cada 30 segundos)
export function verifyTOTPCode(secret: string, code: string): boolean {
  try {
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: code,
      window: 1, // Permitir 1 ventana anterior (30 segundos atrás) para reloj descalibrado
    });

    return verified;
  } catch (error) {
    console.error('Error verifying TOTP code:', error);
    return false;
  }
}

// 🔒 Generar token temporal para el setup del TOTP
export function generateTOTPSetupToken(): string {
  // Token de 64 caracteres aleatorio para validar setup
  return require('crypto').randomBytes(32).toString('hex');
}
