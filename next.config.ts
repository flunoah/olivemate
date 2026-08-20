import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => `build-${Date.now()}`,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "https://olivemate-api.onrender.com/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
