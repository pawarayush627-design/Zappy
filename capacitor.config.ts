import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zappyfun.app',
  appName: 'ZappyFun',
  webDir: 'dist',
  backgroundColor: '#050505',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    backgroundColor: '#050505',
    allowMixedContent: true,
  },
};

export default config;
