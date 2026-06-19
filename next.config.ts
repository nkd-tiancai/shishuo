import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "openai"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
