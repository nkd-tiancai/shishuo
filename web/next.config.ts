import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["openai", "pdfjs-dist"],
};

export default nextConfig;
