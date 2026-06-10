'use server';

import { unstable_cache } from 'next/cache';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isMockMode } from '@/lib/mock/mock-auth';
import {
  buildHomepageGalleryImages,
  buildPublicGalleryGroups,
  type GalleryCategoryRow,
  type GalleryImageRow,
  type PublicGalleryCategory,
  type PublicGalleryImage,
} from '@/lib/domain/gallery';

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';
const MOCK_GALLERY_CATEGORIES: GalleryCategoryRow[] = [
  {
    id: 'mock-gallery-color',
    name: 'Color & Styling',
    slug: 'color-styling',
    description: 'Demo-Impressionen fuer Farbe, Styling und Finish.',
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'mock-gallery-salon',
    name: 'Salon',
    slug: 'salon',
    description: 'Stimmungsbilder fuer die BeautifyPRO-Praesentation.',
    sort_order: 2,
    is_active: true,
  },
];
const MOCK_GALLERY_IMAGES: GalleryImageRow[] = [
  {
    id: 'mock-gallery-001',
    url: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=1200&q=80',
    alt_text: 'Professionelles Haarstyling in einem Beauty-Salon',
    title: 'Glossy Styling',
    description: 'Demo-Bild fuer die Startseiten-Galerie.',
    category_id: 'mock-gallery-color',
    sort_order: 1,
    is_active: true,
    show_on_homepage: true,
    created_at: '2026-01-01T10:00:00Z',
  },
  {
    id: 'mock-gallery-002',
    url: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=1200&q=80',
    alt_text: 'Friseurarbeit mit Foil-Highlights',
    title: 'Color Work',
    description: 'Farbe und Pflege als Demo-Referenz.',
    category_id: 'mock-gallery-color',
    sort_order: 2,
    is_active: true,
    show_on_homepage: true,
    created_at: '2026-01-02T10:00:00Z',
  },
  {
    id: 'mock-gallery-003',
    url: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=1200&q=80',
    alt_text: 'Moderner Beauty-Salon Innenraum',
    title: 'Salon Atmosphaere',
    description: 'Demo-Eindruck fuer Public Website und Galerie.',
    category_id: 'mock-gallery-salon',
    sort_order: 1,
    is_active: true,
    show_on_homepage: true,
    created_at: '2026-01-03T10:00:00Z',
  },
  {
    id: 'mock-gallery-004',
    url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=1200&q=80',
    alt_text: 'Beauty-Produkte auf einer Salonablage',
    title: 'Pflegeprodukte',
    description: 'Passend fuer Shop- und Salon-Demo.',
    category_id: 'mock-gallery-salon',
    sort_order: 2,
    is_active: true,
    show_on_homepage: true,
    created_at: '2026-01-04T10:00:00Z',
  },
];

/**
 * Mock-mode seed data for server pages (e.g. /admin/galerie).
 * Exposed as an async function because 'use server' files may
 * only export async functions.
 */
export async function getMockGallerySeed(): Promise<{
  categories: GalleryCategoryRow[];
  images: GalleryImageRow[];
}> {
  return {
    categories: MOCK_GALLERY_CATEGORIES,
    images: MOCK_GALLERY_IMAGES,
  };
}

function resolvePublicSalonId(salonId?: string | null): string {
  return salonId || process.env.NEXT_PUBLIC_SALON_ID || DEFAULT_SALON_ID;
}

async function fetchGalleryRows(salonId?: string | null): Promise<{
  categories: GalleryCategoryRow[];
  images: GalleryImageRow[];
}> {
  if (isMockMode()) {
    return {
      categories: MOCK_GALLERY_CATEGORIES,
      images: MOCK_GALLERY_IMAGES,
    };
  }

  const resolvedSalonId = resolvePublicSalonId(salonId);
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { categories: [], images: [] };
  }

  const [categoriesResult, imagesResult] = await Promise.all([
    supabase
      .from('gallery_categories')
      .select('id, name, slug, description, sort_order, is_active')
      .eq('salon_id', resolvedSalonId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('gallery_images')
      .select('id, url, alt_text, title, description, category_id, sort_order, is_active, show_on_homepage, created_at')
      .eq('salon_id', resolvedSalonId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  if (categoriesResult.error) {
    console.error('[gallery] Failed to load categories:', categoriesResult.error.message);
  }

  if (imagesResult.error) {
    console.error('[gallery] Failed to load images:', imagesResult.error.message);
  }

  return {
    categories: (categoriesResult.data || []) as GalleryCategoryRow[],
    images: (imagesResult.data || []) as GalleryImageRow[],
  };
}

export const getPublicGalleryData = unstable_cache(
  async (salonId?: string | null): Promise<PublicGalleryCategory[]> => {
    const { categories, images } = await fetchGalleryRows(salonId);
    return buildPublicGalleryGroups(categories, images);
  },
  ['public-gallery-data'],
  {
    tags: ['gallery', 'salon'],
    revalidate: 300,
  }
);

export const getHomepageGalleryImages = unstable_cache(
  async (salonId?: string | null, maxItems = 8): Promise<PublicGalleryImage[]> => {
    const { categories, images } = await fetchGalleryRows(salonId);
    return buildHomepageGalleryImages(categories, images, maxItems);
  },
  ['homepage-gallery-images'],
  {
    tags: ['gallery', 'salon'],
    revalidate: 300,
  }
);

export type { PublicGalleryCategory, PublicGalleryImage };
