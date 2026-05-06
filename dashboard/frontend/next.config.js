/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    instrumentationHook: false,
  },
  async rewrites() {
    const apiBase = process.env.DASHBOARD_API_INTERNAL || process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) {
      return [];
    }
    return [
      {
        source: '/api/dashboard/:path*',
        destination: `${apiBase}/api/dashboard/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
