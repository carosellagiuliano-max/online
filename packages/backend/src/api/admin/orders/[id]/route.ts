import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireAdminApiContext } from '@/lib/auth/admin-context';
import { isValidStatusTransition } from '@/lib/domain/order/order';
import type { OrderStatus } from '@/lib/domain/order/types';

// ============================================
// GET - Fetch Order Details
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await requireAdminApiContext(['admin', 'manager', 'hq', 'staff']);
    if ('response' in context) return context.response;

    const { data: order, error } = await context.db
      .from('orders')
      .select(`*, customers (*), order_items (*)`)
      .eq('id', id)
      .eq('salon_id', context.salonId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Order fetch error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}

// ============================================
// PUT - Update Order
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await requireAdminApiContext(['admin', 'manager', 'hq']);
    if ('response' in context) return context.response;

    const body = await request.json();
    const { status, trackingNumber, notes, confirmPayment } = body;
    const requestedStatus = typeof status === 'string' ? status as OrderStatus : undefined;

    const { data: currentOrder, error: currentOrderError } = await context.db
      .from('orders')
      .select('id, status')
      .eq('id', id)
      .eq('salon_id', context.salonId)
      .single();

    if (currentOrderError || !currentOrder) {
      return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
    }

    const nextStatus = confirmPayment && !requestedStatus
      ? 'paid'
      : requestedStatus || (trackingNumber ? 'shipped' : undefined);

    if (nextStatus && !isValidStatusTransition(currentOrder.status as OrderStatus, nextStatus)) {
      return NextResponse.json(
        { error: `Statuswechsel von ${currentOrder.status} zu ${nextStatus} ist nicht erlaubt` },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (nextStatus) updateData.status = nextStatus;
    if (trackingNumber !== undefined) updateData.tracking_number = trackingNumber;
    if (notes !== undefined) updateData.internal_notes = notes;

    // Handle payment confirmation (for pay_at_venue orders)
    if (confirmPayment) {
      updateData.payment_status = 'succeeded';
      updateData.paid_at = new Date().toISOString();
    }

    // Update order
    const { data: updatedOrder, error } = await context.db
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .eq('salon_id', context.salonId)
      .select('id')
      .single();

    if (error || !updatedOrder) {
      console.error('Order update error:', error);
      return NextResponse.json(
        { error: error?.message || 'Bestellung nicht gefunden' },
        { status: error ? 500 : 404 }
      );
    }

    // Log status change
    if (nextStatus) {
      await context.db.from('order_status_history').insert({
        order_id: id,
        previous_status: currentOrder.status,
        new_status: nextStatus,
        changed_by: context.user.id,
        notes: `Status geändert zu: ${nextStatus}`,
      });
    }

    if (nextStatus === 'cancelled' && currentOrder.status !== 'cancelled') {
      await context.db.rpc('release_order_inventory', {
        p_order_id: id,
        p_created_by: context.user.id,
        p_notes: notes || 'Bestandsfreigabe nach Admin-Stornierung',
      });
    }

    if (trackingNumber && nextStatus !== 'shipped') {
      await context.db.from('order_status_history').insert({
        order_id: id,
        previous_status: nextStatus || currentOrder.status,
        new_status: 'shipped',
        changed_by: context.user.id,
        notes: `Tracking-Nummer: ${trackingNumber}`,
      });
    }

    revalidateTag('shop', 'max');
    revalidateTag('products', 'max');
    revalidatePath('/admin/bestellungen');
    revalidatePath(`/admin/bestellungen/${id}`);
    revalidatePath('/admin/inventar');
    revalidatePath('/konto/bestellungen');
    revalidatePath(`/konto/bestellungen/${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Order update error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
