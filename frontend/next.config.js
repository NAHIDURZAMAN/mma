/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: require('path').join(__dirname),
  // Enable API routes proxy to backend
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: 'http://localhost:2000/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig
