import type { Salon, OpeningHour } from '@/lib/actions';

// ============================================
// JSON-LD STRUCTURED DATA COMPONENTS
// ============================================

type LocalBusinessProps = {
  salon: Salon | null;
  openingHours: OpeningHour[];
};

/**
 * JSON-LD for Local Business (Hair Salon)
 * https://schema.org/HairSalon
 */
export function LocalBusinessJsonLd({ salon, openingHours }: LocalBusinessProps) {
  if (!salon) return null;

  const sameAs = [salon.instagramUrl, salon.facebookUrl].filter(Boolean);
  const openingHoursSpecification = openingHours
    .filter((h) => h.isOpen)
    .map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: getDayOfWeekSchema(h.dayOfWeek),
      opens: h.openTime?.substring(0, 5) || '09:00',
      closes: h.closeTime?.substring(0, 5) || '18:00',
    }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    '@id': salon.website ? `${salon.website}/#organization` : undefined,
    name: salon.name,
    url: salon.website || undefined,
    telephone: salon.phone,
    email: salon.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: salon.address,
      addressLocality: salon.city,
      postalCode: salon.zipCode,
      addressCountry: 'CH',
    },
    openingHoursSpecification,
    priceRange: 'CHF 35 - CHF 350',
    currenciesAccepted: 'CHF',
    paymentAccepted: ['Cash', 'Credit Card', 'TWINT'],
    areaServed: salon.city ? {
      '@type': 'City',
      name: salon.city,
    } : undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/**
 * JSON-LD for a single Service
 */
type ServiceJsonLdProps = {
  name: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
  salonName: string;
};

export function ServiceJsonLd({
  name,
  description,
  priceCents,
  durationMinutes,
  salonName,
}: ServiceJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    provider: {
      '@type': 'HairSalon',
      name: salonName,
    },
    offers: {
      '@type': 'Offer',
      price: (priceCents / 100).toFixed(2),
      priceCurrency: 'CHF',
    },
    estimatedDuration: `PT${durationMinutes}M`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/**
 * JSON-LD for Breadcrumb
 */
type BreadcrumbItem = {
  name: string;
  url: string;
};

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/**
 * JSON-LD for Product
 */
type ProductJsonLdProps = {
  name: string;
  description: string;
  priceCents: number;
  brand: string | null;
  inStock: boolean;
  imageUrl: string | null;
};

export function ProductJsonLd({
  name,
  description,
  priceCents,
  brand,
  inStock,
  imageUrl,
}: ProductJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    brand: brand
      ? {
          '@type': 'Brand',
          name: brand,
        }
      : undefined,
    image: imageUrl,
    offers: {
      '@type': 'Offer',
      price: (priceCents / 100).toFixed(2),
      priceCurrency: 'CHF',
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// ============================================
// HELPERS
// ============================================

function getDayOfWeekSchema(dayOfWeek: number): string {
  const days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  return days[dayOfWeek] || 'Monday';
}
