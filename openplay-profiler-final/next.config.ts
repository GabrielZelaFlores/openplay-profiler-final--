import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Needed for plotly / umap-js in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
