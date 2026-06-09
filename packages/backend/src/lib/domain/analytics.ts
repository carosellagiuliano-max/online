import {
  getFinanceData,
  normalizeFinanceFilters,
  type DailySales,
  type FinanceData,
  type FinancePeriod,
} from './finance';

export type AnalyticsPeriod = FinancePeriod;
export type AnalyticsSource = 'all' | 'appointments' | 'shop';

export interface AnalyticsFilters {
  period: AnalyticsPeriod;
  startDate?: string;
  endDate?: string;
  source: AnalyticsSource;
}

export interface AnalyticsKpis {
  totalRevenueCents: number;
  netRevenueCents: number;
  appointmentRevenueCents: number;
  shopRevenueCents: number;
  openAmountCents: number;
  totalAppointments: number;
  confirmedAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  requestedAppointments: number;
  averageAppointmentValueCents: number;
  totalOrders: number;
  paidOrders: number;
  newCustomers: number;
  returningCustomers: number;
  activeCustomers: number;
  onlineBookings: number;
  adminBookings: number;
  cancellationRate: number;
  noShowRate: number;
  revenueChangePercent: number | null;
  newCustomersChangePercent: number | null;
}

export interface AnalyticsServiceRow {
  id: string;
  name: string;
  bookings: number;
  revenueCents: number;
  averagePriceCents: number;
  sharePercent: number;
}

export interface AnalyticsStaffRow {
  id: string;
  name: string;
  appointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  revenueCents: number;
  averageAppointmentValueCents: number;
}

export interface AnalyticsCustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  appointments: number;
  orders: number;
  revenueCents: number;
  lastActivityAt: string;
  customerType: 'new' | 'returning';
}

export interface AnalyticsAppointmentRow {
  id: string;
  bookingNumber: string;
  startTime: string;
  customerName: string;
  staffName: string;
  services: string;
  status: string;
  paymentStatus: string;
  amountCents: number;
  paidAmountCents: number;
  source: 'Online' | 'Admin';
}

export interface AnalyticsOrderRow {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  products: string;
  status: string;
  paymentStatus: string;
  source: string;
  totalCents: number;
  refundCents: number;
  netCents: number;
}

export interface AnalyticsData {
  filters: AnalyticsFilters;
  salonName: string;
  currency: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  kpis: AnalyticsKpis;
  dailyRevenue: DailySales[];
  topServices: AnalyticsServiceRow[];
  topStaff: AnalyticsStaffRow[];
  topCustomers: AnalyticsCustomerRow[];
  appointmentRows: AnalyticsAppointmentRow[];
  orderRows: AnalyticsOrderRow[];
  finance: FinanceData;
}

type DbClient = any;

interface AppointmentRow {
  id: string;
  booking_number: string | null;
  status: string;
  start_time: string;
  total_cents: number | null;
  paid_amount_cents: number | null;
  paid_at: string | null;
  payment_method: string | null;
  booked_online: boolean | null;
  created_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customers?: CustomerRelation | null;
  staff?: { id: string; display_name: string | null } | null;
  appointment_services?: Array<{
    service_id: string | null;
    service_name: string | null;
    price_cents: number | null;
    duration_minutes?: number | null;
  }>;
}

interface OrderRow {
  id: string;
  order_number: string | null;
  status: string;
  payment_status: string | null;
  source: string | null;
  total_cents: number | null;
  refunded_amount_cents: number | null;
  created_at: string;
  paid_at: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customers?: CustomerRelation | null;
  order_items?: Array<{
    product_id: string | null;
    item_name: string | null;
    quantity: number | null;
    total_cents: number | null;
  }>;
}

interface CustomerRelation {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  phone?: string | null;
  created_at: string | null;
}

interface CustomerRow extends CustomerRelation {
  is_active?: boolean | null;
}

const DEFAULT_TIMEZONE = 'Europe/Zurich';
const COMPLETED_REVENUE_STATUSES = new Set(['confirmed', 'completed']);
const CANCELLED_STATUSES = new Set(['cancelled']);
const NO_SHOW_STATUSES = new Set(['no_show']);

export const analyticsPeriodLabels: Record<AnalyticsPeriod, string> = {
  week: 'Letzte 7 Tage',
  month: 'Diesen Monat',
  quarter: 'Dieses Quartal',
  year: 'Dieses Jahr',
  custom: 'Benutzerdefiniert',
};

export const analyticsSourceLabels: Record<AnalyticsSource, string> = {
  all: 'Alle Quellen',
  appointments: 'Termine',
  shop: 'Shop',
};

export function normalizeAnalyticsFilters(input: {
  period?: unknown;
  startDate?: string;
  endDate?: string;
  source?: unknown;
}): AnalyticsFilters {
  const period = isAnalyticsPeriod(input.period) ? input.period : 'month';
  const source = input.source === 'appointments' || input.source === 'shop' ? input.source : 'all';

  return {
    period,
    startDate: input.startDate,
    endDate: input.endDate,
    source,
  };
}

export async function getAnalyticsData(
  supabase: DbClient,
  salonId: string,
  input: Partial<AnalyticsFilters> = {}
): Promise<AnalyticsData> {
  const filters = normalizeAnalyticsFilters(input);
  const finance = await getFinanceData(supabase, salonId, normalizeFinanceFilters({
    period: filters.period,
    startDate: filters.startDate,
    endDate: filters.endDate,
    source: filters.source === 'appointments' ? 'salon' : filters.source,
  }));

  const [appointments, orders, customers, previousFinance, previousCustomers] = await Promise.all([
    filters.source === 'shop'
      ? Promise.resolve([])
      : fetchAppointments(supabase, salonId, finance.stats.periodStart, finance.stats.periodEnd),
    filters.source === 'appointments'
      ? Promise.resolve([])
      : fetchOrders(supabase, salonId, finance.stats.periodStart, finance.stats.periodEnd),
    fetchCustomers(supabase, salonId),
    getPreviousFinanceData(supabase, salonId, filters, finance),
    fetchPreviousPeriodCustomers(supabase, salonId, filters, finance),
  ]);

  return buildAnalyticsData({
    filters,
    finance,
    appointments,
    orders,
    customers,
    previousFinance,
    previousCustomers,
  });
}

export function buildAnalyticsData(input: {
  filters: AnalyticsFilters;
  finance: FinanceData;
  appointments: AppointmentRow[];
  orders: OrderRow[];
  customers: CustomerRow[];
  previousFinance?: FinanceData | null;
  previousCustomers?: CustomerRow[] | null;
}): AnalyticsData {
  const { filters, finance } = input;
  const appointmentRows = input.appointments.map(toAppointmentRow);
  const orderRows = input.orders.map(toOrderRow);
  const activeCustomerIds = new Set<string>();
  const newCustomerIds = new Set(
    input.customers
      .filter((customer) => isInRange(customer.created_at, finance.stats.periodStart, finance.stats.periodEnd))
      .map((customer) => customer.id)
  );

  const serviceMap = new Map<string, AnalyticsServiceRow>();
  const staffMap = new Map<string, AnalyticsStaffRow>();
  const customerMap = new Map<string, AnalyticsCustomerRow>();
  let confirmedAppointments = 0;
  let completedAppointments = 0;
  let cancelledAppointments = 0;
  let noShowAppointments = 0;
  let requestedAppointments = 0;
  let onlineBookings = 0;
  let adminBookings = 0;

  for (const appointment of input.appointments) {
    const paidAmount = positiveCents(appointment.paid_amount_cents);
    const totalAmount = positiveCents(appointment.total_cents);
    const customer = normalizeCustomer(appointment.customers, appointment);
    const staffName = appointment.staff?.display_name || 'Nicht zugewiesen';
    const staffId = appointment.staff?.id || 'unassigned';
    const isRevenueStatus = COMPLETED_REVENUE_STATUSES.has(appointment.status);

    if (appointment.status === 'confirmed') confirmedAppointments += 1;
    if (appointment.status === 'completed') completedAppointments += 1;
    if (CANCELLED_STATUSES.has(appointment.status)) cancelledAppointments += 1;
    if (NO_SHOW_STATUSES.has(appointment.status)) noShowAppointments += 1;
    if (appointment.status === 'requested') requestedAppointments += 1;
    if (appointment.booked_online) onlineBookings += 1;
    else adminBookings += 1;

    if (customer.id) activeCustomerIds.add(customer.id);
    addCustomerActivity(customerMap, customer, {
      appointments: 1,
      orders: 0,
      revenueCents: paidAmount,
      activityAt: appointment.start_time,
      isNew: newCustomerIds.has(customer.id),
    });

    const staff = staffMap.get(staffId) || {
      id: staffId,
      name: staffName,
      appointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      revenueCents: 0,
      averageAppointmentValueCents: 0,
    };
    staff.appointments += 1;
    if (appointment.status === 'completed') staff.completedAppointments += 1;
    if (CANCELLED_STATUSES.has(appointment.status)) staff.cancelledAppointments += 1;
    if (NO_SHOW_STATUSES.has(appointment.status)) staff.noShowAppointments += 1;
    staff.revenueCents += paidAmount;
    staff.averageAppointmentValueCents = staff.appointments > 0 ? Math.round(staff.revenueCents / staff.appointments) : 0;
    staffMap.set(staffId, staff);

    for (const service of appointment.appointment_services || []) {
      const countAsBooking = !CANCELLED_STATUSES.has(appointment.status) && !NO_SHOW_STATUSES.has(appointment.status);
      if (!countAsBooking && paidAmount === 0) continue;

      const serviceId = service.service_id || service.service_name || 'unknown-service';
      const serviceName = service.service_name || 'Unbekannte Leistung';
      const row = serviceMap.get(serviceId) || {
        id: serviceId,
        name: serviceName,
        bookings: 0,
        revenueCents: 0,
        averagePriceCents: 0,
        sharePercent: 0,
      };
      row.bookings += countAsBooking ? 1 : 0;
      if (isRevenueStatus && paidAmount > 0) {
        row.revenueCents += positiveCents(service.price_cents);
      } else if (paidAmount > 0 && totalAmount > 0) {
        row.revenueCents += Math.round((positiveCents(service.price_cents) / totalAmount) * paidAmount);
      }
      row.averagePriceCents = row.bookings > 0 ? Math.round(row.revenueCents / row.bookings) : 0;
      serviceMap.set(serviceId, row);
    }
  }

  for (const order of input.orders) {
    const customer = normalizeCustomer(order.customers, order);
    const net = Math.max(0, positiveCents(order.total_cents) - getOrderRefundCents(order));
    if (customer.id) activeCustomerIds.add(customer.id);
    addCustomerActivity(customerMap, customer, {
      appointments: 0,
      orders: 1,
      revenueCents: net,
      activityAt: order.paid_at || order.created_at,
      isNew: newCustomerIds.has(customer.id),
    });
  }

  const totalAppointments = input.appointments.length;
  const returningCustomers = Math.max(0, activeCustomerIds.size - [...activeCustomerIds].filter((id) => newCustomerIds.has(id)).length);
  const newCustomers = input.customers.filter((customer) =>
    isInRange(customer.created_at, finance.stats.periodStart, finance.stats.periodEnd)
  ).length;
  const previousRevenue = input.previousFinance?.stats.netRevenueCents ?? null;
  const previousNewCustomers = input.previousCustomers?.length ?? null;

  const topServices = Array.from(serviceMap.values())
    .map((service) => ({
      ...service,
      sharePercent: finance.stats.appointmentRevenueCents > 0
        ? Math.round((service.revenueCents / finance.stats.appointmentRevenueCents) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents || b.bookings - a.bookings)
    .slice(0, 20);

  return {
    filters,
    salonName: finance.stats.salonName,
    currency: finance.stats.currency,
    timezone: finance.stats.timezone,
    periodStart: finance.stats.periodStart,
    periodEnd: finance.stats.periodEnd,
    kpis: {
      totalRevenueCents: finance.stats.paidRevenueCents,
      netRevenueCents: finance.stats.netRevenueCents,
      appointmentRevenueCents: finance.stats.appointmentRevenueCents,
      shopRevenueCents: finance.stats.shopRevenueCents,
      openAmountCents: finance.stats.openAmountCents,
      totalAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      requestedAppointments,
      averageAppointmentValueCents: finance.stats.paidAppointments > 0
        ? Math.round(finance.stats.appointmentRevenueCents / finance.stats.paidAppointments)
        : 0,
      totalOrders: input.orders.length,
      paidOrders: finance.stats.paidOrders,
      newCustomers,
      returningCustomers,
      activeCustomers: activeCustomerIds.size,
      onlineBookings,
      adminBookings,
      cancellationRate: totalAppointments > 0 ? Math.round((cancelledAppointments / totalAppointments) * 1000) / 10 : 0,
      noShowRate: totalAppointments > 0 ? Math.round((noShowAppointments / totalAppointments) * 1000) / 10 : 0,
      revenueChangePercent: calculateChange(finance.stats.netRevenueCents, previousRevenue),
      newCustomersChangePercent: calculateChange(newCustomers, previousNewCustomers),
    },
    dailyRevenue: finance.dailySales,
    topServices,
    topStaff: Array.from(staffMap.values())
      .sort((a, b) => b.revenueCents - a.revenueCents || b.appointments - a.appointments)
      .slice(0, 20),
    topCustomers: Array.from(customerMap.values())
      .sort((a, b) => b.revenueCents - a.revenueCents || b.appointments + b.orders - (a.appointments + a.orders))
      .slice(0, 50),
    appointmentRows: appointmentRows.sort((a, b) => b.startTime.localeCompare(a.startTime)),
    orderRows: orderRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    finance,
  };
}

async function getPreviousFinanceData(
  supabase: DbClient,
  salonId: string,
  filters: AnalyticsFilters,
  finance: FinanceData
): Promise<FinanceData | null> {
  if (filters.period === 'custom') return null;

  const previous = getPreviousPeriodDateOnly(filters.period, finance.stats.periodStart, finance.stats.periodEnd, finance.stats.timezone);
  if (!previous) return null;

  return getFinanceData(supabase, salonId, normalizeFinanceFilters({
    period: 'custom',
    startDate: previous.startDate,
    endDate: previous.endDate,
    source: filters.source === 'appointments' ? 'salon' : filters.source,
  }));
}

async function fetchPreviousPeriodCustomers(
  supabase: DbClient,
  salonId: string,
  filters: AnalyticsFilters,
  finance: FinanceData
): Promise<CustomerRow[] | null> {
  if (filters.period === 'custom') return null;
  const previous = getPreviousPeriodDateOnly(filters.period, finance.stats.periodStart, finance.stats.periodEnd, finance.stats.timezone);
  if (!previous) return null;

  const start = zonedDateTimeToUtcIso(previous.startDate, '00:00:00.000', finance.stats.timezone);
  const end = zonedDateTimeToUtcIso(previous.endDate, '23:59:59.999', finance.stats.timezone);
  const { data, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, phone, created_at, is_active')
    .eq('salon_id', salonId)
    .gte('created_at', start)
    .lte('created_at', end);

  if (error) {
    console.error('[Analytics] Previous customer query failed:', error);
    return [];
  }

  return (data || []) as CustomerRow[];
}

async function fetchAppointments(supabase: DbClient, salonId: string, from: string, to: string): Promise<AppointmentRow[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      booking_number,
      status,
      start_time,
      total_cents,
      paid_amount_cents,
      paid_at,
      payment_method,
      booked_online,
      created_at,
      customer_name,
      customer_email,
      customer_phone,
      customers:customer_id (
        id,
        first_name,
        last_name,
        email,
        phone,
        created_at
      ),
      staff:staff_id (
        id,
        display_name
      ),
      appointment_services (
        service_id,
        service_name,
        price_cents,
        duration_minutes
      )
    `)
    .eq('salon_id', salonId)
    .gte('start_time', from)
    .lte('start_time', to)
    .order('start_time', { ascending: false });

  if (error) {
    console.error('[Analytics] Appointment query failed:', error);
    return [];
  }

  return (data || []) as AppointmentRow[];
}

async function fetchOrders(supabase: DbClient, salonId: string, from: string, to: string): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      payment_status,
      source,
      total_cents,
      refunded_amount_cents,
      created_at,
      paid_at,
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      customers:customer_id (
        id,
        first_name,
        last_name,
        email,
        phone,
        created_at
      ),
      order_items (
        product_id,
        item_name,
        quantity,
        total_cents
      )
    `)
    .eq('salon_id', salonId)
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Analytics] Order query failed:', error);
    return [];
  }

  return (data || []) as OrderRow[];
}

async function fetchCustomers(supabase: DbClient, salonId: string): Promise<CustomerRow[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, phone, created_at, is_active')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Analytics] Customer query failed:', error);
    return [];
  }

  return (data || []) as CustomerRow[];
}

function toAppointmentRow(appointment: AppointmentRow): AnalyticsAppointmentRow {
  const services = (appointment.appointment_services || [])
    .map((service) => service.service_name)
    .filter(Boolean)
    .join(', ');

  return {
    id: appointment.id,
    bookingNumber: appointment.booking_number || appointment.id.slice(0, 8),
    startTime: appointment.start_time,
    customerName: normalizeCustomer(appointment.customers, appointment).name,
    staffName: appointment.staff?.display_name || 'Nicht zugewiesen',
    services: services || 'Keine Leistung',
    status: appointment.status,
    paymentStatus: appointment.paid_at && positiveCents(appointment.paid_amount_cents) >= positiveCents(appointment.total_cents)
      ? 'paid'
      : positiveCents(appointment.paid_amount_cents) > 0
        ? 'partially_paid'
        : 'open',
    amountCents: positiveCents(appointment.total_cents),
    paidAmountCents: positiveCents(appointment.paid_amount_cents),
    source: appointment.booked_online ? 'Online' : 'Admin',
  };
}

function toOrderRow(order: OrderRow): AnalyticsOrderRow {
  const products = (order.order_items || [])
    .map((item) => `${item.quantity || 1}x ${item.item_name || 'Produkt'}`)
    .join(', ');
  const refund = getOrderRefundCents(order);
  const total = positiveCents(order.total_cents);

  return {
    id: order.id,
    orderNumber: order.order_number || order.id.slice(0, 8),
    createdAt: order.created_at,
    customerName: normalizeCustomer(order.customers, order).name,
    products: products || 'Keine Positionen',
    status: order.status,
    paymentStatus: order.payment_status || 'pending',
    source: order.source || 'online',
    totalCents: total,
    refundCents: refund,
    netCents: Math.max(0, total - refund),
  };
}

function normalizeCustomer(customer: CustomerRelation | null | undefined, fallback: {
  id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
}): { id: string; name: string; email: string; phone: string } {
  const id = customer?.id || fallback.customer_id || fallback.id || 'guest';
  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim()
    || fallback.customer_name
    || fallback.customer_email
    || 'Gastkunde';
  return {
    id,
    name,
    email: customer?.email || fallback.customer_email || '',
    phone: customer?.phone || fallback.customer_phone || '',
  };
}

function addCustomerActivity(
  map: Map<string, AnalyticsCustomerRow>,
  customer: { id: string; name: string; email: string; phone: string },
  activity: { appointments: number; orders: number; revenueCents: number; activityAt: string; isNew: boolean }
) {
  const existing = map.get(customer.id);
  if (existing) {
    existing.appointments += activity.appointments;
    existing.orders += activity.orders;
    existing.revenueCents += activity.revenueCents;
    if (activity.activityAt > existing.lastActivityAt) existing.lastActivityAt = activity.activityAt;
    if (!activity.isNew) existing.customerType = 'returning';
    return;
  }

  map.set(customer.id, {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    appointments: activity.appointments,
    orders: activity.orders,
    revenueCents: activity.revenueCents,
    lastActivityAt: activity.activityAt,
    customerType: activity.isNew ? 'new' : 'returning',
  });
}

function getOrderRefundCents(order: OrderRow): number {
  const recorded = positiveCents(order.refunded_amount_cents);
  if (recorded > 0) return Math.min(recorded, positiveCents(order.total_cents));
  if (order.payment_status === 'refunded') return positiveCents(order.total_cents);
  return 0;
}

function calculateChange(current: number, previous: number | null): number | null {
  if (previous === null) return null;
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function isInRange(value: string | null | undefined, from: string, to: string): boolean {
  if (!value) return false;
  return value >= from && value <= to;
}

function positiveCents(value: number | null | undefined): number {
  return Math.max(0, Math.round(Number(value || 0)));
}

function isAnalyticsPeriod(value: unknown): value is AnalyticsPeriod {
  return value === 'week' || value === 'month' || value === 'quarter' || value === 'year' || value === 'custom';
}

function getPreviousPeriodDateOnly(
  period: AnalyticsPeriod,
  periodStart: string,
  periodEnd: string,
  timezone: string
): { startDate: string; endDate: string } | null {
  if (period === 'custom') return null;

  const start = getZonedDateOnly(new Date(periodStart), timezone);
  const end = getZonedDateOnly(new Date(periodEnd), timezone);

  if (period === 'week') {
    return {
      startDate: addDays(start, -7),
      endDate: addDays(end, -7),
    };
  }

  if (period === 'month') {
    const [year, month] = start.split('-').map(Number);
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? year - 1 : year;
    return {
      startDate: `${previousYear}-${String(previousMonth).padStart(2, '0')}-01`,
      endDate: lastDayOfMonth(previousYear, previousMonth),
    };
  }

  if (period === 'quarter') {
    const [year, month] = start.split('-').map(Number);
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    const previousStartMonth = quarterStartMonth === 1 ? 10 : quarterStartMonth - 3;
    const previousYear = quarterStartMonth === 1 ? year - 1 : year;
    return {
      startDate: `${previousYear}-${String(previousStartMonth).padStart(2, '0')}-01`,
      endDate: lastDayOfMonth(previousYear, previousStartMonth + 2),
    };
  }

  const year = Number(start.slice(0, 4));
  return {
    startDate: `${year - 1}-01-01`,
    endDate: `${year - 1}-12-31`,
  };
}

function getZonedDateOnly(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value || '1970';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month, 0, 12));
  return date.toISOString().slice(0, 10);
}

function zonedDateTimeToUtcIso(dateOnly: string, time: string, timezone: string): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const [hour, minute, secondPart] = time.split(':');
  const [second, millisecond = '0'] = secondPart.split('.');
  const utcGuess = new Date(Date.UTC(
    year,
    month - 1,
    day,
    Number(hour),
    Number(minute),
    Number(second),
    Number(millisecond)
  ));
  const offset = getTimezoneOffsetMs(utcGuess, timezone || DEFAULT_TIMEZONE);
  return new Date(utcGuess.getTime() - offset).toISOString();
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return asUtc - date.getTime();
}
