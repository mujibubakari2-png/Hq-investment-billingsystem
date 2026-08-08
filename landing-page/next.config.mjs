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
          {
            // HSTS is intentionally set here for the storefront (not handled solely by Nginx)
            // to ensure all browsers enforce HTTPS for this origin after the first visit.
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            // Content-Security-Policy — prevents XSS by restricting resource origins.
            // 'unsafe-inline' is required for Framer Motion inline styles and Next.js hydration.
            // Adjust 'connect-src' when adding third-party analytics or payment SDKs.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.paypal.com https://www.sandbox.paypal.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http://localhost",
              "connect-src 'self' https://api.paypal.com https://api.sandbox.paypal.com",
              "frame-src https://www.paypal.com https://www.sandbox.paypal.com",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
