// ============================================
// STRIPE ADAPTER - PaymentProvider implementation
// ============================================

import type Stripe from 'stripe';
import { logger } from '../../logging/logger';
import type { PaymentProvider } from '../provider';
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
} from '../types';
import { getStripeInstance } from './stripe-instance';

export class StripeAdapter implements PaymentProvider {
  private get stripe(): Stripe | null {
    try {
      return getStripeInstance();
    } catch {
      return null;
    }
  }

  isConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY;
  }

  // ============================================
  // CHECKOUT SESSION
  // ============================================

  async createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<PaymentResult<CheckoutSession>> {
    const stripe = this.stripe;
    if (!stripe) {
      return { data: null, error: 'Stripe ist nicht konfiguriert' };
    }

    const {
      salonId,
      orderId,
      customerId,
      customerEmail,
      lineItems,
      successUrl,
      cancelUrl,
      metadata = {},
    } = params;

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: customerEmail,
        line_items: lineItems.map((item) => ({
          price_data: {
            currency: 'chf',
            product_data: {
              name: item.name,
              description: item.description,
            },
            unit_amount: item.unitAmountCents,
          },
          quantity: item.quantity,
        })),
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: {
          salon_id: salonId,
          order_id: orderId,
          customer_id: customerId || '',
          ...metadata,
        },
      });

      logger.info('Checkout session created', {
        sessionId: session.id,
        orderId,
        salonId,
      });

      return {
        data: this.mapCheckoutSession(session),
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Erstellen der Checkout-Session';
      logger.error('Failed to create checkout session', err instanceof Error ? err : undefined, { orderId });
      return { data: null, error: message };
    }
  }

  async getCheckoutSession(
    sessionId: string
  ): Promise<PaymentResult<CheckoutSession>> {
    const stripe = this.stripe;
    if (!stripe) {
      return { data: null, error: 'Stripe ist nicht konfiguriert' };
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items', 'payment_intent'],
      });

      return { data: this.mapCheckoutSession(session), error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Abrufen der Session';
      return { data: null, error: message };
    }
  }

  // ============================================
  // PAYMENT INTENTS
  // ============================================

  async createPaymentIntent(
    params: CreatePaymentIntentParams
  ): Promise<PaymentResult<PaymentIntent>> {
    const stripe = this.stripe;
    if (!stripe) {
      return { data: null, error: 'Stripe ist nicht konfiguriert' };
    }

    const {
      amountCents,
      currency = 'chf',
      customerId,
      orderId,
      salonId,
      metadata = {},
      receiptEmail,
      stripeCustomerId,
    } = params;

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency,
        customer: stripeCustomerId || undefined,
        receipt_email: receiptEmail,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          salon_id: salonId,
          order_id: orderId,
          customer_id: customerId || '',
          ...metadata,
        },
      });

      logger.info('Payment intent created', {
        paymentIntentId: paymentIntent.id,
        orderId,
        amount: amountCents,
      });

      return { data: this.mapPaymentIntent(paymentIntent), error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Erstellen des Payment Intents';
      logger.error('Failed to create payment intent', err instanceof Error ? err : undefined, { orderId });
      return { data: null, error: message };
    }
  }

  async getPaymentIntent(
    paymentIntentId: string
  ): Promise<PaymentResult<PaymentIntent>> {
    const stripe = this.stripe;
    if (!stripe) {
      return { data: null, error: 'Stripe ist nicht konfiguriert' };
    }

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return { data: this.mapPaymentIntent(paymentIntent), error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Abrufen des Payment Intents';
      return { data: null, error: message };
    }
  }

  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<PaymentResult<PaymentIntent>> {
    const stripe = this.stripe;
    if (!stripe) {
      return { data: null, error: 'Stripe ist nicht konfiguriert' };
    }

    try {
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });

      return { data: this.mapPaymentIntent(paymentIntent), error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Bestätigen der Zahlung';
      return { data: null, error: message };
    }
  }

  async cancelPaymentIntent(
    paymentIntentId: string
  ): Promise<PaymentResult<PaymentIntent>> {
    const stripe = this.stripe;
    if (!stripe) {
      return { data: null, error: 'Stripe ist nicht konfiguriert' };
    }

    try {
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
      return { data: this.mapPaymentIntent(paymentIntent), error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Stornieren des Payment Intents';
      return { data: null, error: message };
    }
  }

  // ============================================
  // REFUNDS
  // ============================================

  async createRefund(params: CreateRefundParams): Promise<PaymentResult<Refund>> {
    const stripe = this.stripe;
    if (!stripe) {
      return { data: null, error: 'Stripe ist nicht konfiguriert' };
    }

    const { paymentIntentId, amountCents, reason, metadata, chargeId } = params;

    try {
      const refundParams: Record<string, unknown> = {};
      if (chargeId) {
        refundParams.charge = chargeId;
      } else {
        refundParams.payment_intent = paymentIntentId;
      }
      if (amountCents !== undefined) refundParams.amount = amountCents;
      if (reason) refundParams.reason = reason;
      if (metadata) refundParams.metadata = metadata;

      const refund = await stripe.refunds.create(refundParams as any);

      logger.info('Refund created', {
        refundId: refund.id,
        paymentIntentId,
        amount: amountCents,
      });

      return {
        data: {
          id: refund.id,
          paymentIntentId: typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id ?? null,
          amount: refund.amount,
          status: refund.status ?? 'unknown',
          reason: refund.reason ?? null,
          raw: refund,
        },
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Erstellen der Rückerstattung';
      logger.error('Failed to create refund', err instanceof Error ? err : undefined, { paymentIntentId });
      return { data: null, error: message };
    }
  }

  // ============================================
  // CUSTOMERS
  // ============================================

  async createCustomer(
    email: string,
    name: string,
    metadata?: Record<string, string>
  ): Promise<PaymentResult<PaymentCustomer>> {
    const stripe = this.stripe;
    if (!stripe) {
      return { data: null, error: 'Stripe ist nicht konfiguriert' };
    }

    try {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata,
      });

      return {
        data: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          raw: customer,
        },
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Erstellen des Kunden';
      return { data: null, error: message };
    }
  }

  // ============================================
  // WEBHOOKS
  // ============================================

  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): PaymentResult<WebhookEvent> {
    const stripe = this.stripe;
    if (!stripe) {
      return { data: null, error: 'Stripe ist nicht konfiguriert' };
    }

    try {
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return {
        data: {
          id: event.id,
          type: event.type,
          data: event.data.object,
          raw: event,
        },
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ungültige Webhook-Signatur';
      logger.error('Webhook signature verification failed', err instanceof Error ? err : undefined);
      return { data: null, error: message };
    }
  }

  // ============================================
  // MAPPING HELPERS
  // ============================================

  private mapCheckoutSession(session: Stripe.Checkout.Session): CheckoutSession {
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    return {
      id: session.id,
      url: session.url,
      paymentIntentId,
      amountTotal: session.amount_total,
      metadata: (session.metadata ?? {}) as Record<string, string>,
      raw: session,
    };
  }

  private mapPaymentIntent(pi: Stripe.PaymentIntent): PaymentIntent {
    return {
      id: pi.id,
      clientSecret: pi.client_secret,
      status: pi.status,
      amount: pi.amount,
      currency: pi.currency,
      metadata: (pi.metadata ?? {}) as Record<string, string>,
      raw: pi,
    };
  }
}
