/**
 * BeautifyPRO - Waitlist Service
 * Handles waitlist functionality for booked slots
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';
import { sendSMS, isSMSConfigured } from '@/lib/notifications';

// ============================================
// TYPES
// ============================================

export type WaitlistStatus = 'waiting' | 'notified' | 'booked' | 'expired' | 'cancelled';

export interface WaitlistEntry {
  id: string;
  salonId: string;
  customerId: string;
  serviceId: string;
  staffId: string | null;
  requestedDate: string;
  requestedTimeStart: string | null;
  requestedTimeEnd: string | null;
  flexibleTime: boolean;
  status: WaitlistStatus;
  position: number;
  notifiedAt: Date | null;
  notificationExpiresAt: Date | null;
  createdAt: Date;
}

export interface WaitlistEntryWithDetails extends WaitlistEntry {
  customerName: string;
  customerPhone: string | null;
  customerEmail: string;
  serviceName: string;
  durationMinutes: number;
  staffName: string;
}

export interface JoinWaitlistParams {
  salonId: string;
  customerId: string;
  serviceId: string;
  staffId?: string | null;
  requestedDate: string;
  requestedTimeStart?: string | null;
  requestedTimeEnd?: string | null;
  flexibleTime?: boolean;
}

export interface WaitlistStats {
  waitingCount: number;
  notifiedCount: number;
  bookedCount: number;
  expiredCount: number;
  conversionRate: number;
}

// ============================================
// WAITLIST SERVICE
// ============================================

export class WaitlistService {
  private get supabase() {
    return createServiceRoleClient();
  }

  /**
   * Join waitlist for a specific slot
   */
  async joinWaitlist(params: JoinWaitlistParams): Promise<{ id: string; position: number } | null> {
    const { data, error } = await this.supabase.rpc('join_waitlist', {
      p_salon_id: params.salonId,
      p_customer_id: params.customerId,
      p_service_id: params.serviceId,
      p_staff_id: params.staffId || null,
      p_requested_date: params.requestedDate,
      p_requested_time_start: params.requestedTimeStart || null,
      p_requested_time_end: params.requestedTimeEnd || null,
      p_flexible_time: params.flexibleTime || false,
    });

    if (error) {
      logger.error('Failed to join waitlist', error, {
        customerId: params.customerId,
        serviceId: params.serviceId,
        requestedDate: params.requestedDate,
      });
      throw new Error(error.message);
    }

    // Get the created entry to return position
    const { data: entry } = await this.supabase
      .from('waitlist')
      .select('id, position')
      .eq('id', data)
      .single();

    logger.info('Customer joined waitlist', {
      waitlistId: data,
      customerId: params.customerId,
      serviceId: params.serviceId,
      date: params.requestedDate,
    });

    return entry ? { id: entry.id, position: entry.position } : null;
  }

  /**
   * Leave/cancel waitlist entry
   */
  async leaveWaitlist(waitlistId: string, customerId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('waitlist')
      .update({ status: 'cancelled' })
      .eq('id', waitlistId)
      .eq('customer_id', customerId)
      .in('status', ['waiting', 'notified']);

    if (error) {
      logger.error('Failed to leave waitlist', error, { waitlistId, customerId });
      return false;
    }

    logger.info('Customer left waitlist', { waitlistId, customerId });
    return true;
  }

  /**
   * Get customer's active waitlist entries
   */
  async getCustomerWaitlist(customerId: string): Promise<WaitlistEntryWithDetails[]> {
    const { data, error } = await this.supabase
      .from('v_active_waitlist')
      .select('*')
      .eq('customer_id', customerId)
      .order('requested_date', { ascending: true });

    if (error) {
      logger.error('Failed to fetch customer waitlist', error);
      return [];
    }

    return (data || []).map(this.mapWaitlistEntry);
  }

  /**
   * Get waitlist entries for a salon
   */
  async getSalonWaitlist(
    salonId: string,
    date?: string,
    status?: WaitlistStatus
  ): Promise<WaitlistEntryWithDetails[]> {
    let query = this.supabase
      .from('v_active_waitlist')
      .select('*')
      .eq('salon_id', salonId)
      .order('position', { ascending: true });

    if (date) {
      query = query.eq('requested_date', date);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch salon waitlist', error);
      return [];
    }

    return (data || []).map(this.mapWaitlistEntry);
  }

  /**
   * Notify waitlist when a slot becomes available
   * Called when an appointment is cancelled or rescheduled
   */
  async notifyWaitlistForSlot(
    salonId: string,
    serviceId: string,
    date: string,
    time: string,
    staffId?: string
  ): Promise<number> {
    // Get matching waitlist entries and mark as notified
    const { data, error } = await this.supabase.rpc('notify_waitlist_for_slot', {
      p_salon_id: salonId,
      p_service_id: serviceId,
      p_date: date,
      p_time: time,
      p_staff_id: staffId || null,
    });

    if (error) {
      logger.error('Failed to notify waitlist', error, { salonId, serviceId, date, time });
      return 0;
    }

    const entries = data as Array<{
      waitlist_id: string;
      customer_id: string;
      customer_phone: string | null;
      customer_email: string;
    }>;

    // Send notifications
    let notifiedCount = 0;
    for (const entry of entries) {
      try {
        await this.sendWaitlistNotification(entry, serviceId, date, time);
        notifiedCount++;
      } catch (err) {
        logger.error('Failed to send waitlist notification', err as Error, {
          waitlistId: entry.waitlist_id,
        });
      }
    }

    logger.info('Waitlist notifications sent', {
      salonId,
      serviceId,
      date,
      time,
      notifiedCount,
    });

    return notifiedCount;
  }

  /**
   * Complete a waitlist booking
   */
  async completeBooking(waitlistId: string, appointmentId: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('complete_waitlist_booking', {
      p_waitlist_id: waitlistId,
      p_appointment_id: appointmentId,
    });

    if (error) {
      logger.error('Failed to complete waitlist booking', error, { waitlistId, appointmentId });
      return false;
    }

    logger.info('Waitlist booking completed', { waitlistId, appointmentId });
    return data as boolean;
  }

  /**
   * Get waitlist statistics for a salon
   */
  async getStats(salonId: string, date?: string): Promise<WaitlistStats> {
    let query = this.supabase
      .from('v_waitlist_stats')
      .select('*')
      .eq('salon_id', salonId);

    if (date) {
      query = query.eq('requested_date', date);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return {
        waitingCount: 0,
        notifiedCount: 0,
        bookedCount: 0,
        expiredCount: 0,
        conversionRate: 0,
      };
    }

    // Aggregate stats
    const stats = data.reduce(
      (acc, row) => ({
        waitingCount: acc.waitingCount + (row.waiting_count || 0),
        notifiedCount: acc.notifiedCount + (row.notified_count || 0),
        bookedCount: acc.bookedCount + (row.booked_count || 0),
        expiredCount: acc.expiredCount + (row.expired_count || 0),
      }),
      { waitingCount: 0, notifiedCount: 0, bookedCount: 0, expiredCount: 0 }
    );

    const totalCompleted = stats.bookedCount + stats.expiredCount;
    const conversionRate = totalCompleted > 0
      ? (stats.bookedCount / totalCompleted) * 100
      : 0;

    return {
      ...stats,
      conversionRate: Math.round(conversionRate * 10) / 10,
    };
  }

  /**
   * Expire old notifications
   * Should be called via cron job
   */
  async expireOldNotifications(): Promise<number> {
    const { data, error } = await this.supabase.rpc('expire_waitlist_notifications');

    if (error) {
      logger.error('Failed to expire waitlist notifications', error);
      return 0;
    }

    const expiredCount = data as number;
    if (expiredCount > 0) {
      logger.info('Expired waitlist notifications', { count: expiredCount });
    }

    return expiredCount;
  }

  /**
   * Get position in waitlist
   */
  async getPosition(waitlistId: string): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('waitlist')
      .select('position')
      .eq('id', waitlistId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.position;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async sendWaitlistNotification(
    entry: {
      waitlist_id: string;
      customer_id: string;
      customer_phone: string | null;
      customer_email: string;
    },
    serviceId: string,
    date: string,
    time: string
  ): Promise<void> {
    // Get service name for notification
    const { data: service } = await this.supabase
      .from('services')
      .select('name')
      .eq('id', serviceId)
      .single();

    const serviceName = service?.name || 'Termin';
    const formattedDate = new Date(date).toLocaleDateString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const bookingLink = `${process.env.NEXT_PUBLIC_APP_URL}/buchen?waitlist=${entry.waitlist_id}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toLocaleTimeString('de-CH', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Send SMS if configured and phone available
    if (isSMSConfigured() && entry.customer_phone) {
      await sendSMS(entry.customer_phone, 'waitlist_available', {
        customerName: 'Kunde',
        serviceName,
        date: formattedDate,
        time,
        bookingLink,
        expiresAt,
      }, {
        customerId: entry.customer_id,
      });
    }

    // TODO: Also send email notification
  }

  private mapWaitlistEntry(data: Record<string, unknown>): WaitlistEntryWithDetails {
    return {
      id: data.id as string,
      salonId: data.salon_id as string,
      customerId: data.customer_id as string,
      serviceId: data.service_id as string,
      staffId: data.staff_id as string | null,
      requestedDate: data.requested_date as string,
      requestedTimeStart: data.requested_time_start as string | null,
      requestedTimeEnd: data.requested_time_end as string | null,
      flexibleTime: data.flexible_time as boolean,
      status: data.status as WaitlistStatus,
      position: data.position as number,
      notifiedAt: data.notified_at ? new Date(data.notified_at as string) : null,
      notificationExpiresAt: data.notification_expires_at
        ? new Date(data.notification_expires_at as string)
        : null,
      createdAt: new Date(data.created_at as string),
      customerName: data.customer_name as string,
      customerPhone: data.customer_phone as string | null,
      customerEmail: data.customer_email as string,
      serviceName: data.service_name as string,
      durationMinutes: data.duration_minutes as number,
      staffName: data.staff_name as string,
    };
  }
}

// ============================================
// SINGLETON
// ============================================

let waitlistServiceInstance: WaitlistService | null = null;

export function getWaitlistService(): WaitlistService {
  if (!waitlistServiceInstance) {
    waitlistServiceInstance = new WaitlistService();
  }
  return waitlistServiceInstance;
}
