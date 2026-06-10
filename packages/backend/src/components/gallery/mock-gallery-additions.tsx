'use client';

/**
 * Demo mode (no database): gallery images created in the admin are
 * persisted per browser in localStorage. This hook exposes them to the
 * public pages so they can be merged into the rendered gallery after
 * mount (hydration-safe). Returns [] in real mode and during SSR.
 */

import { useEffect, useState } from 'react';
import { MOCK_STORE_KEYS, readMockCollection } from '@/lib/mock/mock-store';

const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

/** Shape of gallery images stored by the admin in mock mode. */
export interface MockGalleryAddition {
  id: string;
  url: string;
  alt_text: string | null;
  title: string | null;
  description: string | null;
  category_id: string | null;
  sort_order?: number | null;
  is_active: boolean;
  show_on_homepage?: boolean | null;
  created_at?: string | null;
}

export function useMockGalleryAdditions(): MockGalleryAddition[] {
  const [additions, setAdditions] = useState<MockGalleryAddition[]>([]);

  useEffect(() => {
    if (!isMockMode) return;
    setAdditions(
      readMockCollection<MockGalleryAddition>(MOCK_STORE_KEYS.galleryImages).filter(
        (item) => item.is_active && typeof item.url === 'string' && item.url.length > 0
      )
    );
  }, []);

  return additions;
}
