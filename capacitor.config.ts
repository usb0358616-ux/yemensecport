import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartports.app',
  appName: 'نظام المنافذ الذكية',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
