import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentStaffMember } from '@/lib/auth/rbac';
import { resolveStaffSalonId } from '@/lib/auth/admin-context';
import { AdminOrderDetailView } from '@/components/admin/admin-order-detail-view';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Bestelldetails',
};

// ============================================
// TYPES
// ============================================

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentIntentId: string | null;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shippingMethod: string | null;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  } | null;
  shippingAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  } | null;
  billingAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  } | null;
}

interface OrderItem {
  id: string;
  productId: string | null;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  sku: string | null;
}

interface OrderEvent {
  id: string;
  eventType: string;
  description: string | null;
  createdAt: string;
  createdBy: string | null;
}

// Supabase row types
interface OrderDbRow {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  stripe_payment_intent_id: string | null;
  subtotal_cents: number;
  shipping_cents: number | null;
  tax_cents: number | null;
  total_cents: number;
  shipping_method: string | null;
  tracking_number: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  shipping_address: { street: string; city: string; postalCode: string; country: string } | null;
  customers: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  } | null;
}

interface OrderItemDbRow {
  id: string;
  product_id: string | null;
  item_name: string;
  item_sku: string | null;
  item_description: string | null;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

interface OrderEventDbRow {
  id: string;
  new_status: string;
  previous_status: string | null;
  notes: string | null;
  created_at: string;
  changed_by: string | null;
}

// ============================================
// DATA FETCHING
// ============================================

async function getOrderData(orderId: string) {
  const staffMember = await getCurrentStaffMember();
  if (!staffMember) {
    redirect('/admin/login');
  }

  const salonId = resolveStaffSalonId(staffMember.salon_id);
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return null;
  }

  // Get order details
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      customers (
        id,
        first_name,
        last_name,
        email,
        phone
      )
    `)
    .eq('id', orderId)
    .eq('salon_id', salonId)
    .single() as { data: OrderDbRow | null; error: unknown };

  if (error || !order) {
    return null;
  }

  // Get order items
  const { data: itemsData } = await supabase
    .from('order_items')
    .select(`
      id,
      product_id,
      item_name,
      item_sku,
      item_description,
      quantity,
      unit_price_cents,
      total_cents
    `)
    .eq('order_id', orderId) as { data: OrderItemDbRow[] | null };

  // Get order events/history
  const { data: eventsData } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false }) as { data: OrderEventDbRow[] | null };

  // Transform data
  const orderDetail: OrderDetail = {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    paymentIntentId: order.stripe_payment_intent_id,
    subtotalCents: order.subtotal_cents,
    shippingCents: order.shipping_cents || 0,
    taxCents: order.tax_cents || 0,
    totalCents: order.total_cents,
    shippingMethod: order.shipping_method,
    trackingNumber: order.tracking_number,
    notes: order.internal_notes || order.customer_notes,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    customer: order.customers ? {
      id: order.customers.id,
      firstName: order.customers.first_name,
      lastName: order.customers.last_name,
      email: order.customers.email,
      phone: order.customers.phone,
    } : null,
    shippingAddress: order.shipping_address,
    billingAddress: null,
  };

  const items: OrderItem[] = (itemsData || []).map(item => ({
    id: item.id,
    productId: item.product_id,
    productName: item.item_name,
    variantName: item.item_description,
    quantity: item.quantity,
    unitPriceCents: item.unit_price_cents,
    totalCents: item.total_cents,
    sku: item.item_sku,
  }));

  const events: OrderEvent[] = (eventsData || []).map(event => ({
    id: event.id,
    eventType: event.new_status,
    description: event.notes,
    createdAt: event.created_at,
    createdBy: event.changed_by,
  }));

  return {
    order: orderDetail,
    items,
    events,
  };
}

// ============================================
// ORDER DETAIL PAGE
// ============================================

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getOrderData(id);

  if (!data) {
    notFound();
  }

  return (
    <AdminOrderDetailView
      order={data.order}
      items={data.items}
      events={data.events}
    />
  );
}
