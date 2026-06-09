import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentStaffMember, type StaffMember } from '@/lib/auth/rbac';
import { isMockMode } from '@/lib/mock/mock-auth';
import { MOCK_ANALYTICS, MOCK_APPOINTMENTS, MOCK_ORDERS } from '@/lib/mock/mock-data';
import { AdminDashboardContent } from '@/components/admin/admin-dashboard-content';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Dashboard',
};

// ============================================
// TYPES
// ============================================

interface DashboardStats {
  todayAppointments: number;
  weekAppointments: number;
  pendingOrders: number;
  monthlyRevenue: number;
  newCustomers: number;
  cancelledAppointments: number;
  pendingApprovals: number;
  unassignedAppointments: number;
  unpaidCompletedAppointments: number;
  failedNotifications: number;
  contactsWithoutAccount: number;
  lowStockProducts: number;
  activeWaitlist: number;
}

interface TodayAppointment {
  id: string;
  time: string;
  customerName: string;
  serviceName: string;
  staffName: string;
  status: string;
  duration: number;
}

interface DashboardAttentionItem {
  key: string;
  title: string;
  count: number;
  description: string;
  href: string;
  severity: 'critical' | 'warning' | 'info';
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerEmail: string;
  totalCents: number;
  status: string;
  createdAt: string;
}

// Supabase row types
interface DashboardAppointmentRow {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  customer_name: string | null;
  customers: {
    first_name: string;
    last_name: string;
  } | null;
  appointment_services: {
    service_name: string;
    duration_minutes: number;
  }[] | null;
  staff: {
    display_name: string;
  } | null;
}

interface MonthlyOrderRow {
  total_cents: number | null;
  payment_status: string;
}

interface MonthlyAppointmentRow {
  total_cents: number | null;
  status: string;
  paid_amount_cents: number | null;
  paid_at: string | null;
}

interface RecentOrderRow {
  id: string;
  order_number: string;
  customer_email: string;
  total_cents: number;
  status: string;
  created_at: string;
}

const DASHBOARD_TIME_ZONE = 'Europe/Zurich';
const ACTIVE_APPOINTMENT_STATUSES = ['reserved', 'requested', 'confirmed'];

function emptyDashboardData(): {
  stats: DashboardStats;
  todayAppointments: TodayAppointment[];
  recentOrders: RecentOrder[];
  attentionItems: DashboardAttentionItem[];
} {
  return {
    stats: {
      todayAppointments: 0,
      weekAppointments: 0,
      pendingOrders: 0,
      monthlyRevenue: 0,
      newCustomers: 0,
      cancelledAppointments: 0,
      pendingApprovals: 0,
      unassignedAppointments: 0,
      unpaidCompletedAppointments: 0,
      failedNotifications: 0,
      contactsWithoutAccount: 0,
      lowStockProducts: 0,
      activeWaitlist: 0,
    },
    todayAppointments: [],
    recentOrders: [],
    attentionItems: [],
  };
}

function mockDashboardData(): {
  stats: DashboardStats;
  todayAppointments: TodayAppointment[];
  recentOrders: RecentOrder[];
  attentionItems: DashboardAttentionItem[];
} {
  const stats: DashboardStats = {
    todayAppointments: MOCK_ANALYTICS.appointments.today,
    weekAppointments: MOCK_ANALYTICS.appointments.week,
    pendingOrders: MOCK_ORDERS.filter((order) => order.status === 'pending').length,
    monthlyRevenue: MOCK_ANALYTICS.revenue.month * 100, // formatCurrency expects cents
    newCustomers: MOCK_ANALYTICS.customers.new_this_month,
    cancelledAppointments: MOCK_ANALYTICS.appointments.cancelled,
    pendingApprovals: MOCK_ANALYTICS.appointments.pending,
    unassignedAppointments: 0,
    unpaidCompletedAppointments: 0,
    failedNotifications: 0,
    contactsWithoutAccount: 0,
    lowStockProducts: MOCK_ANALYTICS.products.low_stock,
    activeWaitlist: 0,
  };

  const todayAppointments: TodayAppointment[] = MOCK_APPOINTMENTS
    .filter((apt) => ACTIVE_APPOINTMENT_STATUSES.includes(apt.status))
    .map((apt) => ({
      id: apt.id,
      time: apt.start_time,
      customerName: `${apt.customer.first_name} ${apt.customer.last_name}`,
      serviceName: apt.service.name,
      staffName: `${apt.staff.first_name} ${apt.staff.last_name}`,
      status: apt.status,
      duration: apt.service.duration_minutes,
    }));

  const recentOrders: RecentOrder[] = MOCK_ORDERS.map((order, index) => ({
    id: order.id,
    orderNumber: `BP-${1001 + index}`,
    customerEmail: order.customer.email,
    totalCents: Math.round(order.total * 100),
    status: order.status,
    createdAt: order.created_at,
  }));

  return {
    stats,
    todayAppointments,
    recentOrders,
    attentionItems: buildAttentionItems(stats),
  };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const timeZoneName = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;

  const match = timeZoneName?.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return 0;

  const sign = match[1] === '+' ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || '0');

  return sign * (hours * 60 + minutes);
}

function getZonedDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  };
}

function addDays(parts: { year: number; month: number; day: number }, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function zonedDateTimeToUtcIso(parts: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
}) {
  const localUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour || 0,
    parts.minute || 0,
    parts.second || 0,
    parts.millisecond || 0
  );
  let offsetMinutes = getTimeZoneOffsetMinutes(new Date(localUtcMs), DASHBOARD_TIME_ZONE);
  let utcMs = localUtcMs - offsetMinutes * 60_000;
  offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcMs), DASHBOARD_TIME_ZONE);
  utcMs = localUtcMs - offsetMinutes * 60_000;

  return new Date(utcMs).toISOString();
}

function getDashboardRanges(now = new Date()) {
  const today = getZonedDateParts(now, DASHBOARD_TIME_ZONE);
  const dayOfWeek = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const startOfWeek = addDays(today, -daysFromMonday);
  const endOfWeek = addDays(startOfWeek, 7);
  const startOfNextDay = addDays(today, 1);
  const startOfNextMonth =
    today.month === 12
      ? { year: today.year + 1, month: 1, day: 1 }
      : { year: today.year, month: today.month + 1, day: 1 };

  return {
    startOfDay: zonedDateTimeToUtcIso(today),
    startOfNextDay: zonedDateTimeToUtcIso(startOfNextDay),
    startOfWeek: zonedDateTimeToUtcIso(startOfWeek),
    startOfNextWeek: zonedDateTimeToUtcIso(endOfWeek),
    startOfMonth: zonedDateTimeToUtcIso({ year: today.year, month: today.month, day: 1 }),
    startOfNextMonth: zonedDateTimeToUtcIso(startOfNextMonth),
  };
}

function scopeToStaffSalon<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  staffMember: StaffMember
): T {
  return staffMember.salon_id === 'all' ? query : query.eq('salon_id', staffMember.salon_id);
}

function buildAttentionItems(stats: DashboardStats): DashboardAttentionItem[] {
  return [
    {
      key: 'pending-approvals',
      title: 'Termine genehmigen',
      count: stats.pendingApprovals,
      description: 'Anfragen warten auf Freigabe',
      href: '/admin/kalender',
      severity: 'critical' as const,
    },
    {
      key: 'unassigned',
      title: 'Mitarbeiter zuweisen',
      count: stats.unassignedAppointments,
      description: 'Termine ohne Mitarbeiter',
      href: '/admin/kalender',
      severity: 'warning' as const,
    },
    {
      key: 'unpaid',
      title: 'Zahlungen offen',
      count: stats.unpaidCompletedAppointments,
      description: 'Abgeschlossene Termine ohne Zahlung',
      href: '/admin/finanzen',
      severity: 'warning' as const,
    },
    {
      key: 'failed-notifications',
      title: 'Benachrichtigungen prüfen',
      count: stats.failedNotifications,
      description: 'Fehlgeschlagene Nachrichten',
      href: '/admin/benachrichtigungen',
      severity: 'warning' as const,
    },
    {
      key: 'contacts-without-account',
      title: 'Kontakte ohne Konto',
      count: stats.contactsWithoutAccount,
      description: 'Kundenkontakte ohne Login',
      href: '/admin/kunden',
      severity: 'info' as const,
    },
    {
      key: 'low-stock',
      title: 'Lagerbestand niedrig',
      count: stats.lowStockProducts,
      description: 'Produkte unter Schwelle',
      href: '/admin/inventar',
      severity: 'warning' as const,
    },
    {
      key: 'waitlist',
      title: 'Warteliste aktiv',
      count: stats.activeWaitlist,
      description: 'Kunden warten auf freie Slots',
      href: '/admin/kalender',
      severity: 'info' as const,
    },
  ].filter((item) => item.count > 0);
}

// ============================================
// DATA FETCHING
// ============================================

async function getDashboardData() {
  const staffMember = await getCurrentStaffMember();
  if (!staffMember) {
    redirect('/admin/login');
  }

  // Mock mode: serve demo stats instead of querying Supabase
  if (isMockMode()) {
    return mockDashboardData();
  }

  const supabase = createServiceRoleClient();

  if (!supabase) {
    console.error('[Dashboard] Service role client not available');
    return emptyDashboardData();
  }

  const ranges = getDashboardRanges();

  // Get today's appointments (using appointment_services for service info)
  const todayAppointmentsQuery = scopeToStaffSalon((supabase.from('appointments') as any)
    .select(
      `
      id,
      start_time,
      end_time,
      status,
      customer_name,
      customers (
        first_name,
        last_name
      ),
      appointment_services (
        service_name,
        duration_minutes
      ),
      staff (
        display_name
      )
    `,
      { count: 'exact' }
    )
    .lt('start_time', ranges.startOfNextDay)
    .gt('end_time', ranges.startOfDay)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true }), staffMember);
  const { data: todayAppointmentsData, count: todayCount } = await todayAppointmentsQuery as {
    data: DashboardAppointmentRow[] | null;
    count: number | null;
  };

  // Get week appointments count
  const weekAppointmentsQuery = scopeToStaffSalon((supabase.from('appointments') as any)
    .select('id', { count: 'exact', head: true })
    .lt('start_time', ranges.startOfNextWeek)
    .gt('end_time', ranges.startOfWeek)
    .neq('status', 'cancelled'), staffMember);
  const { count: weekCount } = await weekAppointmentsQuery;

  // Get pending orders count
  const pendingOrdersQuery = scopeToStaffSalon((supabase.from('orders') as any)
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'paid', 'processing']), staffMember);
  const { count: pendingOrdersCount } = await pendingOrdersQuery;

  // Get monthly revenue from orders (payment_status = succeeded)
  const monthlyOrdersQuery = scopeToStaffSalon((supabase.from('orders') as any)
    .select('total_cents, payment_status')
    .gte('created_at', ranges.startOfMonth)
    .lt('created_at', ranges.startOfNextMonth)
    .eq('payment_status', 'succeeded'), staffMember);
  const { data: monthlyOrders } = await monthlyOrdersQuery as { data: MonthlyOrderRow[] | null };

  const orderRevenue = monthlyOrders?.reduce(
    (sum, order) => sum + (order.total_cents || 0),
    0
  ) || 0;

  // Get monthly revenue from appointments (paid or completed, excluding cancelled)
  const monthlyAppointmentsQuery = scopeToStaffSalon((supabase.from('appointments') as any)
    .select('total_cents, status, paid_amount_cents, paid_at')
    .gte('start_time', ranges.startOfMonth)
    .lt('start_time', ranges.startOfNextMonth)
    .neq('status', 'cancelled')
    .or('status.eq.completed,paid_at.not.is.null'), staffMember);
  const { data: monthlyAppointments } = await monthlyAppointmentsQuery as { data: MonthlyAppointmentRow[] | null };

  const appointmentRevenue = (monthlyAppointments || []).reduce((sum, apt) => {
    // Use paid_amount_cents if payment was recorded, otherwise total_cents for completed
    const amount = apt.paid_at && apt.paid_amount_cents
      ? apt.paid_amount_cents
      : (apt.status === 'completed' ? (apt.total_cents || 0) : 0);
    return sum + amount;
  }, 0);

  const monthlyRevenue = orderRevenue + appointmentRevenue;

  // Get new customers this month
  const newCustomersQuery = scopeToStaffSalon((supabase.from('customers') as any)
    .select('id', { count: 'exact', head: true })
    .gte('created_at', ranges.startOfMonth)
    .lt('created_at', ranges.startOfNextMonth)
    .is('deleted_at', null), staffMember);
  const { count: newCustomersCount } = await newCustomersQuery;

  // Get cancelled appointments today
  const cancelledAppointmentsQuery = scopeToStaffSalon((supabase.from('appointments') as any)
    .select('id', { count: 'exact', head: true })
    .lt('start_time', ranges.startOfNextDay)
    .gt('end_time', ranges.startOfDay)
    .eq('status', 'cancelled'), staffMember);
  const { count: cancelledCount } = await cancelledAppointmentsQuery;

  const pendingApprovalsQuery = scopeToStaffSalon((supabase.from('appointments') as any)
    .select('id', { count: 'exact', head: true })
    .neq('status', 'cancelled')
    .eq('is_approved', false), staffMember);
  const { count: pendingApprovalsCount } = await pendingApprovalsQuery;

  const unassignedAppointmentsQuery = scopeToStaffSalon((supabase.from('appointments') as any)
    .select('id', { count: 'exact', head: true })
    .is('staff_id', null)
    .in('status', ACTIVE_APPOINTMENT_STATUSES), staffMember);
  const { count: unassignedAppointmentsCount } = await unassignedAppointmentsQuery;

  const unpaidCompletedQuery = scopeToStaffSalon((supabase.from('appointments') as any)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .is('paid_at', null)
    .gt('total_cents', 0), staffMember);
  const { count: unpaidCompletedCount } = await unpaidCompletedQuery;

  const failedNotificationsQuery = scopeToStaffSalon((supabase.from('notifications') as any)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed'), staffMember);
  const { count: failedNotificationsCount } = await failedNotificationsQuery;

  const contactsWithoutAccountQuery = scopeToStaffSalon((supabase.from('customers') as any)
    .select('id', { count: 'exact', head: true })
    .is('profile_id', null)
    .is('deleted_at', null)
    .eq('is_active', true), staffMember);
  const { count: contactsWithoutAccountCount } = await contactsWithoutAccountQuery;

  const lowStockProductsQuery = scopeToStaffSalon((supabase.from('products') as any)
    .select('id, stock_quantity, low_stock_threshold')
    .eq('is_active', true)
    .eq('track_inventory', true), staffMember);
  const { data: lowStockProductsData } = await lowStockProductsQuery as {
    data: { stock_quantity: number | null; low_stock_threshold: number | null }[] | null;
  };
  const lowStockProductsCount = (lowStockProductsData || []).filter((product) => {
    const threshold = product.low_stock_threshold ?? 0;
    return threshold > 0 && (product.stock_quantity || 0) <= threshold;
  }).length;

  const activeWaitlistQuery = scopeToStaffSalon((supabase.from('waitlist') as any)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active'), staffMember);
  const { count: activeWaitlistCount } = await activeWaitlistQuery;

  // Get recent orders
  const recentOrdersQuery = scopeToStaffSalon((supabase.from('orders') as any)
    .select('id, order_number, customer_email, total_cents, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5), staffMember);
  const { data: recentOrdersData } = await recentOrdersQuery as { data: RecentOrderRow[] | null };

  // Transform appointments data
  const todayAppointments: TodayAppointment[] = (todayAppointmentsData || []).map(
    (apt) => {
      // Get customer name from linked customer or denormalized field
      const customerName = apt.customers
        ? `${apt.customers.first_name} ${apt.customers.last_name}`
        : apt.customer_name || 'Unbekannt';

      // Get service info from appointment_services
      const firstService = apt.appointment_services?.[0];
      const serviceName = firstService?.service_name || 'Unbekannt';
      const duration = firstService?.duration_minutes || 30;

      return {
        id: apt.id,
        time: new Date(apt.start_time).toLocaleTimeString('de-CH', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Zurich',
        }),
        customerName,
        serviceName,
        staffName: apt.staff?.display_name || 'Nicht zugewiesen',
        status: apt.status,
        duration,
      };
    }
  );

  // Transform orders data
  const recentOrders: RecentOrder[] = (recentOrdersData || []).map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    customerEmail: order.customer_email,
    totalCents: order.total_cents,
    status: order.status,
    createdAt: order.created_at,
  }));

  const stats: DashboardStats = {
    todayAppointments: todayCount || 0,
    weekAppointments: weekCount || 0,
    pendingOrders: pendingOrdersCount || 0,
    monthlyRevenue,
    newCustomers: newCustomersCount || 0,
    cancelledAppointments: cancelledCount || 0,
    pendingApprovals: pendingApprovalsCount || 0,
    unassignedAppointments: unassignedAppointmentsCount || 0,
    unpaidCompletedAppointments: unpaidCompletedCount || 0,
    failedNotifications: failedNotificationsCount || 0,
    contactsWithoutAccount: contactsWithoutAccountCount || 0,
    lowStockProducts: lowStockProductsCount || 0,
    activeWaitlist: activeWaitlistCount || 0,
  };

  return {
    stats,
    todayAppointments,
    recentOrders,
    attentionItems: buildAttentionItems(stats),
  };
}

// ============================================
// ADMIN DASHBOARD PAGE
// ============================================

export default async function AdminDashboardPage() {
  const { stats, todayAppointments, recentOrders, attentionItems } = await getDashboardData();

  return (
    <AdminDashboardContent
      stats={stats}
      todayAppointments={todayAppointments}
      recentOrders={recentOrders}
      attentionItems={attentionItems}
    />
  );
}
