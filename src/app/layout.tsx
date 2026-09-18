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
  viewportFit: 'cover',
  themeColor: '#303b2c',
}

export const metadata: Metadata = {
  title: 'Postcard — Travel lives here',
  description: 'Collect places. Keep the memories. Plan trips and share your favorite places with friends on Postcard.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-screen bg-[#f3eee5] font-[family-name:var(--font-geist-sans)]">
        <Providers>
          <Navbar />
          <main className="app-main">{children}</main>
          <BottomNavWrapper />
        </Providers>
      </body>
    </html>
  )
}
