import type { Metadata, Viewport } from 'next'
import { Geist, Playfair_Display } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Providers from '@/components/Providers'
import BottomNavWrapper from '@/components/BottomNavWrapper'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', style: ['normal', 'italic'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'TravelShare — Share Your Itineraries',
  description: 'Discover and share travel itineraries with the world.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 font-[family-name:var(--font-geist-sans)]">
        <Providers>
          <Navbar />
          <main className="pb-24">{children}</main>
          <BottomNavWrapper />
        </Providers>
      </body>
    </html>
  )
}
