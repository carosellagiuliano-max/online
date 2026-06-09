export interface GalleryCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean;
}

export interface GalleryImageRow {
  id: string;
  url: string;
  alt_text: string | null;
  title: string | null;
  description: string | null;
  category_id: string | null;
  sort_order: number | null;
  is_active: boolean;
  show_on_homepage: boolean | null;
  created_at?: string | null;
}

export interface PublicGalleryImage {
  id: string;
  url: string;
  alt: string;
  title: string | null;
  description: string | null;
  category?: string;
}

export interface PublicGalleryCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  images: PublicGalleryImage[];
}

function sortNumber(value: number | null | undefined): number {
  return typeof value === 'number' ? value : 0;
}

function bySortOrder<T extends { sort_order?: number | null; created_at?: string | null }>(
  a: T,
  b: T
): number {
  const sortDiff = sortNumber(a.sort_order) - sortNumber(b.sort_order);
  if (sortDiff !== 0) return sortDiff;
  return (a.created_at || '').localeCompare(b.created_at || '');
}

export function getGalleryAltText(image: Pick<GalleryImageRow, 'alt_text' | 'title'>): string {
  return image.alt_text?.trim() || image.title?.trim() || 'Galerie Bild';
}

export function buildPublicGalleryGroups(
  categories: GalleryCategoryRow[],
  images: GalleryImageRow[]
): PublicGalleryCategory[] {
  const activeCategories = categories
    .filter((category) => category.is_active)
    .sort(bySortOrder);

  const activeCategoryIds = new Set(activeCategories.map((category) => category.id));
  const activeImages = images
    .filter(
      (image) =>
        image.is_active &&
        image.url.trim().length > 0 &&
        (!image.category_id || activeCategoryIds.has(image.category_id))
    )
    .sort(bySortOrder);

  const groups: PublicGalleryCategory[] = activeCategories
    .map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: sortNumber(category.sort_order),
      images: activeImages
        .filter((image) => image.category_id === category.id)
        .map((image) => ({
          id: image.id,
          url: image.url,
          alt: getGalleryAltText(image),
          title: image.title,
          description: image.description,
          category: category.name,
        })),
    }))
    .filter((category) => category.images.length > 0);

  const uncategorizedImages = activeImages
    .filter((image) => !image.category_id)
    .map((image) => ({
      id: image.id,
      url: image.url,
      alt: getGalleryAltText(image),
      title: image.title,
      description: image.description,
    }));

  if (uncategorizedImages.length > 0) {
    groups.push({
      id: 'uncategorized',
      name: 'Weitere Impressionen',
      slug: 'weitere-impressionen',
      description: null,
      sortOrder: Number.MAX_SAFE_INTEGER,
      images: uncategorizedImages,
    });
  }

  return groups;
}

export function buildHomepageGalleryImages(
  categories: GalleryCategoryRow[],
  images: GalleryImageRow[],
  maxItems = 8
): PublicGalleryImage[] {
  return buildPublicGalleryGroups(categories, images)
    .flatMap((category) =>
      category.images.map((image) => ({
        ...image,
        category: category.name,
      }))
    )
    .filter((image) => {
      const source = images.find((item) => item.id === image.id);
      return source?.show_on_homepage !== false;
    })
    .slice(0, maxItems);
}
