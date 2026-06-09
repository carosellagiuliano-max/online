/**
 * BeautifyPRO - Appointment Reminder Service
 * Handles automated reminders for upcoming appointments
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';
import { getSMSService, isSMSConfigured } from './sms';
import type { AppointmentTemplateVars, AppointmentReminder } from './types';

// ============================================
// TYPES
// ============================================

interface AppointmentWithDetails {
  id: string;
  starts_at: string;
  status: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string;
  };
  service: {
    name: string;
  };
  staff: {
    first_name: string;
    last_name: string;
  };
  salon: {
    name: string;
    address: string;
    city: string;
  };
}

// ============================================
// REMINDER SERVICE
// ============================================

export class ReminderService {
  private get supabase() {
    return createServiceRoleClient();
  }

  /**
   * Send reminders for appointments starting in ~24 hours
   */
  async send24HourReminders(): Promise<{ sent: number; failed: number }> {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const windowStart = new Date(tomorrow.getTime() - 30 * 60 * 1000); // 23.5h
    const windowEnd = new Date(tomorrow.getTime() + 30 * 60 * 1000); // 24.5h

    logger.info('Processing 24h reminders', {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });

    return this.sendRemindersInWindow(windowStart, windowEnd, '24h');
  }

  /**
   * Send reminders for appointments starting in ~1 hour
   */
  async send1HourReminders(): Promise<{ sent: number; failed: number }> {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const windowStart = new Date(oneHourLater.getTime() - 5 * 60 * 1000); // 55min
    const windowEnd = new Date(oneHourLater.getTime() + 5 * 60 * 1000); // 65min

    logger.info('Processing 1h reminders', {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });

    return this.sendRemindersInWindow(windowStart, windowEnd, '1h');
  }

  /**
   * Get appointments in a time window and send reminders
   */
  private async sendRemindersInWindow(
    windowStart: Date,
    windowEnd: Date,
    reminderType: '24h' | '1h'
  ): Promise<{ sent: number; failed: number }> {
    if (!isSMSConfigured()) {
      logger.warn('SMS not configured, skipping reminders');
      return { sent: 0, failed: 0 };
    }

    // Fetch appointments in window
    const appointments = await this.getAppointmentsInWindow(windowStart, windowEnd);

    if (appointments.length === 0) {
      logger.info('No appointments found for reminders', { reminderType });
      return { sent: 0, failed: 0 };
    }

    logger.info(`Found ${appointments.length} appointments for ${reminderType} reminders`);

    let sent = 0;
    let failed = 0;
    const smsService = getSMSService();

    for (const appointment of appointments) {
      // Skip if customer has no phone
      if (!appointment.customer.phone) {
        logger.debug('Customer has no phone, skipping', {
          appointmentId: appointment.id,
          customerId: appointment.customer.id,
        });
        continue;
      }

      // Skip if already reminded (check reminder_sent flags)
      const alreadySent = await this.checkReminderSent(appointment.id, reminderType);
      if (alreadySent) {
        logger.debug('Reminder already sent', {
          appointmentId: appointment.id,
          reminderType,
        });
        continue;
      }

      // Send reminder
      const templateVars = this.createTemplateVars(appointment);
      const result = await smsService.sendAppointmentReminder(
        appointment.customer.phone,
        templateVars,
        reminderType,
        appointment.customer.id,
        appointment.id
      );

      if (result.success) {
        sent++;
        await this.markReminderSent(appointment.id, reminderType, result.messageId);
      } else {
        failed++;
        logger.error('Failed to send reminder', new Error(result.error || 'Unknown error'), {
          appointmentId: appointment.id,
          reminderType,
        });
      }
    }

    logger.info('Reminder batch completed', { reminderType, sent, failed });
    return { sent, failed };
  }

  /**
   * Fetch appointments in a time window
   */
  private async getAppointmentsInWindow(
    windowStart: Date,
    windowEnd: Date
  ): Promise<AppointmentWithDetails[]> {
    const { data, error } = await this.supabase
      .from('appointments')
      .select(`
        id,
        starts_at,
        status,
        customer:customers(
          id,
          first_name,
          last_name,
          phone,
          email
        ),
        service:services(
          name
        ),
        staff:staff(
          first_name,
          last_name
        ),
        salon:salons(
          name,
          address,
          city
        )
      `)
      .gte('starts_at', windowStart.toISOString())
      .lt('starts_at', windowEnd.toISOString())
      .in('status', ['confirmed', 'pending'])
      .order('starts_at', { ascending: true });

    if (error) {
      logger.error('Failed to fetch appointments for reminders', error);
      return [];
    }

    // Type assertion since Supabase returns nested objects
    return (data || []) as unknown as AppointmentWithDetails[];
  }

  /**
   * Check if reminder was already sent
   */
  private async checkReminderSent(
    appointmentId: string,
    reminderType: '24h' | '1h'
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('appointment_reminders')
      .select('id')
      .eq('appointment_id', appointmentId)
      .eq('reminder_type', reminderType)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      logger.error('Error checking reminder status', error);
    }

    return !!data;
  }

  /**
   * Mark reminder as sent
   */
  private async markReminderSent(
    appointmentId: string,
    reminderType: '24h' | '1h',
    messageId?: string
  ): Promise<void> {
    const { error } = await this.supabase.from('appointment_reminders').insert({
      appointment_id: appointmentId,
      reminder_type: reminderType,
      message_id: messageId,
      sent_at: new Date().toISOString(),
    });

    if (error) {
      logger.error('Failed to mark reminder as sent', error);
    }
  }

  /**
   * Create template variables from appointment
   */
  private createTemplateVars(appointment: AppointmentWithDetails): AppointmentTemplateVars {
    const startsAt = new Date(appointment.starts_at);

    return {
      customerName: appointment.customer.first_name,
      serviceName: appointment.service.name,
      staffName: `${appointment.staff.first_name} ${appointment.staff.last_name}`,
      date: startsAt.toLocaleDateString('de-CH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      time: startsAt.toLocaleTimeString('de-CH', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      salonName: appointment.salon.name,
      salonAddress: `${appointment.salon.address}, ${appointment.salon.city}`,
    };
  }
}

// ============================================
// SINGLETON
// ============================================

let reminderServiceInstance: ReminderService | null = null;

export function getReminderService(): ReminderService {
  if (!reminderServiceInstance) {
    reminderServiceInstance = new ReminderService();
  }
  return reminderServiceInstance;
}

// ============================================
// CRON JOB HANDLERS
// ============================================

/**
 * Handler for daily 24h reminder cron
 * Run at 08:00 daily
 */
export async function process24HourReminders(): Promise<{
  sent: number;
  failed: number;
}> {
  const service = getReminderService();
  return service.send24HourReminders();
}

/**
 * Handler for hourly 1h reminder cron
 * Run every hour
 */
export async function process1HourReminders(): Promise<{
  sent: number;
  failed: number;
}> {
  const service = getReminderService();
  return service.send1HourReminders();
}
