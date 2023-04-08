import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'ebook-library',
  webDir: 'www',
  bundledWebRuntime: false,
  android: {
    hideLogs: true
  }
};

export default config;
