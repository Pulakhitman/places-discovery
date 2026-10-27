import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow hard-refresh / tooling against 127.0.0.1 while `next dev` binds localhost.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
