import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Providers from '@/components/Providers'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'TravelShare — Share Your Itineraries',
  description: 'Discover and share travel itineraries with the world.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50 font-[family-name:var(--font-geist-sans)]">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100">
            TravelShare — Share your adventures
          </footer>
        </Providers>
      </body>
    </html>
  )
}
