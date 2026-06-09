/**
 * BeautifyPRO - Deposit Service
 * Handle appointment deposits and refunds
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';
import { getPaymentProvider } from '@/lib/payments';

// ============================================
// TYPES
// ============================================

export type DepositStatus =
  | 'pending'
  | 'paid'
  | 'applied'
  | 'refunded'
  | 'forfeited'
  | 'cancelled';

export interface AppointmentDeposit {
  id: string;
  appointmentId: string;
  salonId: string;
  customerId: string;
  amountCents: number;
  currency: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  status: DepositStatus;
  refundAmountCents: number | null;
  refundReason: string | null;
  refundedAt: Date | null;
  paidAt: Date | null;
  appliedAt: Date | null;
  forfeitedAt: Date | null;
  createdAt: Date;
}

export interface DepositWithDetails extends AppointmentDeposit {
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  serviceName: string;
  appointmentStartsAt: Date;
  hoursUntilAppointment: number;
}

export interface DepositPolicy {
  id: string;
  salonId: string;
  name: string;
  description: string | null;
  defaultType: 'fixed' | 'percentage';
  defaultAmount: number;
  minServicePriceCents: number;
  fullRefundHours: number;
  partialRefundHours: number;
  partialRefundPercent: number;
  noShowForfeit: boolean;
  isActive: boolean;
}

export interface RefundResult {
  success: boolean;
  refundAmount: number;
  message: string;
}

// ============================================
// DEPOSIT SERVICE
// ============================================

export class DepositService {
  private get supabase() {
    return createServiceRoleClient();
  }

  /**
   * Calculate deposit amount for a service
   */
  async calculateDepositAmount(
    serviceId: string,
    servicePriceCents?: number
  ): Promise<number> {
    const { data, error } = await this.supabase.rpc('calculate_deposit_amount', {
      p_service_id: serviceId,
      p_service_price_cents: servicePriceCents || null,
    });

    if (error) {
      logger.error('Failed to calculate deposit amount', error);
      return 0;
    }

    return data as number;
  }

  /**
   * Check if service requires deposit
   */
  async requiresDeposit(serviceId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('services')
      .select('deposit_required')
      .eq('id', serviceId)
      .single();

    return data?.deposit_required || false;
  }

  /**
   * Create a deposit for an appointment
   */
  async createDeposit(
    appointmentId: string,
    stripePaymentIntentId?: string
  ): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('create_appointment_deposit', {
      p_appointment_id: appointmentId,
      p_stripe_payment_intent_id: stripePaymentIntentId || null,
    });

    if (error) {
      logger.error('Failed to create deposit', error, { appointmentId });
      return null;
    }

    logger.info('Deposit created', { appointmentId, depositId: data });
    return data as string;
  }

  /**
   * Create Stripe payment intent for deposit
   */
  async createDepositPaymentIntent(
    appointmentId: string,
    customerId: string,
    amountCents: number
  ): Promise<{ clientSecret: string; paymentIntentId: string } | null> {
    try {
      // Get customer's Stripe customer ID
      const { data: customer } = await this.supabase
        .from('customers')
        .select('stripe_customer_id, email')
        .eq('id', customerId)
        .single();

      const provider = getPaymentProvider();
      const { data: paymentIntent, error } = await provider.createPaymentIntent({
        amountCents,
        currency: 'chf',
        orderId: appointmentId,
        salonId: '',
        customerId,
        stripeCustomerId: customer?.stripe_customer_id || undefined,
        receiptEmail: customer?.email,
        metadata: {
          type: 'deposit',
          appointment_id: appointmentId,
          customer_id: customerId,
        },
      });

      if (error || !paymentIntent) {
        logger.error('Failed to create deposit payment intent via provider', undefined, { error: error ?? undefined });
        return null;
      }

      // Update deposit with payment intent ID
      await this.supabase
        .from('appointment_deposits')
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq('appointment_id', appointmentId);

      logger.info('Deposit payment intent created', {
        appointmentId,
        paymentIntentId: paymentIntent.id,
        amountCents,
      });

      return {
        clientSecret: paymentIntent.clientSecret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      logger.error('Failed to create deposit payment intent', error as Error);
      return null;
    }
  }

  /**
   * Mark deposit as paid (called from webhook)
   */
  async markDepositPaid(
    depositIdOrPaymentIntentId: string,
    stripeChargeId?: string
  ): Promise<boolean> {
    // Try by deposit ID first
    let query = this.supabase
      .from('appointment_deposits')
      .update({
        status: 'paid',
        stripe_charge_id: stripeChargeId,
        paid_at: new Date().toISOString(),
      })
      .eq('status', 'pending');

    // Check if it's a payment intent ID
    if (depositIdOrPaymentIntentId.startsWith('pi_')) {
      query = query.eq('stripe_payment_intent_id', depositIdOrPaymentIntentId);
    } else {
      query = query.eq('id', depositIdOrPaymentIntentId);
    }

    const { error } = await query;

    if (error) {
      logger.error('Failed to mark deposit as paid', error);
      return false;
    }

    logger.info('Deposit marked as paid', { id: depositIdOrPaymentIntentId });
    return true;
  }

  /**
   * Get deposit by appointment ID
   */
  async getDepositByAppointment(appointmentId: string): Promise<AppointmentDeposit | null> {
    const { data, error } = await this.supabase
      .from('appointment_deposits')
      .select('*')
      .eq('appointment_id', appointmentId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        logger.error('Failed to get deposit', error);
      }
      return null;
    }

    return this.mapDeposit(data);
  }

  /**
   * Check if deposit is refundable
   */
  async checkRefundability(appointmentId: string): Promise<RefundResult> {
    const { data, error } = await this.supabase.rpc('is_deposit_refundable', {
      p_appointment_id: appointmentId,
    });

    if (error || !data || data.length === 0) {
      return { success: false, refundAmount: 0, message: 'Error checking refundability' };
    }

    const result = data[0];
    return {
      success: result.refundable,
      refundAmount: result.refund_percent,
      message: result.reason,
    };
  }

  /**
   * Process deposit refund
   */
  async processRefund(
    appointmentId: string,
    reason: string = 'Customer cancellation'
  ): Promise<RefundResult> {
    // First check with database function
    const { data, error } = await this.supabase.rpc('process_deposit_refund', {
      p_appointment_id: appointmentId,
      p_reason: reason,
    });

    if (error || !data || data.length === 0) {
      logger.error('Failed to process deposit refund', error);
      return { success: false, refundAmount: 0, message: 'Error processing refund' };
    }

    const result = data[0];

    // If refund was approved, process through payment provider
    if (result.success && result.refund_amount > 0) {
      const deposit = await this.getDepositByAppointment(appointmentId);
      if (deposit?.stripeChargeId) {
        try {
          const provider = getPaymentProvider();
          await provider.createRefund({
            paymentIntentId: deposit.stripePaymentIntentId || '',
            chargeId: deposit.stripeChargeId,
            amountCents: result.refund_amount,
            reason: 'requested_by_customer',
            metadata: {
              appointment_id: appointmentId,
              reason,
            },
          });

          logger.info('Payment refund processed', {
            appointmentId,
            refundAmount: result.refund_amount,
          });
        } catch (refundError) {
          logger.error('Payment refund failed', refundError as Error);
          // Still return success from DB side
        }
      }
    }

    return {
      success: result.success,
      refundAmount: result.refund_amount,
      message: result.message,
    };
  }

  /**
   * Apply deposit to final payment
   */
  async applyDepositToPayment(
    appointmentId: string,
    orderId?: string
  ): Promise<number> {
    const { data, error } = await this.supabase.rpc('apply_deposit_to_payment', {
      p_appointment_id: appointmentId,
      p_order_id: orderId || null,
    });

    if (error) {
      logger.error('Failed to apply deposit', error);
      return 0;
    }

    const appliedAmount = data as number;
    if (appliedAmount > 0) {
      logger.info('Deposit applied to payment', { appointmentId, appliedAmount });
    }

    return appliedAmount;
  }

  /**
   * Forfeit deposit (no-show)
   */
  async forfeitDeposit(appointmentId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('appointment_deposits')
      .update({
        status: 'forfeited',
        forfeited_at: new Date().toISOString(),
      })
      .eq('appointment_id', appointmentId)
      .eq('status', 'paid');

    if (error) {
      logger.error('Failed to forfeit deposit', error);
      return false;
    }

    logger.info('Deposit forfeited', { appointmentId });
    return true;
  }

  /**
   * Get pending deposits for salon
   */
  async getPendingDeposits(salonId: string): Promise<DepositWithDetails[]> {
    const { data, error } = await this.supabase
      .from('v_pending_deposits')
      .select('*')
      .eq('salon_id', salonId)
      .order('appointment_starts_at', { ascending: true });

    if (error) {
      logger.error('Failed to get pending deposits', error);
      return [];
    }

    return (data || []).map(this.mapDepositWithDetails);
  }

  /**
   * Get deposit statistics for salon
   */
  async getDepositStats(
    salonId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalCollected: number;
    totalRefunded: number;
    totalForfeited: number;
    pendingCount: number;
    paidCount: number;
  }> {
    let query = this.supabase
      .from('appointment_deposits')
      .select('status, amount_cents, refund_amount_cents')
      .eq('salon_id', salonId);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error || !data) {
      return {
        totalCollected: 0,
        totalRefunded: 0,
        totalForfeited: 0,
        pendingCount: 0,
        paidCount: 0,
      };
    }

    return data.reduce(
      (acc, d) => ({
        totalCollected:
          acc.totalCollected +
          (['paid', 'applied', 'forfeited'].includes(d.status) ? d.amount_cents : 0),
        totalRefunded: acc.totalRefunded + (d.refund_amount_cents || 0),
        totalForfeited:
          acc.totalForfeited + (d.status === 'forfeited' ? d.amount_cents : 0),
        pendingCount: acc.pendingCount + (d.status === 'pending' ? 1 : 0),
        paidCount: acc.paidCount + (d.status === 'paid' ? 1 : 0),
      }),
      {
        totalCollected: 0,
        totalRefunded: 0,
        totalForfeited: 0,
        pendingCount: 0,
        paidCount: 0,
      }
    );
  }

  /**
   * Get or create deposit policy for salon
   */
  async getDepositPolicy(salonId: string): Promise<DepositPolicy | null> {
    const { data, error } = await this.supabase
      .from('deposit_policies')
      .select('*')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .single();

    if (error) {
      return null;
    }

    return {
      id: data.id,
      salonId: data.salon_id,
      name: data.name,
      description: data.description,
      defaultType: data.default_type,
      defaultAmount: data.default_amount,
      minServicePriceCents: data.min_service_price_cents,
      fullRefundHours: data.full_refund_hours,
      partialRefundHours: data.partial_refund_hours,
      partialRefundPercent: data.partial_refund_percent,
      noShowForfeit: data.no_show_forfeit,
      isActive: data.is_active,
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapDeposit(data: Record<string, unknown>): AppointmentDeposit {
    return {
      id: data.id as string,
      appointmentId: data.appointment_id as string,
      salonId: data.salon_id as string,
      customerId: data.customer_id as string,
      amountCents: data.amount_cents as number,
      currency: data.currency as string,
      stripePaymentIntentId: data.stripe_payment_intent_id as string | null,
      stripeChargeId: data.stripe_charge_id as string | null,
      status: data.status as DepositStatus,
      refundAmountCents: data.refund_amount_cents as number | null,
      refundReason: data.refund_reason as string | null,
      refundedAt: data.refunded_at ? new Date(data.refunded_at as string) : null,
      paidAt: data.paid_at ? new Date(data.paid_at as string) : null,
      appliedAt: data.applied_at ? new Date(data.applied_at as string) : null,
      forfeitedAt: data.forfeited_at ? new Date(data.forfeited_at as string) : null,
      createdAt: new Date(data.created_at as string),
    };
  }

  private mapDepositWithDetails(data: Record<string, unknown>): DepositWithDetails {
    return {
      id: data.id as string,
      appointmentId: data.appointment_id as string,
      salonId: data.salon_id as string,
      customerId: data.customer_id as string,
      amountCents: data.amount_cents as number,
      currency: (data.currency as string) || 'CHF',
      stripePaymentIntentId: data.stripe_payment_intent_id as string | null,
      stripeChargeId: data.stripe_charge_id as string | null,
      status: data.status as DepositStatus,
      refundAmountCents: data.refund_amount_cents as number | null,
      refundReason: data.refund_reason as string | null,
      refundedAt: data.refunded_at ? new Date(data.refunded_at as string) : null,
      paidAt: data.paid_at ? new Date(data.paid_at as string) : null,
      appliedAt: data.applied_at ? new Date(data.applied_at as string) : null,
      forfeitedAt: data.forfeited_at ? new Date(data.forfeited_at as string) : null,
      createdAt: new Date(data.created_at as string),
      customerName: data.customer_name as string,
      customerEmail: data.customer_email as string,
      customerPhone: data.customer_phone as string | null,
      serviceName: data.service_name as string,
      appointmentStartsAt: new Date(data.appointment_starts_at as string),
      hoursUntilAppointment: data.hours_until_appointment as number,
    };
  }
}

// ============================================
// SINGLETON
// ============================================

let depositServiceInstance: DepositService | null = null;

export function getDepositService(): DepositService {
  if (!depositServiceInstance) {
    depositServiceInstance = new DepositService();
  }
  return depositServiceInstance;
}
