// ============================================
// PAYMENTS MODULE - Public API
// ============================================

// --- Types ---
export type {
  PaymentResult,
  CreateCheckoutSessionParams,
  CheckoutSession,
  CreatePaymentIntentParams,
  PaymentIntent,
  Refund,
  RefundReason,
  CreateRefundParams,
  PaymentCustomer,
  WebhookEvent,
  PaymentProviderName,
} from './types';

// Backward-compat alias
export type { PaymentResult as StripeResult } from './types';

// --- Provider interface & factory ---
export type { PaymentProvider } from './provider';
export { getPaymentProvider } from './provider';

// --- Client types (type-only, safe for server) ---
export type { PaymentClientProvider, RedirectResult } from './client-types';

// --- Client factory & adapters ---
// Import from '@/lib/payments/client-provider' or
// '@/lib/payments/stripe/stripe-client-adapter' directly in client components.
// They depend on @stripe/stripe-js which is browser-only.

// --- Price utilities (provider-agnostic) ---
export {
  formatChfPrice,
  chfToCents,
  centsToChf,
  calculateVat,
} from './price-utils';

// --- Stripe-specific server re-exports ---
export { getStripeInstance } from './stripe/stripe-instance';
// For client-side getStripe(), import from '@/lib/payments/stripe/stripe-client-adapter' directly.

// ============================================
// BACKWARD-COMPATIBLE FUNCTION EXPORTS
// Delegates to the active payment provider so
// existing consumers only need an import-path change.
// ============================================

import { getPaymentProvider } from './provider';
import type {
  CreateCheckoutSessionParams,
  CreatePaymentIntentParams,
  PaymentResult,
  CheckoutSession,
  PaymentIntent,
  Refund,
  PaymentCustomer,
  WebhookEvent,
  RefundReason,
} from './types';

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<PaymentResult<CheckoutSession>> {
  return getPaymentProvider().createCheckoutSession(params);
}

export async function getCheckoutSession(
  sessionId: string
): Promise<PaymentResult<CheckoutSession>> {
  return getPaymentProvider().getCheckoutSession(sessionId);
}

export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<PaymentResult<PaymentIntent>> {
  return getPaymentProvider().createPaymentIntent(params);
}

export async function getPaymentIntent(
  paymentIntentId: string
): Promise<PaymentResult<PaymentIntent>> {
  return getPaymentProvider().getPaymentIntent(paymentIntentId);
}

export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId: string
): Promise<PaymentResult<PaymentIntent>> {
  return getPaymentProvider().confirmPaymentIntent(paymentIntentId, paymentMethodId);
}

export async function cancelPaymentIntent(
  paymentIntentId: string
): Promise<PaymentResult<PaymentIntent>> {
  return getPaymentProvider().cancelPaymentIntent(paymentIntentId);
}

export async function createRefund(
  paymentIntentId: string,
  amountCents?: number,
  reason?: RefundReason
): Promise<PaymentResult<Refund>> {
  return getPaymentProvider().createRefund({ paymentIntentId, amountCents, reason });
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): PaymentResult<WebhookEvent> {
  return getPaymentProvider().constructWebhookEvent(payload, signature, webhookSecret);
}

export async function createStripeCustomer(
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<PaymentResult<PaymentCustomer>> {
  return getPaymentProvider().createCustomer(email, name, metadata);
}

// ============================================
// Client-side exports
// ============================================
// Client components should import directly from:
//   '@/lib/payments/stripe/stripe-client-adapter'
//     → getStripe, redirectToCheckout, StripeClientAdapter
//   '@/lib/payments/client-provider'
//     → getPaymentClientProvider
