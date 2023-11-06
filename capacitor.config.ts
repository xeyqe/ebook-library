import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'ebook-library',
  webDir: 'www',
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      androidSpinnerStyle: 'large',
      showSpinner: true,
      splashFullScreen: true,
      splashImmersive: false,
      layoutName: 'splash_screen',
      useDialog: false
    },
  }
};

export default config;
