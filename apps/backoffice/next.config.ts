import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    const apiDestination = process.env.API_URL || "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiDestination}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
