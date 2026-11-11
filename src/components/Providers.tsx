'use client'

import { SessionProvider } from 'next-auth/react'
import TripNavigation from './TripNavigation'
import NativeNotifications from './NativeNotifications'
import KeyboardDismiss from './KeyboardDismiss'
import PreviewAppTag from './PreviewAppTag'
import AnalyticsIdentify from './AnalyticsIdentify'
import ImportedNotice from './ImportedNotice'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><AnalyticsIdentify /><ImportedNotice /><PreviewAppTag /><TripNavigation /><KeyboardDismiss /><NativeNotifications>{children}</NativeNotifications></SessionProvider>
}
