'use client';

// ============================================
// CLIENT-SIDE PAYMENT PROVIDER FACTORY
// ============================================

import type { PaymentClientProvider } from './client-types';
import type { PaymentProviderName } from './types';

let clientInstance: PaymentClientProvider | null = null;

/**
 * Returns the configured client-side payment provider singleton.
 * Reads NEXT_PUBLIC_PAYMENT_PROVIDER env var (default: 'stripe').
 */
export function getPaymentClientProvider(): PaymentClientProvider {
  if (clientInstance) return clientInstance;

  const providerName = (process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || 'stripe') as PaymentProviderName;

  switch (providerName) {
    case 'stripe': {
      const { StripeClientAdapter } = require('./stripe/stripe-client-adapter');
      clientInstance = new StripeClientAdapter();
      break;
    }
    default:
      throw new Error(`Unknown payment client provider: ${providerName}`);
  }

  return clientInstance!;
}
