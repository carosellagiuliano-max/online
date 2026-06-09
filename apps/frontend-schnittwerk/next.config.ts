import type { NextConfig } from 'next';
import path from 'path';

// Domain for image optimization (from env var)
const imageDomain = process.env.NEXT_PUBLIC_DOMAIN;

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',

  // Transpile the backend package
  transpilePackages: ['@beautifypro/backend'],

  // Webpack configuration for path aliases
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/components': path.resolve(__dirname, '../../packages/backend/src/components'),
      '@/lib': path.resolve(__dirname, '../../packages/backend/src/lib'),
      '@/contexts': path.resolve(__dirname, '../../packages/backend/src/contexts'),
      '@/hooks': path.resolve(__dirname, '../../packages/backend/src/hooks'),
    };
    return config;
  },

  // Turbopack configuration for path aliases
  turbopack: {
    root: '../..',
    resolveAlias: {
      '@/components': '../../packages/backend/src/components',
      '@/lib': '../../packages/backend/src/lib',
      '@/contexts': '../../packages/backend/src/contexts',
      '@/hooks': '../../packages/backend/src/hooks',
    },
  },

  // Skip TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true,
  },

  // Enable React strict mode
  reactStrictMode: true,

  // Disable x-powered-by header
  poweredByHeader: false,

  // Hide the Next.js dev overlay logo (bottom-right "N" indicator)
  devIndicators: false,

  // Suppress source map warnings
  productionBrowserSourceMaps: true,

  // Performance: Optimize package imports
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'recharts',
      '@beautifypro/backend',
    ],
    // Increase body size limit for file uploads
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        // Burst stock photos (Shopify)
        protocol: 'https',
        hostname: 'burst.shopifycdn.com',
      },
      {
        // Local development - Supabase storage
        protocol: 'http',
        hostname: 'localhost',
        port: '54321',
        pathname: '/storage/**',
      },
      {
        // Local development - Supabase storage (alternative)
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/**',
      },
      {
        // Docker internal - Kong gateway (for server-side image optimization)
        protocol: 'http',
        hostname: 'kong',
        port: '8000',
        pathname: '/storage/**',
      },
      {
        // Docker host access (for macOS/Windows - allows container to reach host's localhost)
        protocol: 'http',
        hostname: 'host.docker.internal',
        port: '54321',
        pathname: '/storage/**',
      },
      // Dynamic: Add wildcard domain from NEXT_PUBLIC_DOMAIN env var
      ...(imageDomain
        ? [{ protocol: 'https' as const, hostname: `**.${imageDomain}` }]
        : []),
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Security headers
  async headers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const isDev = process.env.NODE_ENV === 'development' || supabaseUrl.includes('localhost');
    const isReplit =
      Boolean(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS) ||
      process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
    const frameAncestors = isReplit
      ? "'self' https://*.replit.com https://*.replit.dev https://*.replit.app https://*.repl.co"
      : "'none'";

    // Build connect-src based on environment
    let connectSrc = "'self' https://*.supabase.co wss://*.supabase.co";
    let imgSrc = "'self' data: blob: https://*.supabase.co https://images.unsplash.com https://burst.shopifycdn.com";

    if (isDev || supabaseUrl.includes('localhost')) {
      // Allow local Supabase in development
      connectSrc += " http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*";
      imgSrc += " http://localhost:* http://127.0.0.1:*";
    }

    // Content Security Policy - allows necessary resources while blocking XSS
    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com`, // unsafe-eval needed for Next.js dev
      `style-src 'self' 'unsafe-inline'`, // unsafe-inline needed for styled-jsx and Tailwind
      `img-src ${imgSrc} https://*.googleapis.com https://*.gstatic.com https://*.google.com`,
      `font-src 'self' data: https://fonts.gstatic.com`,
      `connect-src ${connectSrc} https://*.googleapis.com`,
      `frame-src 'self' https://www.google.com https://maps.google.com`,
      `frame-ancestors ${frameAncestors}`,
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          ...(isReplit ? [] : [{ key: 'X-Frame-Options', value: 'DENY' }]),
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // HSTS: Enforce HTTPS for 1 year, include subdomains
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // Content Security Policy
          { key: 'Content-Security-Policy', value: cspDirectives },
          // Prevent MIME type sniffing
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
