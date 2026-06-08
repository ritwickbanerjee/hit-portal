import type { NextConfig } from "next";
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  // Performance optimizations
  compress: true,

  // Production optimizations
  productionBrowserSourceMaps: false,

  // Optimize rendering
  reactStrictMode: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    minimumCacheTTL: 60,
  },

  // Experimental features for better performance
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'react-hot-toast'],
  },

  // Turbopack configuration (empty to acknowledge webpack config is intentional)
  turbopack: {},

  async redirects() {
    // To switch the domain back, simply change or comment out this targetDomain variable.
    const targetDomain = "https://hit-portal-five.vercel.app";
    
    if (targetDomain) {
      return [
        {
          source: '/:path*',
          has: [
            {
              type: 'host',
              value: 'hit-portal-six.vercel.app',
            },
          ],
          destination: `${targetDomain.replace(/\/$/, '')}/:path*`,
          permanent: false, 
        },
      ];
    }
    return [];
  },
};

export default withPWA(nextConfig);
