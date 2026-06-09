import { BaseService, ServiceResult, ServiceListResult } from './base';
import type {
  Payment,
  Refund,
  PaymentMethod,
  PaymentStatus,
  Database,
} from '../db/types';
import { OrderService } from './orders';
import { logger } from '../logging/logger';

// ============================================
// TYPES
// ============================================

interface PaymentWithOrder extends Payment {
  order?: {
    id: string;
    order_number: string;
    total_cents: number;
  };
}

interface CreatePaymentParams {
  orderId: string;
  salonId: string;
  customerId?: string;
  amountCents: number;
  method: PaymentMethod;
  stripePaymentIntentId?: string;
  stripeSessionId?: string;
  notes?: string;
}

interface RefundParams {
  paymentId: string;
  amountCents: number;
  reason: string;
  refundedBy: string;
  stripeRefundId?: string;
}

// ============================================
// PAYMENT SERVICE
// ============================================

class PaymentServiceClass extends BaseService<'payments'> {
  constructor() {
    super('payments');
  }

  // Get payment with order details
  async findWithOrder(paymentId: string): Promise<ServiceResult<PaymentWithOrder>> {
    const { data, error } = await this.client
      .from('payments')
      .select(`
        *,
        order:orders (id, order_number, total_cents)
      `)
      .eq('id', paymentId)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: data as PaymentWithOrder, error: null };
  }

  // Get payments for salon
  async findBySalon(
    salonId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      status?: PaymentStatus[];
      method?: PaymentMethod[];
      page?: number;
      pageSize?: number;
    }
  ): Promise<ServiceListResult<PaymentWithOrder>> {
    const { startDate, endDate, status, method, page = 1, pageSize = 20 } =
      options || {};

    let query = this.client
      .from('payments')
      .select(
        `
        *,
        order:orders (id, order_number, total_cents)
      `,
        { count: 'exact' }
      )
      .eq('salon_id', salonId);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    if (status && status.length > 0) {
      query = query.in('status', status);
    }

    if (method && method.length > 0) {
      query = query.in('payment_method', method);
    }

    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: (data || []) as PaymentWithOrder[], count, error: null };
  }

  // Get payment by Stripe intent ID
  async findByStripeIntent(intentId: string): Promise<ServiceResult<Payment>> {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', intentId)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data, error: null };
  }

  // Create payment
  async createPayment(params: CreatePaymentParams): Promise<ServiceResult<Payment>> {
    const {
      orderId,
      salonId,
      customerId,
      amountCents,
      method,
      stripePaymentIntentId,
      stripeSessionId,
      notes,
    } = params;

    // Determine initial status based on method
    let initialStatus: PaymentStatus = 'pending';
    if (method === 'cash' || method === 'invoice') {
      initialStatus = 'pending';
    }

    const { data, error } = await this.client
      .from('payments')
      .insert({
        order_id: orderId,
        salon_id: salonId,
        customer_id: customerId || null,
        amount_cents: amountCents,
        currency: 'CHF',
        payment_method: method,
        status: initialStatus,
        stripe_payment_intent_id: stripePaymentIntentId || null,
        stripe_session_id: stripeSessionId || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data, error: null };
  }

  // Confirm payment (mark as succeeded)
  async confirm(
    paymentId: string,
    processedBy?: string
  ): Promise<ServiceResult<Payment>> {
    const result = await this.update(paymentId, {
      status: 'succeeded',
      processed_at: new Date().toISOString(),
      processed_by: processedBy || null,
    });

    if (result.data) {
      // Update order status
      await OrderService.markPaid(
        result.data.order_id,
        result.data.payment_method,
        paymentId
      );

      logger.info('Payment confirmed', {
        paymentId,
        orderId: result.data.order_id,
        amount: result.data.amount_cents,
      });
    }

    return result;
  }

  // Mark payment as failed
  async fail(
    paymentId: string,
    failureReason: string,
    stripeError?: string
  ): Promise<ServiceResult<Payment>> {
    logger.warn('Payment failed', {
      paymentId,
      reason: failureReason,
      stripeError,
    });

    return this.update(paymentId, {
      status: 'failed',
      failure_reason: failureReason,
      stripe_error: stripeError || null,
    });
  }

  // Process cash payment
  async processCashPayment(
    orderId: string,
    salonId: string,
    amountCents: number,
    processedBy: string
  ): Promise<ServiceResult<Payment>> {
    const payment = await this.createPayment({
      orderId,
      salonId,
      amountCents,
      method: 'cash',
    });

    if (!payment.data) {
      return payment;
    }

    return this.confirm(payment.data.id, processedBy);
  }

  // Process card payment (in-person)
  async processCardPayment(
    orderId: string,
    salonId: string,
    amountCents: number,
    processedBy: string
  ): Promise<ServiceResult<Payment>> {
    const payment = await this.createPayment({
      orderId,
      salonId,
      amountCents,
      method: 'card',
    });

    if (!payment.data) {
      return payment;
    }

    return this.confirm(payment.data.id, processedBy);
  }

  // Create refund
  async createRefund(params: RefundParams): Promise<ServiceResult<Refund>> {
    const {
      paymentId,
      amountCents,
      reason,
      refundedBy,
      stripeRefundId,
    } = params;

    // Get payment
    const { data: payment } = await this.findById(paymentId);
    if (!payment) {
      return {
        data: null,
        error: { code: 'NOT_FOUND', message: 'Zahlung nicht gefunden.' },
      };
    }

    // Check if refund amount is valid
    const existingRefunds = await this.getRefundsForPayment(paymentId);
    const totalRefunded = existingRefunds.data.reduce(
      (sum, r) => sum + r.amount_cents,
      0
    );

    if (totalRefunded + amountCents > payment.amount_cents) {
      return {
        data: null,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Rückerstattungsbetrag übersteigt die Zahlung.',
        },
      };
    }

    // Create refund record
    const { data: refund, error } = await this.client
      .from('refunds')
      .insert({
        payment_id: paymentId,
        order_id: payment.order_id,
        salon_id: payment.salon_id,
        amount_cents: amountCents,
        currency: 'CHF',
        reason,
        status: stripeRefundId ? 'completed' : 'pending',
        stripe_refund_id: stripeRefundId || null,
        refunded_by: refundedBy,
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    // Update payment refunded amount
    const newTotalRefunded = totalRefunded + amountCents;
    const isFullyRefunded = newTotalRefunded >= payment.amount_cents;

    await this.update(paymentId, {
      refunded_cents: newTotalRefunded,
      status: isFullyRefunded ? 'refunded' : payment.status,
    });

    // Update order refunded amount
    await OrderService.refund(payment.order_id, amountCents, reason);

    logger.info('Refund created', {
      refundId: refund.id,
      paymentId,
      amount: amountCents,
    });

    return { data: refund, error: null };
  }

  // Get refunds for payment
  async getRefundsForPayment(paymentId: string): Promise<ServiceListResult<Refund>> {
    const { data, error, count } = await this.client
      .from('refunds')
      .select('*', { count: 'exact' })
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: data || [], count, error: null };
  }

  // Get today's payments
  async findToday(salonId: string): Promise<ServiceListResult<Payment>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error, count } = await this.client
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('salon_id', salonId)
      .eq('status', 'succeeded')
      .gte('processed_at', today.toISOString())
      .lt('processed_at', tomorrow.toISOString());

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: data || [], count, error: null };
  }

  // Get payment statistics
  async getStats(
    salonId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalPayments: number;
    totalAmount: number;
    byMethod: Record<PaymentMethod, { count: number; amount: number }>;
    refundedAmount: number;
  }> {
    const { data: payments } = await this.client
      .from('payments')
      .select('amount_cents, payment_method, refunded_cents')
      .eq('salon_id', salonId)
      .eq('status', 'succeeded')
      .gte('processed_at', startDate.toISOString())
      .lte('processed_at', endDate.toISOString());

    if (!payments || payments.length === 0) {
      return {
        totalPayments: 0,
        totalAmount: 0,
        byMethod: {} as Record<PaymentMethod, { count: number; amount: number }>,
        refundedAmount: 0,
      };
    }

    const byMethod: Record<string, { count: number; amount: number }> = {};
    let totalAmount = 0;
    let refundedAmount = 0;

    for (const payment of payments) {
      totalAmount += payment.amount_cents;
      refundedAmount += payment.refunded_cents || 0;

      const method = payment.payment_method;
      if (!byMethod[method]) {
        byMethod[method] = { count: 0, amount: 0 };
      }
      byMethod[method].count++;
      byMethod[method].amount += payment.amount_cents;
    }

    return {
      totalPayments: payments.length,
      totalAmount,
      byMethod: byMethod as Record<PaymentMethod, { count: number; amount: number }>,
      refundedAmount,
    };
  }

  // Log Stripe webhook
  async logWebhook(
    eventType: string,
    eventId: string,
    payload: Record<string, unknown>,
    processed: boolean = false,
    error?: string
  ): Promise<void> {
    await this.client.from('stripe_webhooks_log').insert({
      event_type: eventType,
      event_id: eventId,
      payload,
      processed,
      error: error || null,
    });
  }

  // Record daily sales
  async recordDailySales(salonId: string, date: Date): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all successful payments for the day
    const { data: payments } = await this.client
      .from('payments')
      .select('amount_cents, payment_method, refunded_cents')
      .eq('salon_id', salonId)
      .eq('status', 'succeeded')
      .gte('processed_at', startOfDay.toISOString())
      .lte('processed_at', endOfDay.toISOString());

    if (!payments) return;

    let totalCash = 0;
    let totalCard = 0;
    let totalOnline = 0;
    let totalVoucher = 0;
    let totalRefunds = 0;

    for (const payment of payments) {
      const amount = payment.amount_cents;
      totalRefunds += payment.refunded_cents || 0;

      switch (payment.payment_method) {
        case 'cash':
          totalCash += amount;
          break;
        case 'card':
          totalCard += amount;
          break;
        case 'stripe':
        case 'twint':
          totalOnline += amount;
          break;
        case 'voucher':
          totalVoucher += amount;
          break;
      }
    }

    const totalGross = totalCash + totalCard + totalOnline + totalVoucher;
    const totalNet = totalGross - totalRefunds;

    // Upsert daily sales record
    await this.client.from('daily_sales').upsert(
      {
        salon_id: salonId,
        date: startOfDay.toISOString().split('T')[0],
        total_gross_cents: totalGross,
        total_net_cents: totalNet,
        cash_cents: totalCash,
        card_cents: totalCard,
        online_cents: totalOnline,
        voucher_cents: totalVoucher,
        refunds_cents: totalRefunds,
        transaction_count: payments.length,
      },
      { onConflict: 'salon_id,date' }
    );
  }
}

// Export singleton instance
export const PaymentService = new PaymentServiceClass();
