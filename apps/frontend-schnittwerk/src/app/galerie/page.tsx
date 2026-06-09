import type { Metadata } from 'next';
import { getPublicGalleryData, getSalon } from '@/lib/actions';
import { PublicGalleryPage } from '@/components/gallery/public-gallery-page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Galerie',
  description:
    'Entdecken Sie aktuelle Arbeiten und Salon-Impressionen von BeautifyPRO in St. Gallen.',
};

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';
const SALON_ID = process.env.NEXT_PUBLIC_SALON_ID || DEFAULT_SALON_ID;

export default async function GaleriePage() {
  const [galleryCategories, salon] = await Promise.all([
    getPublicGalleryData(SALON_ID),
    getSalon(SALON_ID),
  ]);

  return (
    <PublicGalleryPage
      categories={galleryCategories}
      instagramUrl={salon?.instagramUrl}
      instagramLabel={salon?.instagramUrl ? `${salon.name} auf Instagram` : null}
      description="Lassen Sie sich von unseren Schnitten, Colorationen und Salonmomenten inspirieren."
    />
  );
}
