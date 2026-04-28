/**
 * Session Management Configuration
 * 
 * Estrategia de sesiones prolongadas + seguras:
 * - Android: 30 días (app nativa, más segura, con push notifications)
 * - Web: 7 días (navegador compartido, menos seguro)
 * - Auto-refresh de tokens cada 24h sin interacción
 * - Logout automático solo si token expirado + sin refresh disponible
 */

import { Capacitor } from '@capacitor/core';

export interface SessionConfig {
  platform: 'web' | 'android' | 'ios';
  maxSessionDays: number;         // Días máximos de sesión
  inactivityTimeoutMs: number;    // Logout si inactivo (0 = disabled)
  autoRefreshIntervalMs: number;  // Refrescar token cada X ms
  tokenExpiryDays: number;        // Duración del access token
  refreshTokenExpiryDays: number; // Duración del refresh token
}

/**
 * Detecta la plataforma y retorna la configuración apropiada
 */
export function getSessionConfig(): SessionConfig {
  const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  const isIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  if (isAndroid) {
    // 📱 ANDROID: Sesión prolongada + push notifications
    return {
      platform: 'android',
      maxSessionDays: 30,              // 1 mes
      inactivityTimeoutMs: 0,          // Disabled (no logout por inactividad)
      autoRefreshIntervalMs: 24 * 60 * 60 * 1000,  // 24 horas
      tokenExpiryDays: 1,              // Access token 1 día
      refreshTokenExpiryDays: 30,      // Refresh token 30 días
    };
  }

  if (isIOS) {
    // 🍎 IOS: Similar a Android
    return {
      platform: 'ios',
      maxSessionDays: 30,
      inactivityTimeoutMs: 0,
      autoRefreshIntervalMs: 24 * 60 * 60 * 1000,
      tokenExpiryDays: 1,
      refreshTokenExpiryDays: 30,
    };
  }

  // 💻 WEB: Sesión moderada + inactividad timeout
  return {
    platform: 'web',
    maxSessionDays: 7,               // 1 semana
    inactivityTimeoutMs: 2 * 60 * 60 * 1000,  // 2 horas de inactividad
    autoRefreshIntervalMs: 6 * 60 * 60 * 1000,  // 6 horas
    tokenExpiryDays: 1,              // Access token 1 día
    refreshTokenExpiryDays: 7,       // Refresh token 7 días
  };
}

/**
 * Obtiene el nombre legible de la plataforma
 */
export function getSessionConfigDisplay(config: SessionConfig): string {
  return `
📱 Plataforma: ${config.platform.toUpperCase()}
🕐 Sesión máxima: ${config.maxSessionDays} días
⏱️  Inactividad logout: ${config.inactivityTimeoutMs === 0 ? 'Deshabilitado' : `${config.inactivityTimeoutMs / 60000} minutos`}
🔄 Auto-refresh: cada ${config.autoRefreshIntervalMs / 60 / 60 / 1000} horas
🎫 Access token: ${config.tokenExpiryDays} día(s)
🔑 Refresh token: ${config.refreshTokenExpiryDays} días
  `;
}

/**
 * Verifica si la sesión aún es válida
 */
export function isSessionValid(loginTimestamp: number, config: SessionConfig): boolean {
  const now = Date.now();
  const maxSessionMs = config.maxSessionDays * 24 * 60 * 60 * 1000;
  return (now - loginTimestamp) < maxSessionMs;
}

/**
 * Verifica si necesita auto-refresh de token
 */
export function shouldAutoRefreshToken(lastRefreshTimestamp: number, config: SessionConfig): boolean {
  const now = Date.now();
  return (now - lastRefreshTimestamp) > config.autoRefreshIntervalMs;
}
