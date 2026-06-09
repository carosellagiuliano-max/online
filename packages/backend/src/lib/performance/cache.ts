/**
 * BeautifyPRO Performance - Caching Utilities
 * Server-side caching helpers for Next.js
 */

import { unstable_cache } from 'next/cache';

// ============================================
// CACHE TAGS
// ============================================

export const CacheTags = {
  // Salon data
  SALON: 'salon',
  SALON_SETTINGS: 'salon-settings',
  OPENING_HOURS: 'opening-hours',

  // Services & Products
  SERVICES: 'services',
  SERVICE_CATEGORIES: 'service-categories',
  PRODUCTS: 'products',
  PRODUCT_CATEGORIES: 'product-categories',

  // Staff
  STAFF: 'staff',
  STAFF_SCHEDULE: 'staff-schedule',

  // Customer specific (use with customer ID)
  CUSTOMER: 'customer',
  APPOINTMENTS: 'appointments',
  ORDERS: 'orders',

  // Analytics
  ANALYTICS: 'analytics',
  DASHBOARD_STATS: 'dashboard-stats',
} as const;

// ============================================
// CACHE DURATIONS (in seconds)
// ============================================

export const CacheDurations = {
  // Static data - rarely changes
  STATIC: 3600, // 1 hour

  // Semi-static - changes occasionally
  SALON_DATA: 1800, // 30 minutes
  SERVICES: 900, // 15 minutes

  // Dynamic - changes frequently
  AVAILABILITY: 60, // 1 minute
  DASHBOARD: 300, // 5 minutes

  // User specific - short cache
  USER_DATA: 60, // 1 minute
} as const;

// ============================================
// CACHED FETCH HELPERS
// ============================================

/**
 * Cache wrapper for salon data
 */
export function cachedSalonData<T>(
  fn: () => Promise<T>,
  tags: string[] = [CacheTags.SALON]
) {
  return unstable_cache(fn, tags, {
    revalidate: CacheDurations.SALON_DATA,
    tags,
  });
}

/**
 * Cache wrapper for services
 */
export function cachedServices<T>(
  fn: () => Promise<T>,
  salonId?: string
) {
  const tags = salonId
    ? [CacheTags.SERVICES, `salon-${salonId}`]
    : [CacheTags.SERVICES];

  return unstable_cache(fn, tags, {
    revalidate: CacheDurations.SERVICES,
    tags,
  });
}

/**
 * Cache wrapper for products
 */
export function cachedProducts<T>(
  fn: () => Promise<T>,
  salonId?: string
) {
  const tags = salonId
    ? [CacheTags.PRODUCTS, `salon-${salonId}`]
    : [CacheTags.PRODUCTS];

  return unstable_cache(fn, tags, {
    revalidate: CacheDurations.SERVICES,
    tags,
  });
}

/**
 * Cache wrapper for dashboard stats
 */
export function cachedDashboardStats<T>(
  fn: () => Promise<T>,
  salonId: string
) {
  const tags = [CacheTags.DASHBOARD_STATS, `salon-${salonId}`];

  return unstable_cache(fn, tags, {
    revalidate: CacheDurations.DASHBOARD,
    tags,
  });
}

// ============================================
// IN-MEMORY CACHE (for client-side)
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T, ttlSeconds: number = 60): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clear entries matching a pattern
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const memoryCache = new MemoryCache();

// ============================================
// DEDUPLICATION
// ============================================

const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Deduplicate concurrent requests for the same resource
 */
export async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  // Check if there's already a pending request
  const pending = pendingRequests.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  // Create new request
  const promise = fetcher().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

// ============================================
// STALE-WHILE-REVALIDATE PATTERN
// ============================================

interface SWROptions {
  staleTime: number; // Serve stale data for this long (ms)
  cacheTime: number; // Keep in cache for this long (ms)
}

const swrCache = new Map<string, { data: unknown; fetchedAt: number }>();

export async function swrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: SWROptions = { staleTime: 60000, cacheTime: 300000 }
): Promise<T> {
  const cached = swrCache.get(key);
  const now = Date.now();

  // Return cached data if fresh
  if (cached && now - cached.fetchedAt < options.staleTime) {
    return cached.data as T;
  }

  // Return stale data while revalidating in background
  if (cached && now - cached.fetchedAt < options.cacheTime) {
    // Revalidate in background
    fetcher().then((data) => {
      swrCache.set(key, { data, fetchedAt: Date.now() });
    });
    return cached.data as T;
  }

  // Fetch fresh data
  const data = await fetcher();
  swrCache.set(key, { data, fetchedAt: now });
  return data;
}
