// CORS is handled by src/proxy.ts (the single source of truth).
// Do not add CORS headers here to avoid conflicting/duplicate headers.
const nextConfig = {
    // Build optimizations for production deployment
    // Reduce bundle size and build time
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
