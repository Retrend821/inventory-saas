import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['recharts', 'exceljs', 'xlsx-populate'],
  },
};

export default nextConfig;
