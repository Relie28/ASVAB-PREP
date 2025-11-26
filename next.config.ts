import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: builds a purely static `out/` directory suitable for GitHub Pages
  output: "export",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  // Next.js，nodemon
  reactStrictMode: false,
  webpack: (config, { dev }) => {
    if (dev) {
      // webpack
      // Only ignore node_modules so source files are watched for Fast Refresh
      config.watchOptions = {
        ignored: /node_modules/,
      };
    }
    return config;
  },
  eslint: {
    // ESLint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;