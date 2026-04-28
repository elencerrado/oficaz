import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oficaz.app',
  appName: 'Oficaz',
  webDir: 'dist/public',
  android: {},
  server: {
    // Assets are bundled into the APK (dist/public).
    // API calls use https://oficaz.es via getServerBaseUrl() in server-config.ts.
    androidScheme: 'https',
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
