import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  serverExternalPackages: ['mammoth', '@react-pdf/renderer'],
  images: {
    localPatterns: [
      {
        pathname: '/api/img',
      },
      // Brand images (the Postcard stamp).
      {
        pathname: '/brand/**',
      },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  // Usage analytics (lib/analytics.ts) reach PostHog through our own address, so ad blockers don't drop them.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/:path*', destination: 'https://us.i.posthog.com/:path*' },
    ]
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
