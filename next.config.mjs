/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {},
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.virolocal.com' }],
        destination: 'https://virolocal.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
