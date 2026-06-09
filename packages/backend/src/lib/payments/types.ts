// ============================================
// PAYMENT PROVIDER - Generic Types
// ============================================

export type PaymentProviderName = 'stripe';

export interface PaymentResult<T> {
  data: T | null;
  error: string | null;
}

// ============================================
// CHECKOUT SESSION
// ============================================

export interface CreateCheckoutSessionParams {
  salonId: string;
  orderId: string;
  customerId?: string;
  customerEmail?: string;
  lineItems: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitAmountCents: number;
  }>;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSession {
  id: string;
  url: string | null;
  paymentIntentId: string | null;
  amountTotal: number | null;
  metadata: Record<string, string>;
  /** Raw provider object for provider-specific use */
  raw?: unknown;
}

// ============================================
// PAYMENT INTENT
// ============================================

export interface CreatePaymentIntentParams {
  amountCents: number;
  currency?: string;
  customerId?: string;
  orderId: string;
  salonId: string;
  metadata?: Record<string, string>;
  receiptEmail?: string;
  stripeCustomerId?: string;
}

export interface PaymentIntent {
  id: string;
  clientSecret: string | null;
  status: string;
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  /** Raw provider object for provider-specific use */
  raw?: unknown;
}

// ============================================
// REFUND
// ============================================

export type RefundReason = 'duplicate' | 'fraudulent' | 'requested_by_customer';

export interface Refund {
  id: string;
  paymentIntentId: string | null;
  amount: number | null;
  status: string;
  reason: string | null;
  /** Raw provider object for provider-specific use */
  raw?: unknown;
}

export interface CreateRefundParams {
  paymentIntentId: string;
  amountCents?: number;
  reason?: RefundReason;
  metadata?: Record<string, string>;
  /** For deposit refunds that target a charge directly */
  chargeId?: string;
}

// ============================================
// CUSTOMER
// ============================================

export interface PaymentCustomer {
  id: string;
  email: string | null;
  name: string | null;
  /** Raw provider object for provider-specific use */
  raw?: unknown;
}

// ============================================
// WEBHOOK
// ============================================

export interface WebhookEvent {
  id: string;
  type: string;
  data: unknown;
  /** Raw provider object for provider-specific use */
  raw?: unknown;
}
