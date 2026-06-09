import { describe, expect, it } from 'vitest';
import {
  buildHomepageGalleryImages,
  buildPublicGalleryGroups,
  type GalleryCategoryRow,
  type GalleryImageRow,
} from '@/lib/domain/gallery';

const categories: GalleryCategoryRow[] = [
  {
    id: 'cat-active',
    name: 'Colorationen',
    slug: 'colorationen',
    description: null,
    sort_order: 2,
    is_active: true,
  },
  {
    id: 'cat-first',
    name: 'Schnitte',
    slug: 'schnitte',
    description: null,
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'cat-hidden',
    name: 'Intern',
    slug: 'intern',
    description: null,
    sort_order: 3,
    is_active: false,
  },
];

const images: GalleryImageRow[] = [
  {
    id: 'img-hidden-category',
    url: 'https://example.com/hidden.webp',
    alt_text: 'Hidden',
    title: 'Hidden',
    description: null,
    category_id: 'cat-hidden',
    sort_order: 1,
    is_active: true,
    show_on_homepage: true,
  },
  {
    id: 'img-inactive',
    url: 'https://example.com/inactive.webp',
    alt_text: 'Inactive',
    title: 'Inactive',
    description: null,
    category_id: 'cat-first',
    sort_order: 1,
    is_active: false,
    show_on_homepage: true,
  },
  {
    id: 'img-second',
    url: 'https://example.com/second.webp',
    alt_text: 'Second',
    title: 'Second',
    description: null,
    category_id: 'cat-first',
    sort_order: 2,
    is_active: true,
    show_on_homepage: false,
  },
  {
    id: 'img-first',
    url: 'https://example.com/first.webp',
    alt_text: null,
    title: 'First title',
    description: 'Description',
    category_id: 'cat-first',
    sort_order: 1,
    is_active: true,
    show_on_homepage: true,
  },
  {
    id: 'img-color',
    url: 'https://example.com/color.webp',
    alt_text: 'Color',
    title: null,
    description: null,
    category_id: 'cat-active',
    sort_order: 1,
    is_active: true,
    show_on_homepage: true,
  },
  {
    id: 'img-uncategorized',
    url: 'https://example.com/open.webp',
    alt_text: 'Open',
    title: null,
    description: null,
    category_id: null,
    sort_order: 1,
    is_active: true,
    show_on_homepage: true,
  },
];

describe('gallery domain mapping', () => {
  it('groups only active images in active categories and keeps uncategorized images', () => {
    const groups = buildPublicGalleryGroups(categories, images);

    expect(groups.map((group) => group.slug)).toEqual([
      'schnitte',
      'colorationen',
      'weitere-impressionen',
    ]);
    expect(groups[0].images.map((image) => image.id)).toEqual(['img-first', 'img-second']);
    expect(groups.flatMap((group) => group.images.map((image) => image.id))).not.toContain('img-hidden-category');
    expect(groups.flatMap((group) => group.images.map((image) => image.id))).not.toContain('img-inactive');
  });

  it('uses homepage flags for homepage images', () => {
    const homepageImages = buildHomepageGalleryImages(categories, images, 10);

    expect(homepageImages.map((image) => image.id)).toEqual([
      'img-first',
      'img-color',
      'img-uncategorized',
    ]);
  });

  it('falls back to title for missing alt text', () => {
    const groups = buildPublicGalleryGroups(categories, images);
    const firstImage = groups[0].images[0];

    expect(firstImage.alt).toBe('First title');
  });
});
