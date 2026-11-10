'use client'

import { SessionProvider } from 'next-auth/react'
import TripNavigation from './TripNavigation'
import NativeNotifications from './NativeNotifications'
import KeyboardDismiss from './KeyboardDismiss'
import PreviewAppTag from './PreviewAppTag'
import AnalyticsIdentify from './AnalyticsIdentify'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><AnalyticsIdentify /><PreviewAppTag /><TripNavigation /><KeyboardDismiss /><NativeNotifications>{children}</NativeNotifications></SessionProvider>
}
