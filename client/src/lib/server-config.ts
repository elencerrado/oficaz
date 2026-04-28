/**
 * Server Configuration - Dynamically configurable for different environments
 * Used by both web and Android(Capacitor) environments
 */

export interface ServerConfig {
  baseUrl: string;
  isNative: boolean;
  platform: 'web' | 'android' | 'ios';
}

// Determine current environment
export const isNativePlatform = (): boolean => {
  return typeof window !== 'undefined' && 
    !window.location.origin.includes('localhost:') &&
    (window.location.origin.includes('capacitor') || 
     window.location.origin.startsWith('file://'));
};

export const getPlatform = (): 'web' | 'android' | 'ios' => {
  if (!isNativePlatform()) return 'web';
  
  // Check if running on Capacitor
  if (typeof (window as any).cap !== 'undefined') {
    const platform = (window as any).cap.getPlatform?.();
    if (platform === 'android') return 'android';
    if (platform === 'ios') return 'ios';
  }
  
  return 'web';
};

/**
 * Get the server base URL for API requests
 * 
 * - Web: Uses relative URLs (same origin)
 * - Android Emulator: 10.0.2.2:5000 (special alias for host)
 * - Android Device: Configured via environment or capacitor.config.ts
 * - iOS: Configured via environment or capacitor.config.ts
 */
export const getServerBaseUrl = (): string => {
  // In browser, use relative URLs (same origin)
  if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
    return ''; // Relative to current origin
  }

  // For Capacitor (native Android/iOS)
  if (typeof (window as any).cap !== 'undefined' && (window as any).cap.getServerUrl) {
    try {
      return (window as any).cap.getServerUrl();
    } catch (e) {
      console.warn('Failed to get Capacitor server URL:', e);
    }
  }

  // Fallback to environment variable from .env loaded by Vite
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl;
  }

  // Default fallback for development
  return 'http://10.0.2.2:5000';
};

/**
 * Build full API URL from path
 */
export const buildApiUrl = (path: string): string => {
  const baseUrl = getServerBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  if (baseUrl === '') {
    // Relative URL
    return normalizedPath;
  }
  
  // Absolute URL
  return `${baseUrl}${normalizedPath}`;
};

/**
 * Get complete server configuration
 */
export const getServerConfig = (): ServerConfig => ({
  baseUrl: getServerBaseUrl(),
  isNative: isNativePlatform(),
  platform: getPlatform(),
});

/**
 * Debug: Log current server configuration
 */
export const logServerConfig = (): void => {
  const config = getServerConfig();
  console.group('📡 Server Configuration');
  console.log('Platform:', config.platform);
  console.log('Is Native:', config.isNative);
  console.log('Base URL:', config.baseUrl);
  console.log('Sample API URL:', buildApiUrl('/api/auth/me'));
  console.groupEnd();
};

// Log on module load
if (import.meta.env.DEV) {
  logServerConfig();
}
