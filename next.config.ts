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
      // Apple's app-site-association file, for opening our links in the iPhone app (app/api/aasa).
      { source: '/.well-known/apple-app-site-association', destination: '/api/aasa' },
      // OpenAI's site-ownership check for the ChatGPT app directory (app/api/openai-challenge).
      { source: '/.well-known/openai-apps-challenge', destination: '/api/openai-challenge' },
      { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/:path*', destination: 'https://us.i.posthog.com/:path*' },
    ]
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
