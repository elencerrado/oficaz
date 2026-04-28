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
      // En producción apunta al servidor real; en dev sirve assets localmente
      url: isProductionBuild ? 'https://oficaz.es' : undefined,
      cleartext: !isProductionBuild,
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
