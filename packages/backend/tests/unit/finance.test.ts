import { describe, expect, it } from 'vitest';
import { buildFinanceData, normalizeFinanceFilters } from '@/lib/domain/finance';

const baseInput = {
  filters: normalizeFinanceFilters({ period: 'custom', startDate: '2026-06-01', endDate: '2026-06-30', source: 'all' }),
  salon: {
    name: 'BeautifyPRO',
    timezone: 'Europe/Zurich',
    currency: 'CHF',
    default_vat_rate: 8.1,
  },
  periodStart: '2026-05-31T22:00:00.000Z',
  periodEnd: '2026-06-30T21:59:59.999Z',
};

describe('finance calculations', () => {
  it('counts paid shop revenue, subtracts refunds, and keeps open amounts separate', () => {
    const data = buildFinanceData({
      ...baseInput,
      orders: [
        {
          id: 'order-paid',
          order_number: 'SW-1',
          status: 'paid',
          payment_status: 'partially_refunded',
          payment_method: 'stripe_card',
          total_cents: 10000,
          tax_cents: 749,
          refunded_amount_cents: 2000,
          created_at: '2026-06-03T08:00:00.000Z',
          paid_at: '2026-06-03T08:05:00.000Z',
          refunded_at: '2026-06-04T08:00:00.000Z',
          customer_name: 'Mara Muster',
          customer_email: 'mara@example.com',
          customer_phone: '+410000000',
          order_items: [{ product_id: 'prod-1', item_name: 'Shampoo', quantity: 1, total_cents: 10000 }],
        },
        {
          id: 'order-open',
          order_number: 'SW-2',
          status: 'pending',
          payment_status: 'pending',
          payment_method: 'pay_at_venue',
          total_cents: 5000,
          tax_cents: 375,
          refunded_amount_cents: 0,
          created_at: '2026-06-05T08:00:00.000Z',
          paid_at: null,
          refunded_at: null,
          customer_name: 'Nora Offen',
          customer_email: 'nora@example.com',
          customer_phone: null,
          order_items: [],
        },
      ] as any,
      appointments: [],
      refunds: [],
    });

    expect(data.stats.paidRevenueCents).toBe(8000);
    expect(data.stats.totalRefundsCents).toBe(2000);
    expect(data.stats.netRevenueCents).toBe(6000);
    expect(data.stats.openAmountCents).toBe(5000);
    expect(data.openItems).toHaveLength(1);
    expect(data.refunds).toHaveLength(1);
  });

  it('treats unpaid completed appointments as open instead of paid revenue', () => {
    const data = buildFinanceData({
      ...baseInput,
      orders: [],
      appointments: [
        {
          id: 'appointment-1',
          booking_number: 'B-1',
          status: 'completed',
          start_time: '2026-06-07T09:00:00.000Z',
          total_cents: 9000,
          paid_amount_cents: 0,
          paid_at: null,
          payment_method: 'cash',
          customer_name: 'Lea Test',
          customer_email: 'lea@example.com',
          customer_phone: null,
          staff: { id: 'staff-1', display_name: 'Alex' },
          appointment_services: [{ service_id: 'service-1', service_name: 'Schnitt', price_cents: 9000 }],
        },
      ] as any,
      refunds: [],
    });

    expect(data.stats.appointmentRevenueCents).toBe(0);
    expect(data.stats.openAmountCents).toBe(9000);
    expect(data.stats.openAppointments).toBe(1);
  });

  it('applies the open payment filter to shop and appointment rows', () => {
    const data = buildFinanceData({
      ...baseInput,
      filters: normalizeFinanceFilters({ period: 'custom', startDate: '2026-06-01', endDate: '2026-06-30', source: 'all', paymentState: 'open' }),
      orders: [
        {
          id: 'order-paid',
          order_number: 'SW-1',
          status: 'paid',
          payment_status: 'succeeded',
          payment_method: 'stripe_card',
          total_cents: 10000,
          tax_cents: 749,
          refunded_amount_cents: 0,
          created_at: '2026-06-03T08:00:00.000Z',
          paid_at: '2026-06-03T08:05:00.000Z',
          refunded_at: null,
          customer_name: 'Mara Muster',
          customer_email: 'mara@example.com',
          customer_phone: null,
          order_items: [],
        },
        {
          id: 'order-open',
          order_number: 'SW-2',
          status: 'pending',
          payment_status: 'pending',
          payment_method: 'pay_at_venue',
          total_cents: 5000,
          tax_cents: 375,
          refunded_amount_cents: 0,
          created_at: '2026-06-05T08:00:00.000Z',
          paid_at: null,
          refunded_at: null,
          customer_name: 'Nora Offen',
          customer_email: 'nora@example.com',
          customer_phone: null,
          order_items: [],
        },
      ] as any,
      appointments: [],
      refunds: [],
    });

    expect(data.stats.paidRevenueCents).toBe(0);
    expect(data.stats.openAmountCents).toBe(5000);
    expect(data.stats.totalOrders).toBe(1);
  });
});
