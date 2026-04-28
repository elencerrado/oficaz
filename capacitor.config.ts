import type { CapacitorConfig } from '@capacitor/cli';

const isProductionBuild = process.env.NODE_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'com.oficaz.app',
  appName: 'Oficaz',
  webDir: 'dist/public',
  android: {
    // 🔧 Asegurar que la app acceda al servidor local en Android
    // 10.0.2.2 es la dirección especial para accesat al host desde el emulador
    // En dispositivo real, cambiar a la IP de la máquina o usar HTTPS con dominio
  },
  server: {
    androidScheme: 'https',
    // URL base para las requests en Android
    // En desarrollo: http://10.0.2.2:5000 (emulador) o la IP del host en dispositivo real
    // En producción: usar HTTPS con dominio
    url: undefined, // Usar valor por defecto (localhost en dev)
    cleartext: !isProductionBuild, // Bloquear cleartext en producción
    allowNavigation: isProductionBuild
      ? ['oficaz.es', '*.oficaz.es']
      : ['localhost', '10.0.2.2', 'oficaz.es', '*.oficaz.es']
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      showSpinner: true,
      spinnerColor: '#FFFFFF',
      backgroundColor: '#007AFF',
      androidSpinnerStyle: 'large',
      splashFullScreen: true,
      splashImmersive: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
