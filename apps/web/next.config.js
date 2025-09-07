/** @type {import('next').NextConfig} */
const path = require('path')
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ["@gantt/shared"],
  
  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },
  
  // Bundle optimization settings
  experimental: {
    optimizePackageImports: [
      '@heroicons/react',
      'lucide-react',
      'd3-array',
      'd3-scale',
      'd3-time',
      'date-fns',
      'react-hot-toast',
      '@tanstack/react-query',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities'
    ],
  },
  
  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    output: 'standalone',
    poweredByHeader: false,
    compress: true,
  }),
  
  // Code splitting and chunk optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (!dev && !isServer) {
      // Optimize bundle splitting
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        chunks: 'all',
        minSize: 20000,
        maxSize: 150000, // Limit chunk size to 150KB
        cacheGroups: {
          // React and core libraries
          react: {
            name: 'react',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            priority: 30,
            enforce: true,
          },
          
          // Next.js framework code
          nextjs: {
            name: 'nextjs',
            chunks: 'all',
            test: /[\\/]node_modules[\\/]next[\\/]/,
            priority: 25,
            enforce: true,
          },
          
          // Gantt-specific components (largest custom code)
          gantt: {
            name: 'gantt',
            chunks: 'all',
            test: /[\\/]src[\\/]components[\\/]gantt[\\/]/,
            priority: 20,
            minSize: 10000,
          },
          
          // Dashboard and analytics components
          dashboard: {
            name: 'dashboard',  
            chunks: 'all',
            test: /[\\/]src[\\/]components[\\/](dashboard|telemetry)[\\/]/,
            priority: 19,
            minSize: 10000,
          },
          
          // D3 visualization libraries
          d3: {
            name: 'd3',
            chunks: 'all',
            test: /[\\/]node_modules[\\/]d3-/,
            priority: 18,
            enforce: true,
          },
          
          // UI libraries
          ui: {
            name: 'ui',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](@headlessui|@tanstack|zustand)[\\/]/,
            priority: 17,
            enforce: true,
          },
          
          // Icons (separate chunk for caching)
          icons: {
            name: 'icons',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](@heroicons|lucide-react)[\\/]/,
            priority: 16,
            enforce: true,
          },
          
          // Utility libraries
          utils: {
            name: 'utils',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](date-fns|clsx|tailwind-merge)[\\/]/,
            priority: 15,
            enforce: true,
          },
          
          // DnD libraries
          dnd: {
            name: 'dnd',
            chunks: 'all',
            test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,
            priority: 14,
            enforce: true,
          },
          
          // Other vendor libraries
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /[\\/]node_modules[\\/]/,
            priority: 10,
            minSize: 20000,
            maxSize: 100000, // Limit vendor chunks
          },
        },
      }
      
      // Tree shaking optimization
      config.optimization.usedExports = true
      config.optimization.sideEffects = false
      
      // Module concatenation for smaller bundles
      config.optimization.concatenateModules = true
    }
    
    return config
  },
  
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001"}/:path*`
      }
    ];
  }
};

module.exports = withBundleAnalyzer(nextConfig);