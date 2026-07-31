/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.BUILD_DIR || '.next',
  reactStrictMode: true,

  // Allow images from local uploads and common image hosts
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
    // Allow serving images from the /uploads/ folder (local storage)
    localPatterns: [
      { pathname: '/uploads/**' },
    ],
  },

  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3000';
    const frontendUrl = process.env.FRONTEND_INTERNAL_URL || 'http://127.0.0.1:5175';
    
    return [
      // Proxy everything EXCEPT our own public API routes to the backend.
      // The local routes under /api/public/* are handled by Next.js itself.
      // Any route NOT matched by a local file will fall through to backend.
      {
        source: '/api/billing/:path*',
        destination: `${backendUrl}/api/billing/:path*`,
      },
      {
        source: '/api/admin/:path*',
        destination: `${backendUrl}/api/admin/:path*`,
      },
      {
        source: '/api/auth/:path*',
        destination: `${backendUrl}/api/auth/:path*`,
      },
      // Proxy /billing to the Vite frontend SPA
      {
        source: '/billing',
        destination: `${frontendUrl}/billing`,
      },
      {
        source: '/billing/:path*',
        destination: `${frontendUrl}/billing/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
