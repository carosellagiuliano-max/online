// Application Constants
// Business data now comes from the database (salons table)
// Use getSalonConfig() from '@/lib/salon/config' for actual values

// Default fallback values (used when no salon data exists)
export const APP_CONFIG = {
  name: 'Salon',
  fullName: 'Salon',
  description: 'Ihr Friseursalon',

  // Location defaults
  address: {
    street: '',
    zip: '',
    city: '',
    country: 'Schweiz',
  },

  // Contact defaults
  phone: '',
  email: '',

  // Social defaults
  instagram: '',

  // Business defaults
  currency: 'CHF',
  timezone: 'Europe/Zurich',
  locale: 'de-CH',

  // VAT
  defaultVatRate: 8.1,
};

export const BOOKING_DEFAULTS = {
  slotGranularityMinutes: 15,
  minLeadTimeMinutes: 60,
  maxBookingHorizonDays: 90,
  cancellationCutoffHours: 24,
  reservationTimeoutMinutes: 15,
  maxActiveReservationsPerCustomer: 2,
} as const;

export const LOYALTY_CONFIG = {
  pointsPerChf: 1,
  pointsRedemptionRate: 0.01, // 1 point = 0.01 CHF
} as const;
