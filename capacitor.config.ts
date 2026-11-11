import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zappyfun.app',
  appName: 'ZappyFun',
  webDir: 'dist',
  backgroundColor: '#050505',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    backgroundColor: '#050505',
    allowMixedContent: false,
  },
};

export default config;
