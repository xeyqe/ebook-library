import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'ebook-library',
  webDir: 'www',
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
        launchAutoHide: false,
        splashFullScreen: true,
        showSpinner: true,
    }
}
};

export default config;
