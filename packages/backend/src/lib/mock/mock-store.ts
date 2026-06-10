/**
 * ============================================
 * BeautifyPRO - Mock Store (Demo-Modus)
 * Browser-side persistence for entities created
 * in the admin area while running without a
 * database. Each collection lives under one
 * localStorage key and only exists per browser.
 * ============================================
 */

const PREFIX = 'mock_added_';

export const MOCK_STORE_KEYS = {
  customers: `${PREFIX}customers`,
  appointments: `${PREFIX}appointments`,
  galleryImages: `${PREFIX}gallery_images`,
  inventoryAdjustments: `${PREFIX}inventory_adjustments`,
} as const;

export type MockStoreKey = (typeof MOCK_STORE_KEYS)[keyof typeof MOCK_STORE_KEYS];

function storage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

/** Read a collection; returns [] on SSR, missing key, or corrupt JSON. */
export function readMockCollection<T>(key: MockStoreKey): T[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeMockCollection<T>(key: MockStoreKey, items: T[]): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(items));
    return true;
  } catch {
    // Quota exceeded (e.g. large images) or storage disabled
    return false;
  }
}

/** Append one item; returns the new collection (unchanged on failure). */
export function addToMockCollection<T>(key: MockStoreKey, item: T): T[] {
  const items = [...readMockCollection<T>(key), item];
  return writeMockCollection(key, items) ? items : readMockCollection<T>(key);
}

/** Remove items matching the predicate; returns the new collection. */
export function removeFromMockCollection<T>(
  key: MockStoreKey,
  predicate: (item: T) => boolean
): T[] {
  const items = readMockCollection<T>(key).filter((item) => !predicate(item));
  writeMockCollection(key, items);
  return items;
}

/** Replace items matching the predicate via the updater; returns the new collection. */
export function updateMockCollection<T>(
  key: MockStoreKey,
  predicate: (item: T) => boolean,
  updater: (item: T) => T
): T[] {
  const items = readMockCollection<T>(key).map((item) =>
    predicate(item) ? updater(item) : item
  );
  writeMockCollection(key, items);
  return items;
}

/** Stable-enough id for demo entities created in the browser. */
export function mockId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
