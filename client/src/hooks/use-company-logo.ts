import { useCallback, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Hook para obtener la URL del logo de la empresa
 * En Android/iOS usa el logo embebido localmente para evitar problemas de conectividad
 * En web usa la URL de R2 proporcionada por el servidor
 */
export function useCompanyLogo(remoteLogoUrl?: string): string | undefined {
  const isNativeAndroid = useMemo(
    () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android',
    []
  );

  const isNativeIOS = useMemo(
    () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios',
    []
  );

  const logoUrl = useCallback(() => {
    // En Android/iOS, usar logo embebido
    if (isNativeAndroid || isNativeIOS) {
      return '/assets/logo.png';
    }
    // En web, usar logo remoto o fallback
    return remoteLogoUrl || '/logo.png';
  }, [remoteLogoUrl, isNativeAndroid, isNativeIOS]);

  return logoUrl();
}

/**
 * Hook para saber si el logo está disponible
 */
export function useHasCompanyLogo(logoUrl?: string): boolean {
  return Boolean(logoUrl);
}

/**
 * Obtener la URL base para assets en diferentes plataformas
 */
export function getAssetUrl(path: string): string {
  const isNative = Capacitor.isNativePlatform();
  if (isNative) {
    return `/assets${path.startsWith('/') ? path : '/' + path}`;
  }
  return path.startsWith('/') ? path : '/' + path;
}
