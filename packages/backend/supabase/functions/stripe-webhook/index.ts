// ============================================
// BeautifyPRO - Stripe Webhook Handler
// Supabase Edge Function
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// ============================================
// TYPES
// ============================================

interface WebhookResult {
  success: boolean;
  eventId: string;
  eventType: string;
  processed: boolean;
  error?: string;
}

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'completed' | 'cancelled';
type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!stripeSecretKey || !webhookSecret) {
    console.error('Missing Stripe configuration');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-12-18.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    // Get raw body and signature
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check idempotency - prevent duplicate processing
    const { data: existingEvent } = await supabase
      .from('stripe_webhooks_log')
      .select('id, processed, processed_at')
      .eq('stripe_event_id', event.id)
      .single();

    if (existingEvent?.processed) {
      console.log(`Event ${event.id} already processed, skipping`);
      return new Response(
        JSON.stringify({
          success: true,
          eventId: event.id,
          eventType: event.type,
          processed: false,
          message: 'Event already processed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record event (or update if exists)
    await supabase.from('stripe_webhooks_log').upsert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event.data.object,
      processed: false,
    }, { onConflict: 'stripe_event_id' });

    // Process event based on type
    let result: WebhookResult = {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(supabase, event.data.object as Stripe.Checkout.Session);
        break;

      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(supabase, event.data.object as Stripe.Checkout.Session);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(supabase, event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(supabase, event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(supabase, event.data.object as Stripe.Charge);
        break;

      case 'charge.dispute.created':
        await handleDisputeCreated(supabase, event.data.object as Stripe.Dispute);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
        result.processed = false;
    }

    // Mark event as processed
    await supabase.from('stripe_webhooks_log').update({
      processed: true,
      processed_at: new Date().toISOString(),
    }).eq('stripe_event_id', event.id);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handle successful checkout session
 */
async function handleCheckoutSessionCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session
) {
  const orderId = session.metadata?.order_id;
  const customerId = session.metadata?.customer_id;
  const salonId = session.metadata?.salon_id;

  if (!orderId) {
    console.warn('Checkout session completed without order_id:', session.id);
    return;
  }

  console.log(`Processing completed checkout for order ${orderId}`);

  // Update order status
  const { error: orderError } = await supabase
    .from('orders')
    .update({
      status: 'processing' as OrderStatus,
      payment_status: 'succeeded' as PaymentStatus,
      stripe_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (orderError) {
    console.error('Error updating order:', orderError);
    throw orderError;
  }

  // Check if order contains vouchers - generate voucher codes
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .eq('item_type', 'voucher');

  if (!itemsError && orderItems && orderItems.length > 0) {
    await generateVoucherCodes(supabase, orderId, orderItems, customerId, salonId);
  }

  // Log audit event
  await supabase.from('audit_logs').insert({
    action: 'payment_completed',
    entity_type: 'order',
    entity_id: orderId,
    details: {
      session_id: session.id,
      amount: session.amount_total,
      customer_email: session.customer_email,
    },
  }).catch((e) => console.warn('Audit log insert failed:', e));

  console.log(`Order ${orderId} marked as paid`);
}

/**
 * Handle expired checkout session
 */
async function handleCheckoutSessionExpired(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session
) {
  const orderId = session.metadata?.order_id;

  if (!orderId) {
    return;
  }

  console.log(`Checkout expired for order ${orderId}`);

  // Update order status
  await supabase
    .from('orders')
    .update({
      status: 'cancelled' as OrderStatus,
      payment_status: 'failed' as PaymentStatus,
      cancellation_reason: 'Checkout-Session abgelaufen',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'pending'); // Only update if still pending
}

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: Stripe.PaymentIntent
) {
  const orderId = paymentIntent.metadata?.order_id;

  if (!orderId) {
    console.warn('Payment intent without order_id:', paymentIntent.id);
    return;
  }

  console.log(`Payment intent succeeded for order ${orderId}`);

  // Update order (might already be updated by checkout.session.completed)
  await supabase
    .from('orders')
    .update({
      payment_status: 'succeeded' as PaymentStatus,
      stripe_payment_intent_id: paymentIntent.id,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: Stripe.PaymentIntent
) {
  const orderId = paymentIntent.metadata?.order_id;

  if (!orderId) {
    return;
  }

  console.log(`Payment failed for order ${orderId}`);

  // Update order payment status
  await supabase
    .from('orders')
    .update({
      payment_status: 'failed' as PaymentStatus,
      payment_error: paymentIntent.last_payment_error?.message || 'Zahlung fehlgeschlagen',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  // Log audit event
  await supabase.from('audit_logs').insert({
    action: 'payment_failed',
    entity_type: 'order',
    entity_id: orderId,
    details: {
      payment_intent_id: paymentIntent.id,
      error: paymentIntent.last_payment_error?.message,
    },
  }).catch(() => {});
}

/**
 * Handle refunded charge
 */
async function handleChargeRefunded(
  supabase: ReturnType<typeof createClient>,
  charge: Stripe.Charge
) {
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id;

  if (!paymentIntentId) {
    return;
  }

  // Find order by payment intent
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, total_cents')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single();

  if (orderError || !order) {
    console.warn('Order not found for payment intent:', paymentIntentId);
    return;
  }

  const isFullRefund = charge.amount_refunded >= charge.amount;
  const newStatus: PaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';

  console.log(`Refund processed for order ${order.id}: ${isFullRefund ? 'full' : 'partial'}`);

  // Update order
  await supabase
    .from('orders')
    .update({
      status: isFullRefund ? 'cancelled' as OrderStatus : undefined,
      payment_status: newStatus,
      refunded_amount_cents: charge.amount_refunded,
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  // Log audit event
  await supabase.from('audit_logs').insert({
    action: 'payment_refunded',
    entity_type: 'order',
    entity_id: order.id,
    details: {
      charge_id: charge.id,
      amount_refunded: charge.amount_refunded,
      is_full_refund: isFullRefund,
    },
  }).catch(() => {});
}

/**
 * Handle dispute created
 */
async function handleDisputeCreated(
  supabase: ReturnType<typeof createClient>,
  dispute: Stripe.Dispute
) {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;

  console.warn(`Dispute created for charge ${chargeId}:`, dispute.reason);

  // Find order and mark as disputed
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_charge_id', chargeId)
    .single();

  if (order) {
    await supabase.from('orders').update({
      has_dispute: true,
      dispute_reason: dispute.reason,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
  }

  // Log for immediate attention
  await supabase.from('audit_logs').insert({
    action: 'payment_disputed',
    entity_type: 'order',
    entity_id: order?.id,
    severity: 'high',
    details: {
      dispute_id: dispute.id,
      reason: dispute.reason,
      amount: dispute.amount,
    },
  }).catch(() => {});
}

// ============================================
// VOUCHER GENERATION
// ============================================

/**
 * Generate voucher codes for purchased vouchers
 */
async function generateVoucherCodes(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  orderItems: any[],
  customerId: string | undefined,
  salonId: string | undefined
) {
  for (const item of orderItems) {
    // Generate unique voucher code
    const code = generateVoucherCode();

    // Calculate expiry (1 year from now)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Create voucher record
    const { error: voucherError } = await supabase
      .from('vouchers')
      .insert({
        code,
        order_id: orderId,
        order_item_id: item.id,
        salon_id: salonId,
        purchaser_customer_id: customerId,
        recipient_email: item.recipient_email,
        recipient_name: item.recipient_name,
        personal_message: item.personal_message,
        amount_cents: item.unit_price_cents,
        remaining_amount_cents: item.unit_price_cents,
        type: item.voucher_type || 'value', // 'value' or 'service'
        status: 'active',
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      });

    if (voucherError) {
      console.error('Error creating voucher:', voucherError);
      continue;
    }

    console.log(`Voucher ${code} created for order item ${item.id}`);
  }
}

/**
 * Generate unique voucher code
 */
function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  const prefix = 'SW-'; // BeautifyPRO prefix
  let code = prefix;

  // Generate 3 groups of 4 characters
  for (let group = 0; group < 3; group++) {
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (group < 2) code += '-';
  }

  return code; // Format: SW-XXXX-XXXX-XXXX
}
