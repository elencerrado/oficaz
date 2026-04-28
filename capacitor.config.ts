import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oficaz.app',
  appName: 'Oficaz',
  webDir: 'dist/public',
  android: {},
  server: {
    // Use hosted app shell to keep Android auth/session behavior aligned with production.
    androidScheme: 'https',
    url: 'https://oficaz.es',
    cleartext: false,
    allowNavigation: ['oficaz.es', '*.oficaz.es'],
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
