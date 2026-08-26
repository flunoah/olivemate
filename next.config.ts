import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => `build-${Date.now()}`,
  async redirects() {
    return [
      {
        source: "/:path*",
        destination: "https://olivemate-api.onrender.com/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
