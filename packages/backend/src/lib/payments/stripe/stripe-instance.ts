// ============================================
// SHARED STRIPE SDK INSTANCE
// ============================================

import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

/**
 * Returns a lazily-initialized Stripe SDK instance.
 * All server-side code that needs the raw Stripe object should use this.
 */
export function getStripeInstance(): Stripe {
  if (stripeInstance) return stripeInstance;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: '2025-12-15.clover',
    typescript: true,
  });

  return stripeInstance;
}
