/**
 * BeautifyPRO - Web Push Notifications Service
 * Handle push subscriptions and notifications
 */

import webpush from 'web-push';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';

// ============================================
// CONFIGURATION
// ============================================

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@beautifypro.demo';

// Configure web-push
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// ============================================
// TYPES
// ============================================

export interface PushSubscription {
  id: string;
  customerId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  renotify?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

export type PushEventType =
  | 'appointment_reminder'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'waitlist_available'
  | 'loyalty_reward'
  | 'promotion';

// ============================================
// PUSH SERVICE
// ============================================

export class PushService {
  private get supabase() {
    return createServiceRoleClient();
  }

  /**
   * Check if push notifications are configured
   */
  static isConfigured(): boolean {
    return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
  }

  /**
   * Get VAPID public key for client subscription
   */
  static getPublicKey(): string | null {
    return VAPID_PUBLIC_KEY || null;
  }

  /**
   * Save a push subscription for a customer
   */
  async saveSubscription(
    customerId: string,
    subscription: PushSubscriptionJSON,
    userAgent?: string
  ): Promise<boolean> {
    if (!subscription.endpoint || !subscription.keys) {
      logger.warn('Invalid push subscription', { customerId });
      return false;
    }

    const { error } = await this.supabase.from('push_subscriptions').upsert(
      {
        customer_id: customerId,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        user_agent: userAgent || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'customer_id,endpoint',
      }
    );

    if (error) {
      logger.error('Failed to save push subscription', error, { customerId });
      return false;
    }

    logger.info('Push subscription saved', { customerId });
    return true;
  }

  /**
   * Remove a push subscription
   */
  async removeSubscription(customerId: string, endpoint: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('push_subscriptions')
      .delete()
      .eq('customer_id', customerId)
      .eq('endpoint', endpoint);

    if (error) {
      logger.error('Failed to remove push subscription', error, { customerId });
      return false;
    }

    logger.info('Push subscription removed', { customerId });
    return true;
  }

  /**
   * Get all subscriptions for a customer
   */
  async getCustomerSubscriptions(customerId: string): Promise<PushSubscription[]> {
    const { data, error } = await this.supabase
      .from('push_subscriptions')
      .select('*')
      .eq('customer_id', customerId);

    if (error) {
      logger.error('Failed to get push subscriptions', error);
      return [];
    }

    return (data || []).map(this.mapSubscription);
  }

  /**
   * Send push notification to a customer
   */
  async sendToCustomer(
    customerId: string,
    payload: PushNotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    const subscriptions = await this.getCustomerSubscriptions(customerId);

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        await this.sendNotification(sub, payload);
        sent++;
        await this.updateLastUsed(sub.id);
      } catch (error) {
        failed++;
        // If subscription is expired/invalid, remove it
        if (this.isExpiredSubscription(error)) {
          await this.removeSubscription(customerId, sub.endpoint);
        }
      }
    }

    logger.info('Push notifications sent', { customerId, sent, failed });
    return { sent, failed };
  }

  /**
   * Send push notification to multiple customers
   */
  async sendToMultiple(
    customerIds: string[],
    payload: PushNotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    let totalSent = 0;
    let totalFailed = 0;

    for (const customerId of customerIds) {
      const result = await this.sendToCustomer(customerId, payload);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    return { sent: totalSent, failed: totalFailed };
  }

  /**
   * Send appointment reminder push
   */
  async sendAppointmentReminder(
    customerId: string,
    appointmentDetails: {
      serviceName: string;
      date: string;
      time: string;
      staffName: string;
    }
  ): Promise<boolean> {
    const payload: PushNotificationPayload = {
      title: 'Terminerinnerung',
      body: `Ihr Termin "${appointmentDetails.serviceName}" ist am ${appointmentDetails.date} um ${appointmentDetails.time} Uhr.`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'appointment-reminder',
      data: {
        type: 'appointment_reminder',
        url: '/dashboard/termine',
      },
      actions: [
        { action: 'view', title: 'Ansehen' },
        { action: 'dismiss', title: 'OK' },
      ],
      requireInteraction: true,
    };

    const result = await this.sendToCustomer(customerId, payload);
    return result.sent > 0;
  }

  /**
   * Send waitlist availability push
   */
  async sendWaitlistAvailable(
    customerId: string,
    details: {
      serviceName: string;
      date: string;
      time: string;
      waitlistId: string;
    }
  ): Promise<boolean> {
    const payload: PushNotificationPayload = {
      title: 'Termin verfuegbar!',
      body: `Am ${details.date} um ${details.time} ist ein Platz frei geworden. Jetzt buchen!`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'waitlist-available',
      data: {
        type: 'waitlist_available',
        waitlistId: details.waitlistId,
        url: `/buchen?waitlist=${details.waitlistId}`,
      },
      actions: [
        { action: 'book', title: 'Jetzt buchen' },
        { action: 'dismiss', title: 'Spaeter' },
      ],
      requireInteraction: true,
      vibrate: [200, 100, 200],
    };

    const result = await this.sendToCustomer(customerId, payload);
    return result.sent > 0;
  }

  /**
   * Send loyalty reward push
   */
  async sendLoyaltyReward(
    customerId: string,
    details: {
      points: number;
      tierName?: string;
      message?: string;
    }
  ): Promise<boolean> {
    const payload: PushNotificationPayload = {
      title: details.tierName ? `Aufstieg zu ${details.tierName}!` : 'Punkte erhalten!',
      body: details.message || `Sie haben ${details.points} Treuepunkte erhalten!`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'loyalty-reward',
      data: {
        type: 'loyalty_reward',
        url: '/dashboard/treueprogramm',
      },
    };

    const result = await this.sendToCustomer(customerId, payload);
    return result.sent > 0;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async sendNotification(
    subscription: PushSubscription,
    payload: PushNotificationPayload
  ): Promise<void> {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    };

    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      {
        TTL: 86400, // 24 hours
      }
    );
  }

  private async updateLastUsed(subscriptionId: string): Promise<void> {
    await this.supabase
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', subscriptionId);
  }

  private isExpiredSubscription(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes('410') || error.message.includes('expired');
    }
    return false;
  }

  private mapSubscription(data: Record<string, unknown>): PushSubscription {
    return {
      id: data.id as string,
      customerId: data.customer_id as string,
      endpoint: data.endpoint as string,
      keys: {
        p256dh: data.p256dh_key as string,
        auth: data.auth_key as string,
      },
      userAgent: data.user_agent as string | null,
      createdAt: new Date(data.created_at as string),
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at as string) : null,
    };
  }
}

// ============================================
// SINGLETON
// ============================================

let pushServiceInstance: PushService | null = null;

export function getPushService(): PushService {
  if (!pushServiceInstance) {
    pushServiceInstance = new PushService();
  }
  return pushServiceInstance;
}

// ============================================
// HELPER EXPORTS
// ============================================

export function isPushConfigured(): boolean {
  return PushService.isConfigured();
}

export function getVapidPublicKey(): string | null {
  return PushService.getPublicKey();
}
