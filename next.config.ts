import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => `build-${Date.now()}`,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://olivemate-api.onrender.com/api/:path*",
      },
    ];
  },
};

export default nextConfig;
