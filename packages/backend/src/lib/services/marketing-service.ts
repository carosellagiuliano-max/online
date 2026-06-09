/**
 * BeautifyPRO - Marketing Automation Service
 * Automated marketing campaigns: Birthday emails, Re-engagement, Newsletter
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';
import { sendSMS, isSMSConfigured } from '@/lib/notifications';
import { getLoyaltyService } from './loyalty-service';

// ============================================
// TYPES
// ============================================

export type CampaignType =
  | 'birthday'
  | 'reengagement'
  | 'welcome'
  | 'post_visit'
  | 'newsletter';

export interface MarketingCampaign {
  id: string;
  salonId: string;
  type: CampaignType;
  name: string;
  subject: string;
  content: string;
  triggerDays: number; // Days before (negative) or after (positive) event
  discountPercent: number | null;
  voucherValue: number | null;
  isActive: boolean;
  createdAt: Date;
}

export interface CampaignLog {
  id: string;
  campaignId: string;
  customerId: string;
  channel: 'email' | 'sms';
  sentAt: Date;
  opened: boolean;
  clicked: boolean;
  converted: boolean;
}

export interface CustomerForCampaign {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  birthday: string | null;
  lastVisitDate: string | null;
  createdAt: string;
  marketingEmailConsent: boolean;
  marketingSmsConsent: boolean;
}

// ============================================
// DEFAULT CAMPAIGN TEMPLATES
// ============================================

export const DEFAULT_CAMPAIGNS: Omit<MarketingCampaign, 'id' | 'salonId' | 'createdAt'>[] = [
  {
    type: 'birthday',
    name: 'Geburtstagsgruss',
    subject: 'Alles Gute zum Geburtstag von BeautifyPRO!',
    content: `Liebe/r {{firstName}},

wir wünschen Ihnen alles Gute zum Geburtstag! 🎂

Als kleines Geschenk erhalten Sie 10% Rabatt auf Ihren nächsten Termin.
Gutscheincode: BIRTHDAY10

Wir freuen uns auf Sie!
Ihr BeautifyPRO Team`,
    triggerDays: 0, // On birthday
    discountPercent: 10,
    voucherValue: null,
    isActive: true,
  },
  {
    type: 'reengagement',
    name: 'Wir vermissen Sie',
    subject: 'Wir vermissen Sie bei BeautifyPRO!',
    content: `Liebe/r {{firstName}},

es ist schon eine Weile her seit Ihrem letzten Besuch bei uns.

Wir würden Sie gerne wieder bei uns begrüssen!
Als kleines Dankeschön erhalten Sie 5% auf Ihren nächsten Termin.

Gutscheincode: COMEBACK5

Jetzt Termin buchen: {{bookingLink}}

Herzliche Grüsse,
Ihr BeautifyPRO Team`,
    triggerDays: 60, // 60 days after last visit
    discountPercent: 5,
    voucherValue: null,
    isActive: true,
  },
  {
    type: 'welcome',
    name: 'Willkommen',
    subject: 'Willkommen bei BeautifyPRO!',
    content: `Liebe/r {{firstName}},

herzlich willkommen bei BeautifyPRO!

Wir freuen uns, Sie als neuen Kunden begrüssen zu dürfen.
Entdecken Sie unser Treueprogramm und sammeln Sie bei jedem Besuch Punkte.

Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.

Herzliche Grüsse,
Ihr BeautifyPRO Team`,
    triggerDays: 1, // 1 day after first visit
    discountPercent: null,
    voucherValue: null,
    isActive: true,
  },
  {
    type: 'post_visit',
    name: 'Nach dem Besuch',
    subject: 'Danke für Ihren Besuch bei BeautifyPRO!',
    content: `Liebe/r {{firstName}},

vielen Dank für Ihren Besuch bei uns!

Wir hoffen, Sie waren zufrieden mit unserem Service.
Haben Sie Feedback? Wir freuen uns über Ihre Bewertung.

{{feedbackLink}}

Bis zum nächsten Mal!
Ihr BeautifyPRO Team`,
    triggerDays: 1, // 1 day after visit
    discountPercent: null,
    voucherValue: null,
    isActive: true,
  },
];

// ============================================
// MARKETING SERVICE
// ============================================

export class MarketingService {
  private get supabase() {
    return createServiceRoleClient();
  }

  /**
   * Process birthday campaigns
   * Should run daily at 08:00
   */
  async processBirthdayCampaigns(salonId: string): Promise<{ sent: number; failed: number }> {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    // Get customers with birthday today who have marketing consent
    const { data: customers, error } = await this.supabase
      .from('customers')
      .select(`
        id,
        email,
        phone,
        first_name,
        last_name,
        birthday
      `)
      .eq('salon_id', salonId)
      .not('birthday', 'is', null)
      .like('birthday', `%-${month}-${day}`);

    if (error) {
      logger.error('Failed to fetch birthday customers', error);
      return { sent: 0, failed: 0 };
    }

    // Check consent and send
    let sent = 0;
    let failed = 0;

    for (const customer of customers || []) {
      const consent = await this.checkMarketingConsent(customer.id);

      // Skip if already sent this year
      const alreadySent = await this.checkCampaignSentThisYear(customer.id, 'birthday');
      if (alreadySent) {
        continue;
      }

      try {
        // Award birthday bonus points
        const loyaltyService = getLoyaltyService();
        await loyaltyService.awardBirthdayBonus(customer.id);

        // Send email if consent
        if (consent.email) {
          await this.sendBirthdayEmail(customer);
        }

        // Send SMS if consent and configured
        if (consent.sms && isSMSConfigured() && customer.phone) {
          await this.sendBirthdaySMS(customer);
        }

        await this.logCampaignSent(customer.id, 'birthday', 'email');
        sent++;
      } catch (err) {
        logger.error('Failed to send birthday campaign', err as Error, {
          customerId: customer.id,
        });
        failed++;
      }
    }

    logger.info('Birthday campaigns processed', { salonId, sent, failed });
    return { sent, failed };
  }

  /**
   * Process re-engagement campaigns
   * Should run daily
   */
  async processReengagementCampaigns(
    salonId: string,
    inactiveDays: number = 60
  ): Promise<{ sent: number; failed: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    // Get customers with no appointments after cutoff date
    const { data: customers, error } = await this.supabase
      .from('customers')
      .select(`
        id,
        email,
        phone,
        first_name,
        last_name,
        created_at
      `)
      .eq('salon_id', salonId)
      .lt('updated_at', cutoffDate.toISOString());

    if (error) {
      logger.error('Failed to fetch inactive customers', error);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const customer of customers || []) {
      const consent = await this.checkMarketingConsent(customer.id);

      // Skip if already sent recently (within 30 days)
      const alreadySent = await this.checkCampaignSentRecently(
        customer.id,
        'reengagement',
        30
      );
      if (alreadySent) {
        continue;
      }

      try {
        if (consent.email) {
          await this.sendReengagementEmail(customer);
          await this.logCampaignSent(customer.id, 'reengagement', 'email');
          sent++;
        }
      } catch (err) {
        logger.error('Failed to send reengagement campaign', err as Error, {
          customerId: customer.id,
        });
        failed++;
      }
    }

    logger.info('Reengagement campaigns processed', { salonId, sent, failed, inactiveDays });
    return { sent, failed };
  }

  /**
   * Process welcome emails for new customers
   * Should run daily
   */
  async processWelcomeCampaigns(salonId: string): Promise<{ sent: number; failed: number }> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date();
    dayBefore.setDate(dayBefore.getDate() - 2);

    // Get new customers from yesterday
    const { data: customers, error } = await this.supabase
      .from('customers')
      .select('id, email, phone, first_name, last_name, created_at')
      .eq('salon_id', salonId)
      .gte('created_at', dayBefore.toISOString())
      .lt('created_at', yesterday.toISOString());

    if (error) {
      logger.error('Failed to fetch new customers', error);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const customer of customers || []) {
      try {
        const consent = await this.checkMarketingConsent(customer.id);
        if (consent.email) {
          await this.sendWelcomeEmail(customer);
          await this.logCampaignSent(customer.id, 'welcome', 'email');
          sent++;
        }
      } catch (err) {
        logger.error('Failed to send welcome campaign', err as Error, {
          customerId: customer.id,
        });
        failed++;
      }
    }

    logger.info('Welcome campaigns processed', { salonId, sent, failed });
    return { sent, failed };
  }

  /**
   * Process post-visit feedback requests
   * Should run daily
   */
  async processPostVisitCampaigns(salonId: string): Promise<{ sent: number; failed: number }> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date();
    dayBefore.setDate(dayBefore.getDate() - 2);

    // Get appointments from yesterday
    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select(`
        id,
        customer:customers(
          id,
          email,
          phone,
          first_name,
          last_name
        )
      `)
      .eq('salon_id', salonId)
      .eq('status', 'completed')
      .gte('ends_at', dayBefore.toISOString())
      .lt('ends_at', yesterday.toISOString());

    if (error) {
      logger.error('Failed to fetch completed appointments', error);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const appt of appointments || []) {
      const customer = appt.customer as unknown as CustomerForCampaign;
      if (!customer) continue;

      try {
        // Skip if already sent for this appointment
        const alreadySent = await this.checkFeedbackSent(appt.id);
        if (alreadySent) continue;

        await this.sendFeedbackRequest(customer, appt.id);
        await this.logCampaignSent(customer.id, 'post_visit', 'email', appt.id);
        sent++;
      } catch (err) {
        logger.error('Failed to send post-visit campaign', err as Error, {
          appointmentId: appt.id,
        });
        failed++;
      }
    }

    logger.info('Post-visit campaigns processed', { salonId, sent, failed });
    return { sent, failed };
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(
    salonId: string,
    campaignType?: CampaignType,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalSent: number;
    openRate: number;
    clickRate: number;
    conversionRate: number;
  }> {
    let query = this.supabase
      .from('marketing_logs')
      .select('*')
      .eq('salon_id', salonId);

    if (campaignType) {
      query = query.eq('campaign_type', campaignType);
    }

    if (dateRange) {
      query = query
        .gte('sent_at', dateRange.start.toISOString())
        .lte('sent_at', dateRange.end.toISOString());
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return {
        totalSent: 0,
        openRate: 0,
        clickRate: 0,
        conversionRate: 0,
      };
    }

    const totalSent = data.length;
    const opened = data.filter((l) => l.opened).length;
    const clicked = data.filter((l) => l.clicked).length;
    const converted = data.filter((l) => l.converted).length;

    return {
      totalSent,
      openRate: Math.round((opened / totalSent) * 100 * 10) / 10,
      clickRate: Math.round((clicked / totalSent) * 100 * 10) / 10,
      conversionRate: Math.round((converted / totalSent) * 100 * 10) / 10,
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async checkMarketingConsent(
    customerId: string
  ): Promise<{ email: boolean; sms: boolean }> {
    const { data } = await this.supabase
      .from('notification_preferences')
      .select('marketing_emails, marketing_sms')
      .eq('customer_id', customerId)
      .single();

    return {
      email: data?.marketing_emails || false,
      sms: data?.marketing_sms || false,
    };
  }

  private async checkCampaignSentThisYear(
    customerId: string,
    campaignType: CampaignType
  ): Promise<boolean> {
    const startOfYear = new Date();
    startOfYear.setMonth(0, 1);
    startOfYear.setHours(0, 0, 0, 0);

    const { count } = await this.supabase
      .from('marketing_logs')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('campaign_type', campaignType)
      .gte('sent_at', startOfYear.toISOString());

    return (count || 0) > 0;
  }

  private async checkCampaignSentRecently(
    customerId: string,
    campaignType: CampaignType,
    days: number
  ): Promise<boolean> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { count } = await this.supabase
      .from('marketing_logs')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('campaign_type', campaignType)
      .gte('sent_at', cutoff.toISOString());

    return (count || 0) > 0;
  }

  private async checkFeedbackSent(appointmentId: string): Promise<boolean> {
    const { count } = await this.supabase
      .from('marketing_logs')
      .select('id', { count: 'exact', head: true })
      .eq('reference_id', appointmentId)
      .eq('campaign_type', 'post_visit');

    return (count || 0) > 0;
  }

  private async logCampaignSent(
    customerId: string,
    campaignType: CampaignType,
    channel: 'email' | 'sms',
    referenceId?: string
  ): Promise<void> {
    // Get salon_id from customer
    const { data: customer } = await this.supabase
      .from('customers')
      .select('salon_id')
      .eq('id', customerId)
      .single();

    await this.supabase.from('marketing_logs').insert({
      customer_id: customerId,
      salon_id: customer?.salon_id,
      campaign_type: campaignType,
      channel,
      reference_id: referenceId,
      sent_at: new Date().toISOString(),
    });
  }

  private async sendBirthdayEmail(customer: {
    email: string;
    first_name: string;
  }): Promise<void> {
    // TODO: Integrate with email service (Resend)
    logger.info('Birthday email would be sent', { email: customer.email });
  }

  private async sendBirthdaySMS(customer: {
    phone: string | null;
    first_name: string;
  }): Promise<void> {
    if (!customer.phone) return;

    await sendSMS(customer.phone, 'loyalty_tier_upgrade', {
      customerName: customer.first_name,
      newTier: 'Geburtstagskind',
      discount: '10%',
    });
  }

  private async sendReengagementEmail(customer: {
    email: string;
    first_name: string;
  }): Promise<void> {
    // TODO: Integrate with email service (Resend)
    logger.info('Reengagement email would be sent', { email: customer.email });
  }

  private async sendWelcomeEmail(customer: {
    email: string;
    first_name: string;
  }): Promise<void> {
    // TODO: Integrate with email service (Resend)
    logger.info('Welcome email would be sent', { email: customer.email });
  }

  private async sendFeedbackRequest(
    customer: CustomerForCampaign,
    appointmentId: string
  ): Promise<void> {
    // TODO: Integrate with email service (Resend)
    logger.info('Feedback request would be sent', {
      email: customer.email,
      appointmentId,
    });
  }
}

// ============================================
// SINGLETON
// ============================================

let marketingServiceInstance: MarketingService | null = null;

export function getMarketingService(): MarketingService {
  if (!marketingServiceInstance) {
    marketingServiceInstance = new MarketingService();
  }
  return marketingServiceInstance;
}
