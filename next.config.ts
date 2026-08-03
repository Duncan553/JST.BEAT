import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't statically generate dynamic routes that need runtime data
  output: 'standalone',
};

export default nextConfig;