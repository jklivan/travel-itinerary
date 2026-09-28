import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  serverExternalPackages: ['mammoth'],
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
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
