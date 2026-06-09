// ============================================
// FEATURE FLAGS CONFIGURATION
// ============================================

/**
 * Feature flags controlled by environment variables.
 * Use NEXT_PUBLIC_ prefix for flags that need to be available client-side.
 */

export const features = {
  /**
   * Enable/disable the shop section (products, vouchers, cart)
   * Set NEXT_PUBLIC_FEATURE_SHOP_ENABLED=false to disable
   */
  shopEnabled: process.env.NEXT_PUBLIC_FEATURE_SHOP_ENABLED !== 'false',

  /**
   * Enable/disable online booking
   * Set NEXT_PUBLIC_FEATURE_BOOKING_ENABLED=false to disable
   */
  bookingEnabled: process.env.NEXT_PUBLIC_FEATURE_BOOKING_ENABLED !== 'false',

  /**
   * Enable/disable the gallery section
   * Set NEXT_PUBLIC_FEATURE_GALLERY_ENABLED=false to disable
   */
  galleryEnabled: process.env.NEXT_PUBLIC_FEATURE_GALLERY_ENABLED !== 'false',

  /**
   * Enable/disable notification templates admin page
   * Set NEXT_PUBLIC_FEATURE_NOTIFICATION_TEMPLATES_ENABLED=false to disable
   */
  notificationTemplatesEnabled: process.env.NEXT_PUBLIC_FEATURE_NOTIFICATION_TEMPLATES_ENABLED !== 'false',

  /**
   * Enable/disable the finance section in admin (Finanzen)
   * Set NEXT_PUBLIC_FEATURE_FINANCE_ENABLED=false to disable
   */
  financeEnabled: process.env.NEXT_PUBLIC_FEATURE_FINANCE_ENABLED !== 'false',
} as const;

export type FeatureFlags = typeof features;
