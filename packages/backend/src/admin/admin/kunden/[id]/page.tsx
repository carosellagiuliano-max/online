import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/db/client';
import { getCurrentStaffMember } from '@/lib/auth/rbac';
import { resolveStaffSalonId } from '@/lib/auth/admin-context';
import { AdminCustomerDetailView } from '@/components/admin/admin-customer-detail-view';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Kundendetails',
};

// ============================================
// TYPES
// ============================================

interface CustomerDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  avatarUrl: string | null;
  notes: string | null;
  tags: string[];
  totalVisits: number;
  totalSpent: number;
  loyaltyPoints: number;
  loyaltyTier: string | null;
  createdAt: string;
  lastVisitAt: string | null;
  marketingConsent: boolean;
  dataProcessingConsent: boolean;
}

interface CustomerAppointment {
  id: string;
  date: string;
  time: string;
  serviceName: string;
  staffName: string;
  status: string;
  totalCents: number;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  date: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  itemCount: number;
}

interface CustomerLoyaltyTransaction {
  id: string;
  date: string;
  type: string;
  points: number;
  description: string;
}

// Supabase row types
interface CustomerDbRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  notes: string | null;
  tags: string[] | null;
  profile_id: string | null;
  created_at: string;
  profiles: {
    email: string;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  customer_loyalty: {
    id: string;
    points_balance: number;
    lifetime_points: number;
    current_tier_id: string | null;
  }[] | null;
}

interface CustomerAppointmentRow {
  id: string;
  start_time: string;
  status: string;
  total_cents: number | null;
  appointment_services: { service_name: string }[] | null;
  staff: { display_name: string } | null;
}

interface CustomerOrderRow {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  payment_status: string;
  total_cents: number;
  order_items: { id: string }[] | null;
}

interface LoyaltyTransactionRow {
  id: string;
  created_at: string;
  transaction_type: string;
  points: number;
  description: string | null;
}

interface ConsentRow {
  category: string;
  consented: boolean;
}

// ============================================
// DATA FETCHING
// ============================================

async function getCustomerData(customerId: string) {
  const staffMember = await getCurrentStaffMember();
  if (!staffMember) {
    redirect('/admin/login');
  }

  const salonId = resolveStaffSalonId(staffMember.salon_id);
  const supabase = createServerClient();

  if (!supabase) {
    console.error('Error: Database client not available');
    return null;
  }

  // Get customer details
  const { data: customer, error } = await supabase
    .from('customers')
    .select(`
      *,
      profiles (
        email,
        phone,
        avatar_url
      ),
      customer_loyalty (
        id,
        points_balance,
        lifetime_points,
        current_tier_id
      )
    `)
    .eq('id', customerId)
    .eq('salon_id', salonId)
    .is('deleted_at', null)
    .single() as { data: CustomerDbRow | null; error: unknown };

  if (error || !customer) {
    console.error('Error fetching customer:', error);
    return null;
  }

  // Get appointments - by customer_id OR by customer_email (for legacy appointments)
  const customerEmail = customer.profiles?.email || customer.email;

  let appointmentsQuery = supabase
    .from('appointments')
    .select(`
      id,
      start_time,
      status,
      total_cents,
      appointment_services (service_name),
      staff (display_name)
    `)
    .eq('salon_id', salonId)
    .order('start_time', { ascending: false })
    .limit(50);

  // Build OR filter: customer_id matches OR customer_email matches
  if (customerEmail) {
    appointmentsQuery = appointmentsQuery.or(`customer_id.eq.${customerId},customer_email.eq.${customerEmail}`);
  } else {
    appointmentsQuery = appointmentsQuery.eq('customer_id', customerId);
  }

  const { data: appointmentsData, error: appointmentsError } = await appointmentsQuery as { data: CustomerAppointmentRow[] | null; error: unknown };

  if (appointmentsError) {
    console.error('Error fetching appointments:', appointmentsError);
  }

  // Get orders
  const { data: ordersData } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      created_at,
      status,
      payment_status,
      total_cents,
      order_items (id)
    `)
    .eq('salon_id', salonId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(20) as { data: CustomerOrderRow[] | null };

  // Get loyalty transactions via the salon-scoped customer loyalty memberships
  const loyaltyIds = (customer.customer_loyalty || []).map((loyalty) => loyalty.id);
  const { data: loyaltyData } = loyaltyIds.length > 0
    ? await supabase
        .from('loyalty_transactions')
        .select('*')
        .in('customer_loyalty_id', loyaltyIds)
        .order('created_at', { ascending: false })
        .limit(20) as { data: LoyaltyTransactionRow[] | null }
    : { data: [] as LoyaltyTransactionRow[] };

  // Get consents
  const { data: consentsData } = await supabase
    .from('consent_records')
    .select('*')
    .eq('profile_id', customer.profile_id || '') as { data: ConsentRow[] | null };

  // Calculate totals - exclude cancelled appointments
  const allAppts = appointmentsData || [];
  const validAppts = allAppts.filter(a => a.status !== 'cancelled');
  const totalVisits = validAppts.length;
  const appointmentSpend = validAppts.reduce(
    (sum, a) => sum + (a.total_cents || 0),
    0
  );
  const orderSpend = ordersData?.reduce(
    (sum, o) => sum + (o.payment_status === 'succeeded' ? o.total_cents || 0 : 0),
    0
  ) || 0;

  // Find last visit
  const lastVisit = allAppts[0];

  // Get marketing consent
  const marketingConsent =
    consentsData?.find(c => c.category === 'marketing_email' || c.category === 'marketing')?.consented ?? false;
  const dataConsent =
    consentsData?.find(c => c.category === 'loyalty' || c.category === 'data_processing')?.consented ?? true;

  // Transform data
  const customerDetail: CustomerDetail = {
    id: customer.id,
    firstName: customer.first_name,
    lastName: customer.last_name,
    email: customer.profiles?.email || customer.email || '',
    phone: customer.profiles?.phone || customer.phone || null,
    birthDate: customer.birth_date,
    gender: customer.gender,
    avatarUrl: customer.profiles?.avatar_url ?? null,
    notes: customer.notes,
    tags: customer.tags || [],
    totalVisits,
    totalSpent: appointmentSpend + orderSpend,
    loyaltyPoints: customer.customer_loyalty?.[0]?.points_balance || 0,
    loyaltyTier: customer.customer_loyalty?.[0]?.current_tier_id ?? null,
    createdAt: customer.created_at,
    lastVisitAt: lastVisit?.start_time || null,
    marketingConsent,
    dataProcessingConsent: dataConsent,
  };

  const appointments: CustomerAppointment[] = (appointmentsData || []).map(a => ({
    id: a.id,
    date: new Date(a.start_time).toISOString().split('T')[0],
    time: new Date(a.start_time).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }),
    serviceName: a.appointment_services?.[0]?.service_name || 'Unbekannt',
    staffName: a.staff?.display_name || 'Unbekannt',
    status: a.status,
    totalCents: a.total_cents || 0,
  }));

  const orders: CustomerOrder[] = (ordersData || []).map(o => ({
    id: o.id,
    orderNumber: o.order_number,
    date: o.created_at,
    status: o.status,
    paymentStatus: o.payment_status,
    totalCents: o.total_cents,
    itemCount: o.order_items?.length || 0,
  }));

  const loyaltyTransactions: CustomerLoyaltyTransaction[] = (loyaltyData || []).map(l => ({
    id: l.id,
    date: l.created_at,
    type: l.transaction_type,
    points: l.points,
    description: l.description || getTransactionDescription(l.transaction_type),
  }));

  return {
    customer: customerDetail,
    appointments,
    orders,
    loyaltyTransactions,
  };
}

function getTransactionDescription(type: string): string {
  const descriptions: Record<string, string> = {
    earn_visit: 'Punkte für Besuch',
    earn_purchase: 'Punkte für Einkauf',
    earn_referral: 'Empfehlungsbonus',
    earn_birthday: 'Geburtstagsbonus',
    redeem: 'Punkte eingelöst',
    expire: 'Punkte verfallen',
    adjust: 'Manuelle Anpassung',
  };
  return descriptions[type] || type;
}

// ============================================
// CUSTOMER DETAIL PAGE
// ============================================

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getCustomerData(id);

  if (!data) {
    notFound();
  }

  return (
    <AdminCustomerDetailView
      customer={data.customer}
      appointments={data.appointments}
      orders={data.orders}
      loyaltyTransactions={data.loyaltyTransactions}
    />
  );
}
