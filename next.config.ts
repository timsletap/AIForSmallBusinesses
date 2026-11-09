import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the seed JSON database and SQL migrations with the serverless functions that read them.
  outputFileTracingIncludes: { "/**": ["./data/**/*.json", "./supabase/migrations/*.sql"] },
  webpack: (config, { dev }) => {
    if (dev) {
      // The seed script rewrites data/*.json; don't hot-reload the app on every write.
      config.watchOptions = { ...config.watchOptions, ignored: ["**/node_modules/**", "**/data/**", "**/.playwright-mcp/**", "**/.git/**"] };
    }
    return config;
  },
};

export default nextConfig;
