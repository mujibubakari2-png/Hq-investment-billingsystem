// CORS is handled by src/proxy.ts (the single source of truth).
// Do not add CORS headers here to avoid conflicting/duplicate headers.
const nextConfig = {
    distDir: process.env.BUILD_DIR || '.next',
    // Prisma and bcryptjs must not be bundled by webpack — they use native bindings
    serverExternalPackages: ['@prisma/client', 'bcryptjs', 'ioredis'],

    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },

    // SEC-API-004 FIX: Add security headers to all API responses.
    // HSTS is intentionally omitted here — it should be set by the Nginx reverse proxy
    // so that it only applies to verified HTTPS connections (not HTTP internally).
    async headers() {
        return [
            {
                // Apply to all routes — API and page routes alike
                source: '/:path*',
                headers: [
                    // Prevent browsers from MIME-sniffing responses away from the declared Content-Type
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    // Disallow embedding this application in any frame (clickjacking protection)
                    { key: 'X-Frame-Options', value: 'DENY' },
                    // Only send origin on same-origin requests; no referrer on cross-origin
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    // Disable browser features not used by this API server
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
                    // Basic XSS auditor (legacy browsers)
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                ],
            },
        ];
    },

    // Build optimizations for production deployment
    compiler: {
        removeConsole: process.env.NODE_ENV === "production",
    },
    // Optimize images
    images: {
        unoptimized: true, // Disable image optimization to speed up builds
    },
    // Build performance
    webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
        // Reduce memory usage during build
        if (!dev && !isServer) {
            config.optimization.splitChunks.cacheGroups = {
                ...config.optimization.splitChunks.cacheGroups,
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all',
                    priority: 10,
                },
            };
        }
        return config;
    },
};

export default nextConfig;

