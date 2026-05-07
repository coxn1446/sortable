import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: process.env.NODE_ENV === 'production' ? 'com.sortable.app' : 'com.sortable.dev',
  appName: 'Sortable',
  webDir: 'build',
  server: {
    url:
      process.env.NODE_ENV === 'production'
        ? 'https://sortable.net'
        : 'http://localhost:3000',
    cleartext: process.env.NODE_ENV !== 'production',
    hostname: 'sortable.net',
    allowNavigation: ['sortable.net', 'qa.sortable.net', 'www.sortable.net'],
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      backgroundColor: '#0F172A',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0F172A',
      overlaysWebView: false,
    },
  },
  ios: {
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: false,
    scheme: 'Sortable',
    backgroundColor: '#0F172A',
  },
};

export default config;
