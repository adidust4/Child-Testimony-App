import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  basePath: "/Child-Testimony-App",
  allowedDevOrigins: ["192.168.1.69"],
};

export default nextConfig;