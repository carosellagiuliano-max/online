import type { MetadataRoute } from 'next';
import { customerConfig } from '@/config/settings';

// ============================================
// SITEMAP CONFIGURATION
// ============================================

const BASE_URL = customerConfig.website;

export default function sitemap(): MetadataRoute.Sitemap {
  // Static routes
  const staticRoutes = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 1,
    },
    {
      url: `${BASE_URL}/leistungen`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/termin-buchen`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/shop`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/shop/gutscheine`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/galerie`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/ueber-uns`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/team`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/kontakt`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/impressum`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/datenschutz`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/agb`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
  ];

  // TODO: Add dynamic routes from database
  // - Product pages: /shop/[productId]
  // - Category pages: /shop/kategorie/[slug]
  // - Service detail pages: /leistungen/[slug]

  return staticRoutes;
}
