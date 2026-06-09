import type { MetadataRoute } from 'next';
import { customerConfig } from '@/config/settings';

// ============================================
// ROBOTS.TXT CONFIGURATION
// ============================================

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/login',
          '/konto/',
          '/_next/',
          '/checkout/',
        ],
      },
    ],
    sitemap: `${customerConfig.website}/sitemap.xml`,
  };
}
