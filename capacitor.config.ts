import type { CapacitorConfig } from '@capacitor/cli'
import { KeyboardResize } from '@capacitor/keyboard'

// This first iOS build is a test shell around the live production app. The
// backend remains on Vercel; native features will be added before App Store
// submission so it is more than a website wrapper.
const config: CapacitorConfig = {
  appId: 'com.joshuaklivan.travelitineraryapp',
  appName: 'Postcard',
  webDir: 'mobile',
  plugins: {
    PushNotifications: { presentationOptions: ['sound', 'banner', 'list'] },
    // The app shrinks the page while the keyboard is open instead of sliding it up, so the header and
    // bottom bar stay put when the keyboard closes.
    Keyboard: { resize: KeyboardResize.Native },
  },
  server: {
    url: 'https://travel-itinerary-gules.vercel.app',
    cleartext: false,
  },
}

export default config
