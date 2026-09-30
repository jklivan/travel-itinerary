import type { Metadata, Viewport } from 'next'
import { Caveat, Geist, Playfair_Display } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Providers from '@/components/Providers'
import BottomNavWrapper from '@/components/BottomNavWrapper'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', style: ['normal', 'italic'] })
// Handwritten snapshot captions.
const caveat = Caveat({ subsets: ['latin'], variable: '--font-script' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f3ec',
}

export const metadata: Metadata = {
  title: 'Postcard — Travel lives here',
  description: 'Collect places. Keep the memories. Plan trips and share your favorite places with friends on Postcard.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${playfair.variable} ${caveat.variable} h-full antialiased`}>
      <body className="min-h-screen bg-paper font-[family-name:var(--font-geist-sans)]">
        <Providers>
          <Navbar />
          <main className="app-main">{children}</main>
          <BottomNavWrapper />
        </Providers>
      </body>
    </html>
  )
}
