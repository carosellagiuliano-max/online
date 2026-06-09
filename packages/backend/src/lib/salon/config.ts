import { createServerClient } from '@/lib/db/client';
import { cache } from 'react';

// ============================================
// TYPES
// ============================================

export interface SalonConfig {
  // Identity
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  ownerName: string | null;
  logoUrl: string | null;

  // Location
  address: {
    street: string | null;
    zipCode: string | null;
    city: string | null;
    country: string;
  };

  // Contact
  phone: string | null;
  email: string | null;
  website: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;

  // Regional
  timezone: string;
  currency: string;
  locale: string;
  vatRate: number;

  // SEO
  seo: {
    title: string | null;
    description: string | null;
    keywords: string[];
    ogImageUrl: string | null;
  };
}

// ============================================
// DEFAULTS (used when no salon data exists)
// ============================================

export const DEFAULT_SALON_CONFIG: SalonConfig = {
  id: '',
  name: 'Salon',
  slug: 'salon',
  tagline: null,
  ownerName: null,
  logoUrl: null,

  address: {
    street: null,
    zipCode: null,
    city: null,
    country: 'Schweiz',
  },

  phone: null,
  email: null,
  website: null,
  instagramUrl: null,
  facebookUrl: null,

  timezone: 'Europe/Zurich',
  currency: 'CHF',
  locale: 'de-CH',
  vatRate: 8.1,

  seo: {
    title: null,
    description: null,
    keywords: [],
    ogImageUrl: null,
  },
};

// ============================================
// FETCH SALON CONFIG FROM DATABASE
// ============================================

// In-memory cache for salon config (for non-React contexts)
let cachedConfig: SalonConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch salon config from database
 * Uses React's cache() for request-level deduplication in server components
 * Falls back to in-memory cache for non-React contexts
 */
export const getSalonConfig = cache(async (): Promise<SalonConfig> => {
  // Check in-memory cache first (for non-React contexts)
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const supabase = createServerClient();

  if (!supabase) {
    console.warn('getSalonConfig: Supabase client not available, using defaults');
    return DEFAULT_SALON_CONFIG;
  }

  try {
    // Fetch the first active salon (single-tenant apps have one salon)
    const { data: salon, error } = await supabase
      .from('salons')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error || !salon) {
      console.warn('getSalonConfig: No salon found, using defaults', error?.message);
      return DEFAULT_SALON_CONFIG;
    }

    const config: SalonConfig = {
      id: salon.id,
      name: salon.name,
      slug: salon.slug,
      tagline: salon.tagline ?? null,
      ownerName: salon.owner_name ?? null,
      logoUrl: salon.logo_url ?? null,

      address: {
        street: salon.address ?? null,
        zipCode: salon.zip_code ?? null,
        city: salon.city ?? null,
        country: salon.country ?? 'Schweiz',
      },

      phone: salon.phone ?? null,
      email: salon.email ?? null,
      website: salon.website ?? null,
      instagramUrl: salon.instagram_url ?? null,
      facebookUrl: salon.facebook_url ?? null,

      timezone: salon.timezone,
      currency: salon.currency,
      locale: salon.locale ?? 'de-CH',
      vatRate: Number(salon.default_vat_rate) || 8.1,

      seo: {
        title: salon.seo_title ?? null,
        description: salon.seo_description ?? null,
        keywords: salon.seo_keywords ?? [],
        ogImageUrl: salon.og_image_url ?? null,
      },
    };

    // Update in-memory cache
    cachedConfig = config;
    cacheTimestamp = now;

    return config;
  } catch (err) {
    console.error('getSalonConfig: Error fetching salon config', err);
    return DEFAULT_SALON_CONFIG;
  }
});

/**
 * Get salon config synchronously (from cache only)
 * Returns null if cache is empty - use getSalonConfig() to fetch
 */
export function getSalonConfigSync(): SalonConfig | null {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }
  return null;
}

/**
 * Clear the salon config cache
 * Call this when salon settings are updated
 */
export function clearSalonConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

/**
 * Helper to get formatted address string
 */
export function getFormattedAddress(config: SalonConfig): string {
  const parts = [
    config.address.street,
    [config.address.zipCode, config.address.city].filter(Boolean).join(' '),
    config.address.country,
  ].filter(Boolean);

  return parts.join(', ');
}

/**
 * Helper to get full business name (name + owner if available)
 */
export function getFullBusinessName(config: SalonConfig): string {
  if (config.ownerName) {
    return `${config.name} by ${config.ownerName}`;
  }
  return config.name;
}
