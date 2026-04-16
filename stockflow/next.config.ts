import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Recharts ships very large TypeScript declaration files that cause
  // Next.js's bundled tsc worker to run out of heap on memory-constrained
  // machines. Type-checking is still enforced in CI via `npx tsc --noEmit`.
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverExternalPackages: ['@prisma/client'],
  },
};

export default nextConfig;
