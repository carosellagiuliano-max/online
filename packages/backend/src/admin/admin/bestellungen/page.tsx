import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentStaffMember } from '@/lib/auth/rbac';
import { resolveStaffSalonId } from '@/lib/auth/admin-context';
import { AdminOrderList } from '@/components/admin/admin-order-list';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Bestellungen',
};

// ============================================
// DATA FETCHING
// ============================================

async function getOrdersData(searchParams: {
  search?: string;
  status?: string;
  page?: string;
  limit?: string;
}) {
  const staffMember = await getCurrentStaffMember();
  if (!staffMember) {
    redirect('/admin/login');
  }

  const salonId = resolveStaffSalonId(staffMember.salon_id);
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { orders: [], total: 0, page: 1, limit: 20 };
  }
  const page = parseInt(searchParams.page || '1');
  const limit = parseInt(searchParams.limit || '20');
  const offset = (page - 1) * limit;
  const search = searchParams.search || '';
  const status = searchParams.status;

  let query = supabase
    .from('orders')
    .select(
      `
      id,
      order_number,
      status,
      payment_status,
      payment_method,
      total_cents,
      customer_email,
      customer_name,
      shipping_method,
      created_at,
      paid_at
    `,
      { count: 'exact' }
    )
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(
      `order_number.ilike.%${search}%,customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`
    );
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching orders:', error);
    return { orders: [], total: 0, page, limit };
  }

  return {
    orders: data || [],
    total: count || 0,
    page,
    limit,
  };
}

// ============================================
// ADMIN ORDERS PAGE
// ============================================

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const params = await searchParams;
  const { orders, total, page, limit } = await getOrdersData(params);

  return (
    <AdminOrderList
      orders={orders}
      total={total}
      page={page}
      limit={limit}
      initialSearch={params.search || ''}
      initialStatus={params.status || 'all'}
    />
  );
}
