// ============================================
// PAYMENT PROVIDER - Interface & Factory
// ============================================

import type {
  PaymentResult,
  CreateCheckoutSessionParams,
  CheckoutSession,
  CreatePaymentIntentParams,
  PaymentIntent,
  Refund,
  CreateRefundParams,
  PaymentCustomer,
  WebhookEvent,
  PaymentProviderName,
} from './types';

export interface PaymentProvider {
  createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<PaymentResult<CheckoutSession>>;

  getCheckoutSession(
    sessionId: string
  ): Promise<PaymentResult<CheckoutSession>>;

  createPaymentIntent(
    params: CreatePaymentIntentParams
  ): Promise<PaymentResult<PaymentIntent>>;

  getPaymentIntent(
    paymentIntentId: string
  ): Promise<PaymentResult<PaymentIntent>>;

  confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<PaymentResult<PaymentIntent>>;

  cancelPaymentIntent(
    paymentIntentId: string
  ): Promise<PaymentResult<PaymentIntent>>;

  createRefund(params: CreateRefundParams): Promise<PaymentResult<Refund>>;

  createCustomer(
    email: string,
    name: string,
    metadata?: Record<string, string>
  ): Promise<PaymentResult<PaymentCustomer>>;

  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): PaymentResult<WebhookEvent>;

  isConfigured(): boolean;
}

// Singleton cache
let providerInstance: PaymentProvider | null = null;

/**
 * Returns the configured payment provider singleton.
 * Reads PAYMENT_PROVIDER env var (default: 'stripe').
 */
export function getPaymentProvider(): PaymentProvider {
  if (providerInstance) return providerInstance;

  const providerName = (process.env.PAYMENT_PROVIDER || 'stripe') as PaymentProviderName;

  switch (providerName) {
    case 'stripe': {
      // Lazy import to avoid pulling Stripe SDK when not needed
      const { StripeAdapter } = require('./stripe/stripe-adapter');
      providerInstance = new StripeAdapter();
      break;
    }
    default:
      throw new Error(`Unknown payment provider: ${providerName}`);
  }

  return providerInstance!;
}
