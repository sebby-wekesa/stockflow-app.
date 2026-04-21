import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure this is NOT set unless you are using a CDN
  // assetPrefix: './',

  // Recharts ships very large TypeScript declaration files that cause
  // Next.js's bundled tsc worker to run out of heap on memory-constrained
  // machines. Type-checking is still enforced in CI via `npx tsc --noEmit`.
  typescript: {
    ignoreBuildErrors: true,
  },

  // This helps Next.js 16/Turbopack handle external packages like Prisma
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
