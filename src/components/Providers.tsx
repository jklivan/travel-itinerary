'use client'

import { SessionProvider } from 'next-auth/react'
import TripNavigation from './TripNavigation'
import NativeNotifications from './NativeNotifications'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><TripNavigation /><NativeNotifications>{children}</NativeNotifications></SessionProvider>
}
