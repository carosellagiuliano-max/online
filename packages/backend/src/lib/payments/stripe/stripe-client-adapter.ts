'use client';

// ============================================
// STRIPE CLIENT ADAPTER
// ============================================

import type { PaymentClientProvider, RedirectResult } from '../client-types';

type StripeClient = {
  redirectToCheckout(options: { sessionId: string }): Promise<{ error?: { message?: string } }>;
};

let stripePromise: Promise<StripeClient | null> | null = null;

/**
 * Gets or initializes the Stripe client-side instance.
 * Exported for direct use by <Elements> provider.
 */
export function getStripe(): Promise<StripeClient | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      console.warn('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
      return Promise.resolve(null);
    }

    console.warn('Stripe.js client SDK is not installed in this package');
    stripePromise = Promise.resolve(null);
  }

  return stripePromise;
}

/**
 * Standalone redirectToCheckout for backward-compatible imports.
 */
export async function redirectToCheckout(sessionId: string): Promise<RedirectResult> {
  const stripe = await getStripe();

  if (!stripe) {
    return { error: 'Stripe konnte nicht geladen werden' };
  }

  try {
    const { error } = await stripe.redirectToCheckout({ sessionId });

    if (error) {
      return { error: error.message };
    }

    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Fehler beim Weiterleiten zur Zahlung',
    };
  }
}

export class StripeClientAdapter implements PaymentClientProvider {
  async redirectToCheckout(sessionId: string): Promise<RedirectResult> {
    const stripe = await getStripe();

    if (!stripe) {
      return { error: 'Stripe konnte nicht geladen werden' };
    }

    try {
      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Fehler beim Weiterleiten zur Zahlung',
      };
    }
  }

  getElementsAppearance(): Record<string, unknown> {
    return {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#D4AF37',
        colorBackground: '#ffffff',
        colorText: '#1a1a1a',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        borderRadius: '8px',
        spacingUnit: '4px',
      },
      rules: {
        '.Input': {
          borderColor: '#e5e7eb',
          boxShadow: 'none',
        },
        '.Input:focus': {
          borderColor: '#D4AF37',
          boxShadow: '0 0 0 1px #D4AF37',
        },
        '.Label': {
          fontWeight: '500',
        },
        '.Error': {
          color: '#ef4444',
        },
      },
    };
  }

  getPaymentElementOptions(): Record<string, unknown> {
    return {
      layout: 'tabs' as const,
      defaultValues: {
        billingDetails: {
          address: {
            country: 'CH',
          },
        },
      },
      business: {
        name: process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Salon',
      },
    };
  }
}
