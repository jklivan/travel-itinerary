'use client'

import { SessionProvider } from 'next-auth/react'
import TripNavigation from './TripNavigation'
import NativeNotifications from './NativeNotifications'
import KeyboardDismiss from './KeyboardDismiss'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><TripNavigation /><KeyboardDismiss /><NativeNotifications>{children}</NativeNotifications></SessionProvider>
}
