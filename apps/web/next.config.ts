import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ESLint runs as a dedicated `pnpm lint` step in CI — skip it during build
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
