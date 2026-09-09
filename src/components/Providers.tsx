'use client'

import { SessionProvider } from 'next-auth/react'
import NativeNotifications from './NativeNotifications'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><NativeNotifications>{children}</NativeNotifications></SessionProvider>
}
