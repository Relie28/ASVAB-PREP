import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For GitHub Pages static hosting we need a static HTML export.
  // Next.js removed `next export` in v15 — enable `output: 'export'` so
  // `next build` produces a static `out/` directory suitable for Pages.
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
