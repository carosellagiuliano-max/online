export type FinancePeriod = 'week' | 'month' | 'quarter' | 'year' | 'custom';
export type FinanceSource = 'all' | 'shop' | 'salon';
export type FinancePaymentState = 'all' | 'paid' | 'open' | 'refunded' | 'failed';
export type FinancePaymentMethod = 'all' | 'stripe_card' | 'stripe_twint' | 'cash' | 'terminal' | 'voucher' | 'manual_adjustment' | 'pay_at_venue';

export interface FinanceFilters {
  period: FinancePeriod;
  startDate?: string;
  endDate?: string;
  source: FinanceSource;
  paymentState: FinancePaymentState;
  paymentMethod: FinancePaymentMethod;
}

export interface FinanceStats {
  periodStart: string;
  periodEnd: string;
  salonName: string;
  currency: string;
  timezone: string;
  grossRevenueCents: number;
  paidRevenueCents: number;
  openAmountCents: number;
  shopRevenueCents: number;
  appointmentRevenueCents: number;
  totalRefundsCents: number;
  netRevenueCents: number;
  vatCents: number;
  netBeforeVatCents: number;
  vatRate: number;
  totalOrders: number;
  paidOrders: number;
  openOrders: number;
  totalAppointments: number;
  paidAppointments: number;
  openAppointments: number;
  paymentCount: number;
  averagePaymentCents: number;
  failedAmountCents: number;
}

export interface PaymentMethodStats {
  method: string;
  count: number;
  totalCents: number;
}

export interface VatSummary {
  grossCents: number;
  netCents: number;
  vatCents: number;
  vatRate: number;
}

export interface DailySales {
  date: string;
  orderCount: number;
  appointmentCount: number;
  orderRevenue: number;
  appointmentRevenue: number;
  refundAmount: number;
  totalRevenue: number;
}

export interface FinanceTransaction {
  id: string;
  date: string;
  customerName: string;
  customerEmail: string;
  source: 'shop' | 'appointment' | 'payment';
  reference: string;
  method: string;
  status: string;
  grossCents: number;
  refundCents: number;
  netCents: number;
  staffName?: string;
  note?: string;
}

export interface FinanceOpenItem {
  id: string;
  date: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  source: 'shop' | 'appointment';
  reference: string;
  status: string;
  totalCents: number;
  paidCents: number;
  openCents: number;
}

export interface FinanceRefund {
  id: string;
  date: string;
  customerName: string;
  source: 'shop' | 'appointment' | 'payment';
  reference: string;
  method: string;
  status: string;
  amountCents: number;
  reason?: string;
}

export interface FinanceBreakdownRow {
  id: string;
  label: string;
  count: number;
  grossCents: number;
  refundCents: number;
  openCents: number;
  netCents: number;
}

export interface FinanceData {
  filters: FinanceFilters;
  stats: FinanceStats;
  paymentMethods: PaymentMethodStats[];
  vatSummary: VatSummary;
  dailySales: DailySales[];
  transactions: FinanceTransaction[];
  openItems: FinanceOpenItem[];
  refunds: FinanceRefund[];
  orderRows: FinanceTransaction[];
  appointmentRows: FinanceTransaction[];
  productBreakdown: FinanceBreakdownRow[];
  employeeBreakdown: FinanceBreakdownRow[];
  customerBreakdown: FinanceBreakdownRow[];
}

type DbClient = any;

interface SalonRow {
  name: string | null;
  timezone: string | null;
  currency: string | null;
  default_vat_rate: number | string | null;
}

interface OrderRow {
  id: string;
  order_number: string | null;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  total_cents: number | null;
  tax_cents: number | null;
  refunded_amount_cents: number | null;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  order_items?: Array<{
    product_id: string | null;
    item_name: string | null;
    quantity: number | null;
    total_cents: number | null;
  }>;
}

interface AppointmentRow {
  id: string;
  booking_number: string | null;
  status: string;
  start_time: string;
  total_cents: number | null;
  paid_amount_cents: number | null;
  paid_at: string | null;
  payment_method: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  staff?: { id: string; display_name: string | null } | null;
  appointment_services?: Array<{
    service_id: string | null;
    service_name: string | null;
    price_cents: number | null;
  }>;
}

interface RefundRow {
  id: string;
  amount_cents: number | null;
  status: string;
  reason: string | null;
  created_at: string;
  succeeded_at: string | null;
  payments?: {
    reference_type: string | null;
    reference_id: string | null;
    payment_method: string | null;
  } | null;
}

const DEFAULT_TIMEZONE = 'Europe/Zurich';
const DEFAULT_CURRENCY = 'CHF';

const PAID_ORDER_PAYMENT_STATUSES = new Set(['succeeded', 'partially_refunded', 'refunded']);
const OPEN_ORDER_PAYMENT_STATUSES = new Set(['pending', 'processing']);
const FAILED_ORDER_PAYMENT_STATUSES = new Set(['failed']);
const EXCLUDED_ORDER_STATUSES = new Set(['cancelled', 'refunded']);
const EXCLUDED_APPOINTMENT_STATUSES = new Set(['cancelled', 'no_show']);

export const financePaymentStateLabels: Record<FinancePaymentState, string> = {
  all: 'Alle Zahlungsstände',
  paid: 'Bezahlt',
  open: 'Offen',
  refunded: 'Erstattet',
  failed: 'Fehler',
};

export const financeSourceLabels: Record<FinanceSource, string> = {
  all: 'Alle Quellen',
  shop: 'Shop',
  salon: 'Salon',
};

export const financePaymentMethodLabels: Record<FinancePaymentMethod, string> = {
  all: 'Alle Zahlungsarten',
  stripe_card: 'Kreditkarte',
  stripe_twint: 'TWINT',
  cash: 'Bargeld',
  terminal: 'Kartenterminal',
  voucher: 'Gutschein',
  manual_adjustment: 'Manuelle Korrektur',
  pay_at_venue: 'Zahlung vor Ort',
};

export function normalizeFinanceFilters(input: {
  period?: unknown;
  startDate?: string;
  endDate?: string;
  source?: unknown;
  paymentState?: unknown;
  paymentMethod?: unknown;
}): FinanceFilters {
  const period = isFinancePeriod(input.period) ? input.period : 'month';
  const source = input.source === 'shop' || input.source === 'salon' ? input.source : 'all';
  const paymentState = isFinancePaymentState(input.paymentState) ? input.paymentState : 'all';
  const paymentMethod = isFinancePaymentMethod(input.paymentMethod) ? input.paymentMethod : 'all';

  return {
    period,
    startDate: input.startDate,
    endDate: input.endDate,
    source,
    paymentState,
    paymentMethod,
  };
}

export async function getFinanceData(
  supabase: DbClient,
  salonId: string,
  input: Partial<FinanceFilters> = {}
): Promise<FinanceData> {
  const filters = normalizeFinanceFilters(input);
  const salon = await getSalonContext(supabase, salonId);
  const range = getFinancePeriodRange(filters, salon.timezone);

  const [orders, appointments, refunds] = await Promise.all([
    filters.source === 'salon' ? Promise.resolve([]) : fetchOrders(supabase, salonId, range.periodStart, range.periodEnd),
    filters.source === 'shop' ? Promise.resolve([]) : fetchAppointments(supabase, salonId, range.periodStart, range.periodEnd),
    fetchRefunds(supabase, salonId, range.periodStart, range.periodEnd),
  ]);

  return buildFinanceData({
    filters,
    salon,
    periodStart: range.periodStart,
    periodEnd: range.periodEnd,
    orders,
    appointments,
    refunds,
  });
}

export function buildFinanceData(input: {
  filters: FinanceFilters;
  salon: SalonRow;
  periodStart: string;
  periodEnd: string;
  orders: OrderRow[];
  appointments: AppointmentRow[];
  refunds: RefundRow[];
}): FinanceData {
  const { filters, salon, periodStart, periodEnd } = input;
  const vatRate = normalizeVatRate(salon.default_vat_rate);
  const dailySales = createDailySalesMap(periodStart, periodEnd, salon.timezone || DEFAULT_TIMEZONE);
  const transactions: FinanceTransaction[] = [];
  const openItems: FinanceOpenItem[] = [];
  const refunds: FinanceRefund[] = [];
  const productMap = new Map<string, FinanceBreakdownRow>();
  const employeeMap = new Map<string, FinanceBreakdownRow>();
  const customerMap = new Map<string, FinanceBreakdownRow>();
  const methodMap = new Map<string, PaymentMethodStats>();

  let shopRevenueCents = 0;
  let appointmentRevenueCents = 0;
  let openAmountCents = 0;
  let totalRefundsCents = 0;
  let failedAmountCents = 0;
  let paidOrders = 0;
  let openOrders = 0;
  let paidAppointments = 0;
  let openAppointments = 0;
  let paymentCount = 0;

  const orderRows = input.orders
    .filter((order) => matchesOrderFilters(order, filters, periodStart, periodEnd))
    .map((order) => {
      const total = positiveCents(order.total_cents);
      const refund = getOrderRefundCents(order);
      const isPaid = PAID_ORDER_PAYMENT_STATUSES.has(order.payment_status || '');
      const isOpen = !EXCLUDED_ORDER_STATUSES.has(order.status) && OPEN_ORDER_PAYMENT_STATUSES.has(order.payment_status || '');
      const isFailed = FAILED_ORDER_PAYMENT_STATUSES.has(order.payment_status || '');
      const paidDate = order.paid_at || order.created_at;
      const method = order.payment_method || 'pay_at_venue';
      const net = Math.max(0, total - refund);

      if (isPaid) {
        paidOrders += 1;
        paymentCount += 1;
        shopRevenueCents += net;
        addMethod(methodMap, method, 1, net);
        addDailyRevenue(dailySales, paidDate, 'shop', net);
        addCustomer(customerMap, order.customer_email || order.id, order.customer_name || order.customer_email || 'Gastkunde', net, refund, 0);
      }

      if (isOpen) {
        openOrders += 1;
        openAmountCents += total;
        addOpenItem(openItems, {
          id: order.id,
          date: order.created_at,
          customerName: order.customer_name || 'Gastkunde',
          customerEmail: order.customer_email || '',
          customerPhone: order.customer_phone || undefined,
          source: 'shop',
          reference: order.order_number || order.id.slice(0, 8),
          status: order.payment_status || order.status,
          totalCents: total,
          paidCents: 0,
          openCents: total,
        });
        addCustomer(customerMap, order.customer_email || order.id, order.customer_name || order.customer_email || 'Gastkunde', 0, 0, total);
      }

      if (isFailed) {
        failedAmountCents += total;
      }

      if (refund > 0 && isInRange(order.refunded_at || order.paid_at || order.created_at, periodStart, periodEnd)) {
        totalRefundsCents += refund;
        addDailyRefund(dailySales, order.refunded_at || order.paid_at || order.created_at, refund);
        refunds.push({
          id: `order-${order.id}`,
          date: order.refunded_at || order.paid_at || order.created_at,
          customerName: order.customer_name || 'Gastkunde',
          source: 'shop',
          reference: order.order_number || order.id.slice(0, 8),
          method,
          status: order.payment_status || 'refunded',
          amountCents: refund,
          reason: 'Shop-Rückerstattung',
        });
      }

      for (const item of order.order_items || []) {
        const label = item.item_name || 'Produkt';
        const key = item.product_id || label;
        const itemTotal = isPaid ? Math.max(0, positiveCents(item.total_cents)) : 0;
        addBreakdown(productMap, key, label, item.quantity || 1, itemTotal, 0, 0);
      }

      return {
        id: order.id,
        date: paidDate,
        customerName: order.customer_name || 'Gastkunde',
        customerEmail: order.customer_email || '',
        source: 'shop' as const,
        reference: order.order_number || order.id.slice(0, 8),
        method,
        status: order.payment_status || order.status,
        grossCents: isPaid ? total : 0,
        refundCents: refund,
        netCents: isPaid ? net : 0,
        note: order.status,
      };
    });

  const appointmentRows = input.appointments
    .filter((appointment) => matchesAppointmentFilters(appointment, filters, periodStart, periodEnd))
    .map((appointment) => {
      const total = positiveCents(appointment.total_cents);
      const paid = Math.min(total, positiveCents(appointment.paid_amount_cents));
      const open = EXCLUDED_APPOINTMENT_STATUSES.has(appointment.status) ? 0 : Math.max(0, total - paid);
      const method = appointment.payment_method || 'cash';
      const paidDate = appointment.paid_at || appointment.start_time;

      if (paid > 0 && appointment.paid_at) {
        paidAppointments += 1;
        paymentCount += 1;
        appointmentRevenueCents += paid;
        addMethod(methodMap, method, 1, paid);
        addDailyRevenue(dailySales, appointment.paid_at, 'appointment', paid);
        addCustomer(customerMap, appointment.customer_email || appointment.id, appointment.customer_name || appointment.customer_email || 'Kunde', paid, 0, open);
      }

      if (open > 0) {
        openAppointments += 1;
        openAmountCents += open;
        addOpenItem(openItems, {
          id: appointment.id,
          date: appointment.start_time,
          customerName: appointment.customer_name || 'Kunde',
          customerEmail: appointment.customer_email || '',
          customerPhone: appointment.customer_phone || undefined,
          source: 'appointment',
          reference: appointment.booking_number || appointment.id.slice(0, 8),
          status: appointment.status,
          totalCents: total,
          paidCents: paid,
          openCents: open,
        });
        addCustomer(customerMap, appointment.customer_email || appointment.id, appointment.customer_name || appointment.customer_email || 'Kunde', 0, 0, open);
      }

      const staffLabel = appointment.staff?.display_name || 'Nicht zugewiesen';
      addBreakdown(employeeMap, appointment.staff?.id || staffLabel, staffLabel, paid > 0 ? 1 : 0, paid, 0, open);

      for (const service of appointment.appointment_services || []) {
        const label = service.service_name || 'Leistung';
        addBreakdown(productMap, service.service_id || label, label, paid > 0 ? 1 : 0, paid > 0 ? positiveCents(service.price_cents) : 0, 0, 0);
      }

      return {
        id: appointment.id,
        date: paidDate,
        customerName: appointment.customer_name || 'Kunde',
        customerEmail: appointment.customer_email || '',
        source: 'appointment' as const,
        reference: appointment.booking_number || appointment.id.slice(0, 8),
        method,
        status: paid >= total && total > 0 ? 'succeeded' : open > 0 && paid > 0 ? 'partially_paid' : open > 0 ? 'open' : appointment.status,
        grossCents: paid,
        refundCents: 0,
        netCents: paid,
        staffName: staffLabel,
        note: appointment.status,
      };
    });

  for (const refund of input.refunds.filter((item) => matchesRefundFilters(item, filters, periodStart, periodEnd))) {
    const amount = positiveCents(refund.amount_cents);
    totalRefundsCents += amount;
    addDailyRefund(dailySales, refund.succeeded_at || refund.created_at, amount);
    refunds.push({
      id: refund.id,
      date: refund.succeeded_at || refund.created_at,
      customerName: 'Unbekannt',
      source: normalizeRefundSource(refund.payments?.reference_type),
      reference: refund.payments?.reference_id?.slice(0, 8) || refund.id.slice(0, 8),
      method: refund.payments?.payment_method || 'manual_adjustment',
      status: refund.status,
      amountCents: amount,
      reason: refund.reason || undefined,
    });
  }

  transactions.push(...orderRows.filter((row) => row.grossCents > 0 || row.refundCents > 0));
  transactions.push(...appointmentRows.filter((row) => row.grossCents > 0));
  transactions.sort((a, b) => b.date.localeCompare(a.date));
  openItems.sort((a, b) => b.date.localeCompare(a.date));
  refunds.sort((a, b) => b.date.localeCompare(a.date));

  const paidRevenueCents = shopRevenueCents + appointmentRevenueCents;
  const netRevenueCents = Math.max(0, paidRevenueCents - totalRefundsCents);
  const vatCents = Math.round(netRevenueCents * (vatRate / (100 + vatRate)));
  const netBeforeVatCents = netRevenueCents - vatCents;
  const dailySalesRows = Array.from(dailySales.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    filters,
    stats: {
      periodStart,
      periodEnd,
      salonName: salon.name || 'Salon',
      currency: salon.currency || DEFAULT_CURRENCY,
      timezone: salon.timezone || DEFAULT_TIMEZONE,
      grossRevenueCents: paidRevenueCents,
      paidRevenueCents,
      openAmountCents,
      shopRevenueCents,
      appointmentRevenueCents,
      totalRefundsCents,
      netRevenueCents,
      vatCents,
      netBeforeVatCents,
      vatRate,
      totalOrders: orderRows.length,
      paidOrders,
      openOrders,
      totalAppointments: appointmentRows.length,
      paidAppointments,
      openAppointments,
      paymentCount,
      averagePaymentCents: paymentCount > 0 ? Math.round(paidRevenueCents / paymentCount) : 0,
      failedAmountCents,
    },
    paymentMethods: Array.from(methodMap.values()).sort((a, b) => b.totalCents - a.totalCents),
    vatSummary: {
      grossCents: netRevenueCents,
      netCents: netBeforeVatCents,
      vatCents,
      vatRate,
    },
    dailySales: dailySalesRows,
    transactions,
    openItems,
    refunds,
    orderRows,
    appointmentRows,
    productBreakdown: sortedBreakdown(productMap),
    employeeBreakdown: sortedBreakdown(employeeMap),
    customerBreakdown: sortedBreakdown(customerMap),
  };
}

async function getSalonContext(supabase: DbClient, salonId: string): Promise<SalonRow> {
  const { data } = await supabase
    .from('salons')
    .select('name, timezone, currency, default_vat_rate')
    .eq('id', salonId)
    .maybeSingle();

  return {
    name: data?.name || 'Salon',
    timezone: data?.timezone || DEFAULT_TIMEZONE,
    currency: data?.currency || DEFAULT_CURRENCY,
    default_vat_rate: data?.default_vat_rate ?? 8.1,
  };
}

async function fetchOrders(supabase: DbClient, salonId: string, from: string, to: string): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      payment_status,
      payment_method,
      total_cents,
      tax_cents,
      refunded_amount_cents,
      created_at,
      paid_at,
      refunded_at,
      customer_name,
      customer_email,
      customer_phone,
      order_items (
        product_id,
        item_name,
        quantity,
        total_cents
      )
    `)
    .eq('salon_id', salonId)
    .or(`created_at.gte.${from},paid_at.gte.${from},refunded_at.gte.${from}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Finance] Order query failed:', error);
    return [];
  }

  return ((data || []) as OrderRow[]).filter((order) =>
    isInRange(order.created_at, from, to) ||
    isInRange(order.paid_at, from, to) ||
    isInRange(order.refunded_at, from, to)
  );
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
      customer_name,
      customer_email,
      customer_phone,
      staff:staff_id (
        id,
        display_name
      ),
      appointment_services (
        service_id,
        service_name,
        price_cents
      )
    `)
    .eq('salon_id', salonId)
    .or(`start_time.gte.${from},paid_at.gte.${from}`)
    .order('start_time', { ascending: false });

  if (error) {
    console.error('[Finance] Appointment query failed:', error);
    return [];
  }

  return ((data || []) as AppointmentRow[]).filter((appointment) =>
    isInRange(appointment.start_time, from, to) ||
    isInRange(appointment.paid_at, from, to)
  );
}

async function fetchRefunds(supabase: DbClient, salonId: string, from: string, to: string): Promise<RefundRow[]> {
  const { data, error } = await supabase
    .from('refunds')
    .select(`
      id,
      amount_cents,
      status,
      reason,
      created_at,
      succeeded_at,
      payments:payment_id (
        reference_type,
        reference_id,
        payment_method
      )
    `)
    .eq('salon_id', salonId)
    .eq('status', 'succeeded')
    .or(`created_at.gte.${from},succeeded_at.gte.${from}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Finance] Refund query failed:', error);
    return [];
  }

  return ((data || []) as RefundRow[]).filter((refund) =>
    isInRange(refund.created_at, from, to) ||
    isInRange(refund.succeeded_at, from, to)
  );
}

function getFinancePeriodRange(filters: FinanceFilters, timezone: string): { periodStart: string; periodEnd: string } {
  const today = getZonedDateOnly(new Date(), timezone);
  let startDate = today;
  let endDate = today;

  if (filters.period === 'custom' && isDateOnly(filters.startDate) && isDateOnly(filters.endDate)) {
    startDate = filters.startDate!;
    endDate = filters.endDate!;
    if (startDate > endDate) {
      [startDate, endDate] = [endDate, startDate];
    }
  } else if (filters.period === 'week') {
    startDate = addDays(today, -6);
  } else if (filters.period === 'quarter') {
    const [year, month] = today.split('-').map(Number);
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    startDate = `${year}-${String(quarterStartMonth).padStart(2, '0')}-01`;
  } else if (filters.period === 'year') {
    startDate = `${today.slice(0, 4)}-01-01`;
  } else {
    startDate = `${today.slice(0, 7)}-01`;
  }

  return {
    periodStart: zonedDateTimeToUtcIso(startDate, '00:00:00.000', timezone),
    periodEnd: zonedDateTimeToUtcIso(endDate, '23:59:59.999', timezone),
  };
}

function matchesOrderFilters(order: OrderRow, filters: FinanceFilters, from: string, to: string): boolean {
  if (!matchesMethod(order.payment_method, filters.paymentMethod)) return false;

  if (filters.paymentState === 'paid') return PAID_ORDER_PAYMENT_STATUSES.has(order.payment_status || '') && isInRange(order.paid_at || order.created_at, from, to);
  if (filters.paymentState === 'open') return OPEN_ORDER_PAYMENT_STATUSES.has(order.payment_status || '') && !EXCLUDED_ORDER_STATUSES.has(order.status);
  if (filters.paymentState === 'refunded') return getOrderRefundCents(order) > 0;
  if (filters.paymentState === 'failed') return FAILED_ORDER_PAYMENT_STATUSES.has(order.payment_status || '');

  return true;
}

function matchesAppointmentFilters(appointment: AppointmentRow, filters: FinanceFilters, from: string, to: string): boolean {
  if (!matchesMethod(appointment.payment_method, filters.paymentMethod)) return false;

  const total = positiveCents(appointment.total_cents);
  const paid = Math.min(total, positiveCents(appointment.paid_amount_cents));
  const open = !EXCLUDED_APPOINTMENT_STATUSES.has(appointment.status) && total > paid;

  if (filters.paymentState === 'paid') return paid > 0 && !!appointment.paid_at && isInRange(appointment.paid_at, from, to);
  if (filters.paymentState === 'open') return open;
  if (filters.paymentState === 'refunded') return false;
  if (filters.paymentState === 'failed') return false;

  return true;
}

function matchesRefundFilters(refund: RefundRow, filters: FinanceFilters, from: string, to: string): boolean {
  if (filters.paymentState !== 'all' && filters.paymentState !== 'refunded') return false;
  if (!matchesMethod(refund.payments?.payment_method, filters.paymentMethod)) return false;
  if (filters.source === 'shop' && refund.payments?.reference_type !== 'order') return false;
  if (filters.source === 'salon' && refund.payments?.reference_type !== 'appointment') return false;
  return isInRange(refund.succeeded_at || refund.created_at, from, to);
}

function matchesMethod(method: string | null | undefined, filter: FinancePaymentMethod): boolean {
  if (filter === 'all') return true;
  return (method || 'pay_at_venue') === filter;
}

function getOrderRefundCents(order: OrderRow): number {
  const recorded = positiveCents(order.refunded_amount_cents);
  if (recorded > 0) return Math.min(recorded, positiveCents(order.total_cents));
  if (order.payment_status === 'refunded') return positiveCents(order.total_cents);
  return 0;
}

function normalizeRefundSource(referenceType?: string | null): 'shop' | 'appointment' | 'payment' {
  if (referenceType === 'order') return 'shop';
  if (referenceType === 'appointment' || referenceType === 'deposit') return 'appointment';
  return 'payment';
}

function addMethod(map: Map<string, PaymentMethodStats>, method: string, count: number, totalCents: number) {
  const key = method || 'unknown';
  const existing = map.get(key);
  if (existing) {
    existing.count += count;
    existing.totalCents += totalCents;
    return;
  }
  map.set(key, { method: key, count, totalCents });
}

function addDailyRevenue(map: Map<string, DailySales>, dateValue: string, source: 'shop' | 'appointment', amount: number) {
  const key = toDateKey(dateValue);
  const row = map.get(key);
  if (!row) return;
  if (source === 'shop') {
    row.orderCount += 1;
    row.orderRevenue += amount;
  } else {
    row.appointmentCount += 1;
    row.appointmentRevenue += amount;
  }
  row.totalRevenue += amount;
}

function addDailyRefund(map: Map<string, DailySales>, dateValue: string, amount: number) {
  const key = toDateKey(dateValue);
  const row = map.get(key);
  if (!row) return;
  row.refundAmount += amount;
  row.totalRevenue -= amount;
}

function addOpenItem(items: FinanceOpenItem[], item: FinanceOpenItem) {
  items.push(item);
}

function addBreakdown(map: Map<string, FinanceBreakdownRow>, id: string, label: string, count: number, gross: number, refund: number, open: number) {
  const existing = map.get(id);
  if (existing) {
    existing.count += count;
    existing.grossCents += gross;
    existing.refundCents += refund;
    existing.openCents += open;
    existing.netCents += Math.max(0, gross - refund);
    return;
  }
  map.set(id, {
    id,
    label,
    count,
    grossCents: gross,
    refundCents: refund,
    openCents: open,
    netCents: Math.max(0, gross - refund),
  });
}

function addCustomer(map: Map<string, FinanceBreakdownRow>, id: string, label: string, gross: number, refund: number, open: number) {
  addBreakdown(map, id, label, gross > 0 ? 1 : 0, gross, refund, open);
}

function sortedBreakdown(map: Map<string, FinanceBreakdownRow>): FinanceBreakdownRow[] {
  return Array.from(map.values())
    .sort((a, b) => b.netCents - a.netCents || b.openCents - a.openCents)
    .slice(0, 100);
}

function createDailySalesMap(from: string, to: string, timezone: string): Map<string, DailySales> {
  const map = new Map<string, DailySales>();
  let current = toDateKey(from, timezone);
  const end = toDateKey(to, timezone);

  while (current <= end) {
    map.set(current, {
      date: current,
      orderCount: 0,
      appointmentCount: 0,
      orderRevenue: 0,
      appointmentRevenue: 0,
      refundAmount: 0,
      totalRevenue: 0,
    });
    current = addDays(current, 1);
  }

  return map;
}

function positiveCents(value: number | null | undefined): number {
  return Math.max(0, Math.round(Number(value || 0)));
}

function normalizeVatRate(value: number | string | null | undefined): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 8.1;
  return numeric <= 1 ? numeric * 100 : numeric;
}

export function isInRange(value: string | null | undefined, from: string, to: string): boolean {
  if (!value) return false;
  return value >= from && value <= to;
}

function isDateOnly(value?: string): boolean {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isFinancePeriod(value: unknown): value is FinancePeriod {
  return value === 'week' || value === 'month' || value === 'quarter' || value === 'year' || value === 'custom';
}

function isFinancePaymentState(value: unknown): value is FinancePaymentState {
  return value === 'all' || value === 'paid' || value === 'open' || value === 'refunded' || value === 'failed';
}

function isFinancePaymentMethod(value: unknown): value is FinancePaymentMethod {
  return value === 'all' || value === 'stripe_card' || value === 'stripe_twint' || value === 'cash' || value === 'terminal' || value === 'voucher' || value === 'manual_adjustment' || value === 'pay_at_venue';
}

function toDateKey(value: string, timezone = DEFAULT_TIMEZONE): string {
  return getZonedDateOnly(new Date(value), timezone);
}

function getZonedDateOnly(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
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
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function zonedDateTimeToUtcIso(dateOnly: string, time: string, timezone: string): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const [hour, minute, secondPart] = time.split(':');
  const [second, millisecond = '0'] = secondPart.split('.');
  const utcGuess = new Date(Date.UTC(year, month - 1, day, Number(hour), Number(minute), Number(second), Number(millisecond)));

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utcGuess);

  const zonedAsUtc = Date.UTC(
    Number(parts.find((part) => part.type === 'year')?.value),
    Number(parts.find((part) => part.type === 'month')?.value) - 1,
    Number(parts.find((part) => part.type === 'day')?.value),
    Number(parts.find((part) => part.type === 'hour')?.value),
    Number(parts.find((part) => part.type === 'minute')?.value),
    Number(parts.find((part) => part.type === 'second')?.value),
    Number(millisecond)
  );

  return new Date(utcGuess.getTime() - (zonedAsUtc - utcGuess.getTime())).toISOString();
}
