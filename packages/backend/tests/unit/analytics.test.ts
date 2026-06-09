import { describe, expect, it } from 'vitest';
import { buildAnalyticsData, normalizeAnalyticsFilters } from '@/lib/domain/analytics';
import { buildFinanceData, normalizeFinanceFilters } from '@/lib/domain/finance';

const salon = {
  name: 'BeautifyPRO',
  timezone: 'Europe/Zurich',
  currency: 'CHF',
  default_vat_rate: 8.1,
};

const periodStart = '2026-05-31T22:00:00.000Z';
const periodEnd = '2026-06-30T21:59:59.999Z';

function makeFinanceData({ orders = [], appointments = [] }: { orders?: any[]; appointments?: any[] }) {
  return buildFinanceData({
    filters: normalizeFinanceFilters({ period: 'custom', startDate: '2026-06-01', endDate: '2026-06-30', source: 'all' }),
    salon,
    periodStart,
    periodEnd,
    orders,
    appointments,
    refunds: [],
  });
}

describe('analytics calculations', () => {
  it('uses finance revenue rules and keeps open appointment amounts separate', () => {
    const appointment = {
      id: 'appointment-open',
      booking_number: 'B-1',
      status: 'completed',
      start_time: '2026-06-07T09:00:00.000Z',
      total_cents: 9000,
      paid_amount_cents: 0,
      paid_at: null,
      payment_method: 'cash',
      customer_name: 'Lea Test',
      customer_email: 'lea@example.com',
      customer_phone: '',
      staff: { id: 'staff-1', display_name: 'Alex' },
      appointment_services: [{ service_id: 'service-1', service_name: 'Schnitt', price_cents: 9000 }],
    };
    const finance = makeFinanceData({ appointments: [appointment] });

    const data = buildAnalyticsData({
      filters: normalizeAnalyticsFilters({ period: 'custom', startDate: '2026-06-01', endDate: '2026-06-30' }),
      finance,
      appointments: [appointment],
      orders: [],
      customers: [],
      previousFinance: null,
      previousCustomers: null,
    });

    expect(data.kpis.netRevenueCents).toBe(0);
    expect(data.kpis.openAmountCents).toBe(9000);
    expect(data.kpis.completedAppointments).toBe(1);
    expect(data.topServices[0].revenueCents).toBe(0);
  });

  it('does not count cancelled appointments as service bookings', () => {
    const cancelled = {
      id: 'appointment-cancelled',
      booking_number: 'B-2',
      status: 'cancelled',
      start_time: '2026-06-08T09:00:00.000Z',
      total_cents: 12000,
      paid_amount_cents: 0,
      paid_at: null,
      payment_method: 'cash',
      customer_name: 'Mara Muster',
      customer_email: 'mara@example.com',
      customer_phone: '',
      staff: { id: 'staff-1', display_name: 'Alex' },
      appointment_services: [{ service_id: 'service-1', service_name: 'Farbe', price_cents: 12000 }],
    };
    const finance = makeFinanceData({ appointments: [cancelled] });

    const data = buildAnalyticsData({
      filters: normalizeAnalyticsFilters({ period: 'custom', startDate: '2026-06-01', endDate: '2026-06-30' }),
      finance,
      appointments: [cancelled],
      orders: [],
      customers: [],
      previousFinance: null,
      previousCustomers: null,
    });

    expect(data.kpis.cancelledAppointments).toBe(1);
    expect(data.topServices).toHaveLength(0);
  });

  it('classifies active customers as new or returning within the period', () => {
    const paidAppointment = {
      id: 'appointment-paid',
      booking_number: 'B-3',
      status: 'completed',
      start_time: '2026-06-09T09:00:00.000Z',
      total_cents: 8000,
      paid_amount_cents: 8000,
      paid_at: '2026-06-09T10:00:00.000Z',
      payment_method: 'cash',
      customer_name: 'Nina Neu',
      customer_email: 'nina@example.com',
      customer_phone: '',
      customers: {
        id: 'customer-new',
        first_name: 'Nina',
        last_name: 'Neu',
        email: 'nina@example.com',
        phone: '',
        created_at: '2026-06-01T08:00:00.000Z',
      },
      staff: { id: 'staff-1', display_name: 'Alex' },
      appointment_services: [{ service_id: 'service-1', service_name: 'Schnitt', price_cents: 8000 }],
    };
    const finance = makeFinanceData({ appointments: [paidAppointment] });

    const data = buildAnalyticsData({
      filters: normalizeAnalyticsFilters({ period: 'custom', startDate: '2026-06-01', endDate: '2026-06-30' }),
      finance,
      appointments: [paidAppointment],
      orders: [],
      customers: [
        {
          id: 'customer-new',
          first_name: 'Nina',
          last_name: 'Neu',
          email: 'nina@example.com',
          phone: '',
          created_at: '2026-06-01T08:00:00.000Z',
        },
      ] as any,
      previousFinance: null,
      previousCustomers: null,
    });

    expect(data.kpis.newCustomers).toBe(1);
    expect(data.kpis.returningCustomers).toBe(0);
    expect(data.topCustomers[0].customerType).toBe('new');
  });
});
