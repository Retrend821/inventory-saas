import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['recharts', 'exceljs', 'xlsx-populate'],
  },
  async headers() {
    return [
      {
        source: '/:path((?!_next/static|_next/image|favicon\\.ico).*)',
        headers: [
          {
            key: 'CDN-Cache-Control',
            value: 'no-store',
          },
          {
            key: 'Netlify-CDN-Cache-Control',
            value: 'no-store',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
