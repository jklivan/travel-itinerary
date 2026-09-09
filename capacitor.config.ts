import type { CapacitorConfig } from '@capacitor/cli'

// This first iOS build is a test shell around the live production app. The
// backend remains on Vercel; native features will be added before App Store
// submission so it is more than a website wrapper.
const config: CapacitorConfig = {
  appId: 'com.joshuaklivan.travelitineraryapp',
  appName: 'Travel Itinerary',
  webDir: 'mobile',
  plugins: { PushNotifications: { presentationOptions: ['sound', 'banner', 'list'] } },
  server: {
    url: 'https://travel-itinerary-gules.vercel.app',
    cleartext: false,
  },
}

export default config
