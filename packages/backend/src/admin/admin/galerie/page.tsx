import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { protectManagerPage } from '@/lib/auth/rbac';
import { resolveStaffSalonId } from '@/lib/auth/admin-context';
import { isMockMode } from '@/lib/mock/mock-auth';
import { getMockGallerySeed } from '@/lib/actions/gallery';
import { AdminGalleryList } from '@/components/admin/admin-gallery-list';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Galerie verwalten',
};

// ============================================
// DATA FETCHING
// ============================================

type GalleryCategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type GalleryImageRow = {
  id: string;
  url: string;
  alt_text: string | null;
  title: string | null;
  description: string | null;
  category_id: string | null;
  storage_path: string | null;
  sort_order: number;
  is_active: boolean;
  show_on_homepage: boolean;
  created_at: string;
  updated_at: string;
  gallery_categories?: { id: string; name: string | null } | null;
};

type GalleryImageForAdmin = Omit<GalleryImageRow, 'gallery_categories'> & {
  category_name: string | null;
};

type GalleryData = {
  salonId: string;
  categories: GalleryCategoryRow[];
  images: GalleryImageForAdmin[];
};

async function getGalleryData(): Promise<GalleryData> {
  const staffMember = await protectManagerPage();
  const salonId = resolveStaffSalonId(staffMember.salon_id);

  if (isMockMode()) {
    const seed = await getMockGallerySeed();
    const categoryNames = new Map(seed.categories.map((category) => [category.id, category.name]));
    return {
      salonId,
      categories: seed.categories.map((category) => ({
        ...category,
        sort_order: category.sort_order ?? 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      })),
      images: seed.images.map((image) => ({
        ...image,
        sort_order: image.sort_order ?? 0,
        show_on_homepage: image.show_on_homepage ?? false,
        storage_path: null,
        created_at: image.created_at || '2026-01-01T00:00:00Z',
        updated_at: image.created_at || '2026-01-01T00:00:00Z',
        category_name: image.category_id
          ? categoryNames.get(image.category_id) || null
          : null,
      })),
    };
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { salonId, categories: [], images: [] };
  }

  const [categoriesResult, imagesResult] = await Promise.all([
    supabase
      .from('gallery_categories')
      .select('id, name, slug, description, sort_order, is_active, created_at, updated_at')
      .eq('salon_id', salonId)
      .order('sort_order'),
    supabase
      .from('gallery_images')
      .select(`
        id,
        url,
        alt_text,
        title,
        description,
        category_id,
        storage_path,
        sort_order,
        is_active,
        show_on_homepage,
        created_at,
        updated_at,
        gallery_categories (id, name)
      `)
      .eq('salon_id', salonId)
      .order('sort_order'),
  ]);

  return {
    salonId,
    categories: (categoriesResult.data || []) as GalleryCategoryRow[],
    images: ((imagesResult.data || []) as GalleryImageRow[]).map((img) => {
      const { gallery_categories: category, ...image } = img;
      return {
        ...image,
        category_name: category?.name || null,
      };
    }),
  };
}

// ============================================
// ADMIN GALLERY PAGE
// ============================================

export default async function AdminGaleriePage() {
  const { salonId, categories, images } = await getGalleryData();

  return (
    <AdminGalleryList
      salonId={salonId}
      categories={categories}
      images={images}
    />
  );
}
