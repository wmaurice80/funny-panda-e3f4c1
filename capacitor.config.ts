import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wmaurice.calsnap',
  appName: 'CalSnap',
  webDir: 'dist',
  server: {
    androidScheme: 'https', // HTTPS dans la WebView Android (requis pour caméra, APIs)
  },
  android: {
    buildOptions: {
      releaseType: 'APK',
    },
  },
};

export default config;
