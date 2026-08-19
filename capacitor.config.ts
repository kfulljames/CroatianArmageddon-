import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.croatianarmageddon.app',
  appName: 'Croatian Armageddon',
  webDir: 'dist',
  // The game is entirely on-device, so the webview never needs the network.
  server: { androidScheme: 'https' },
  android: {
    backgroundColor: '#0b2018',
  },
  ios: {
    backgroundColor: '#0b2018',
    contentInset: 'always',
  },
}

export default config
