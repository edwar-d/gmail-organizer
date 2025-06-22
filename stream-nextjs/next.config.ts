import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/flask/:path*',
        destination: 'http://localhost:5000/:path*',
      },
    ];
  },
  // Enable experimental features for better API handling
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:5000']
    }
  }
};

export default nextConfig;
