// Customer-specific settings
// Business data now comes from the database (salons table via seed.sql)
// These are fallback defaults used when DB is not available

export const DEFAULT_CONFIG = {
  // Business Information (defaults - actual values from DB)
  name: 'Salon',
  tagline: 'Ihr Friseursalon',

  // Location defaults
  address: {
    street: '',
    zipCode: '',
    city: '',
    country: 'Schweiz',
  },

  // Contact defaults
  phone: '',
  email: '',
  website: process.env.NEXT_PUBLIC_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_DOMAIN}`
    : 'http://localhost:3000',
  instagram: '',

  // Regional Settings (defaults - actual values from DB)
  currency: 'CHF',
  locale: 'de-CH',
  timezone: 'Europe/Zurich',
  vatRate: 8.1,

  // SEO & Metadata defaults
  seo: {
    title: 'Ihr Friseursalon',
    description: 'Professionelle Haarschnitte und Styling.',
    keywords: ['Friseur', 'Salon', 'Haarschnitt'],
    ogImage: '/og-image.jpg',
  },

  // Feature Flags (from env vars - these stay as env vars)
  features: {
    shopEnabled: process.env.NEXT_PUBLIC_FEATURE_SHOP_ENABLED !== 'false',
    bookingEnabled: process.env.NEXT_PUBLIC_FEATURE_BOOKING_ENABLED !== 'false',
    galleryEnabled: process.env.NEXT_PUBLIC_FEATURE_GALLERY_ENABLED !== 'false',
    notificationTemplatesEnabled: process.env.NEXT_PUBLIC_FEATURE_NOTIFICATION_TEMPLATES_ENABLED === 'true',
    financeEnabled: process.env.NEXT_PUBLIC_FEATURE_FINANCE_ENABLED !== 'false',
  },
};

// Legacy export for backwards compatibility
// Components should prefer fetching from DB via getSalon()
export const customerConfig = DEFAULT_CONFIG;

export type CustomerConfig = typeof DEFAULT_CONFIG;
