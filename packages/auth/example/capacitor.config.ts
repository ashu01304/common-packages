import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.formstr.auth.example',
  appName: 'Formstr Auth Example',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
