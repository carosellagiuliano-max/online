import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiContext } from '@/lib/auth/admin-context';
import { getPaymentProvider } from '@/lib/payments';

// ============================================
// POST - Process Refund
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const context = await requireAdminApiContext(['admin', 'hq']);
    if ('response' in context) return context.response;

    const body = await request.json();
    const { amountCents, reason } = body;

    if (!amountCents || amountCents <= 0) {
      return NextResponse.json(
        { error: 'Ungültiger Erstattungsbetrag' },
        { status: 400 }
      );
    }

    // Get order
    const { data: order, error: orderError } = await context.db
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('salon_id', context.salonId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Bestellung nicht gefunden' },
        { status: 404 }
      );
    }

    // Check if already refunded
    if (order.payment_status === 'refunded') {
      return NextResponse.json(
        { error: 'Bestellung wurde bereits erstattet' },
        { status: 400 }
      );
    }

    // Check if payment was successful
    if (order.payment_status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Nur bezahlte Bestellungen können erstattet werden' },
        { status: 400 }
      );
    }

    // Check refund amount
    if (amountCents > order.total_cents) {
      return NextResponse.json(
        { error: 'Erstattungsbetrag übersteigt Bestellwert' },
        { status: 400 }
      );
    }

    // Get payment intent
    if (!order.stripe_payment_intent_id) {
      return NextResponse.json(
        { error: 'Keine Zahlungs-ID gefunden' },
        { status: 400 }
      );
    }

    // Process refund via payment provider
    const { data: refund, error: refundError } = await getPaymentProvider().createRefund({
      paymentIntentId: order.stripe_payment_intent_id,
      amountCents,
      reason: 'requested_by_customer',
      metadata: {
        order_id: orderId,
        order_number: order.order_number,
        reason: reason || 'Admin-Erstattung',
      },
    });

    if (refundError || !refund) {
      console.error('Payment refund error:', refundError);
      return NextResponse.json(
        { error: 'Erstattung fehlgeschlagen' },
        { status: 500 }
      );
    }

    // Determine new payment status
    const isFullRefund = amountCents === order.total_cents;
    const newPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';

    // Update order (full refund cancels the order)
    const { error: updateError } = await context.db
      .from('orders')
      .update({
        payment_status: newPaymentStatus,
        status: isFullRefund ? 'cancelled' : order.status,
        refunded_amount_cents: (order.refunded_amount_cents || 0) + amountCents,
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('salon_id', context.salonId);

    if (updateError) {
      console.error('Order update error:', updateError);
      // Note: Refund was already processed in Stripe
    }

    if (
      !updateError &&
      isFullRefund &&
      !['shipped', 'delivered', 'completed'].includes(order.status)
    ) {
      await context.db.rpc('release_order_inventory', {
        p_order_id: orderId,
        p_created_by: context.user.id,
        p_notes: reason || 'Bestandsfreigabe nach vollständiger Erstattung',
      });
    }

    // Log status change
    await context.db.from('order_status_history').insert({
      order_id: orderId,
      new_status: isFullRefund ? 'cancelled' : order.status,
      changed_by: context.user.id,
      notes: `Erstattung: CHF ${(amountCents / 100).toFixed(2)}${reason ? ` - ${reason}` : ''}`,
    });

    // Log in payment_events if table exists
    await context.db.from('payment_events').insert({
      payment_intent_id: order.stripe_payment_intent_id,
      event_type: 'refund.created',
      status: refund.status,
      amount_cents: amountCents,
      metadata: {
        refund_id: refund.id,
        order_id: orderId,
        reason,
      },
    }).catch(() => {
      // Table might not exist
    });

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      amountRefunded: amountCents,
      message: isFullRefund ? 'Vollständige Erstattung durchgeführt' : 'Teilerstattung durchgeführt',
    });
  } catch (error) {
    console.error('Refund error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
