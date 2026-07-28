import type { NextConfig } from "next";

const repo = "Child-Testimony-App";

const nextConfig: NextConfig = {
  output: "export",

  images: {
    unoptimized: true,
  },

  basePath: `/${repo}`,
  assetPrefix: `/${repo}/`,

  allowedDevOrigins: ["192.168.1.69"],
};

export default nextConfig;