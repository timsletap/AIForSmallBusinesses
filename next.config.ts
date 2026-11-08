import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the seeded JSON database with the serverless functions that read it.
  outputFileTracingIncludes: { "/**": ["./data/**/*.json"] },
  webpack: (config, { dev }) => {
    if (dev) {
      // The seed script rewrites data/*.json; don't hot-reload the app on every write.
      config.watchOptions = { ...config.watchOptions, ignored: ["**/node_modules/**", "**/data/**", "**/.playwright-mcp/**", "**/.git/**"] };
    }
    return config;
  },
};

export default nextConfig;
