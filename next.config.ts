import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.aimakers.co',
      },
      {
        protocol: 'https',
        hostname: 'aimakers.co',
      },
      {
        protocol: 'https',
        hostname: 'www.veostudio.ai',
      },
      {
        protocol: 'https',
        hostname: 'veostudio.ai',
      },
    ],
  },
};

export default nextConfig;
