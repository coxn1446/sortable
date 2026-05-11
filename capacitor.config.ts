import { CapacitorConfig } from '@capacitor/cli';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getCapacitorFlavorConfig } = require('./scripts/capacitor-env');

const { appId, appName, serverUrl, cleartext, allowNavigationHosts } = getCapacitorFlavorConfig();

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: 'build',
  server: {
    url: serverUrl,
    cleartext,
    hostname: 'sortable.net',
    allowNavigation: allowNavigationHosts,
  },
  plugins: {
    Keyboard: {
      // 'body' shrinks the layout and moves the top bar when the keyboard opens on iOS.
      resize: 'none',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      // Match `sortable.splash`, LaunchScreen.storyboard, and `public/splash-shell.css`.
      backgroundColor: '#504AED',
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
    backgroundColor: '#504AED',
  },
};

export default config;
