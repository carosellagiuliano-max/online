/**
 * BeautifyPRO - SMS Service (Twilio)
 * Send SMS notifications for appointments, orders, and marketing
 */

import Twilio from 'twilio';
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import type {
  SMSMessage,
  SMSSendResult,
  SMSEventType,
  AppointmentTemplateVars,
  DeliveryStatus,
} from './types';
import {
  renderTemplate,
  getTemplateByEventType,
  normalizeToE164,
  isValidSwissPhone,
  calculateSmsSegments,
  DEFAULT_SMS_TEMPLATES,
} from './templates';
import { logger } from '@/lib/logging/logger';

// ============================================
// CONFIGURATION
// ============================================

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ============================================
// TWILIO CLIENT
// ============================================

let twilioClient: Twilio.Twilio | null = null;

function getTwilioClient(): Twilio.Twilio {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials not configured');
  }

  if (!twilioClient) {
    twilioClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }

  return twilioClient;
}

// ============================================
// SMS SERVICE
// ============================================

export class SMSService {
  private client: Twilio.Twilio;
  private fromNumber: string;

  constructor() {
    this.client = getTwilioClient();
    this.fromNumber = TWILIO_PHONE_NUMBER || '';
  }

  /**
   * Send a single SMS message
   */
  async send(message: SMSMessage): Promise<SMSSendResult> {
    // Validate phone number
    if (!isValidSwissPhone(message.to)) {
      logger.warn('Invalid phone number format', { phone: message.to });
      return {
        success: false,
        error: 'Invalid phone number format',
      };
    }

    const normalizedPhone = normalizeToE164(message.to);
    const segments = calculateSmsSegments(message.body);

    logger.info('Sending SMS', {
      eventType: message.eventType,
      to: normalizedPhone.slice(0, 6) + '***', // Masked for privacy
      segments,
      customerId: message.customerId,
    });

    try {
      const result: MessageInstance = await this.client.messages.create({
        body: message.body,
        to: normalizedPhone,
        from: this.fromNumber,
        statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/status`,
      });

      logger.info('SMS sent successfully', {
        messageId: result.sid,
        status: result.status,
      });

      return {
        success: true,
        messageId: result.sid,
        status: this.mapTwilioStatus(result.status),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('SMS send failed', new Error(errorMessage), {
        to: normalizedPhone.slice(0, 6) + '***',
        eventType: message.eventType,
      });

      return {
        success: false,
        error: errorMessage,
        status: 'failed',
      };
    }
  }

  /**
   * Send SMS with retry logic
   */
  async sendWithRetry(
    message: SMSMessage,
    maxRetries: number = MAX_RETRIES
  ): Promise<SMSSendResult> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.send(message);

      if (result.success) {
        return result;
      }

      lastError = result.error;
      logger.warn(`SMS send attempt ${attempt} failed`, {
        error: lastError,
        retriesLeft: maxRetries - attempt,
      });

      if (attempt < maxRetries) {
        await this.delay(RETRY_DELAY_MS * attempt);
      }
    }

    return {
      success: false,
      error: `Failed after ${maxRetries} attempts: ${lastError}`,
      status: 'failed',
    };
  }

  /**
   * Send templated SMS for appointment events
   */
  async sendAppointmentSMS(
    eventType: SMSEventType,
    phone: string,
    vars: AppointmentTemplateVars,
    customerId?: string,
    appointmentId?: string
  ): Promise<SMSSendResult> {
    const template = getTemplateByEventType(eventType);

    if (!template || !template.enabled) {
      logger.info('SMS template disabled or not found', { eventType });
      return {
        success: false,
        error: `Template '${eventType}' is disabled or not found`,
      };
    }

    const body = renderTemplate(template.template, vars);

    return this.sendWithRetry({
      to: phone,
      body,
      eventType,
      customerId,
      appointmentId,
    });
  }

  /**
   * Send appointment confirmation
   */
  async sendAppointmentConfirmation(
    phone: string,
    vars: AppointmentTemplateVars,
    customerId?: string,
    appointmentId?: string
  ): Promise<SMSSendResult> {
    return this.sendAppointmentSMS(
      'appointment_confirmed',
      phone,
      vars,
      customerId,
      appointmentId
    );
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(
    phone: string,
    vars: AppointmentTemplateVars,
    type: '24h' | '1h',
    customerId?: string,
    appointmentId?: string
  ): Promise<SMSSendResult> {
    const eventType: SMSEventType =
      type === '24h' ? 'appointment_reminder_24h' : 'appointment_reminder_1h';
    return this.sendAppointmentSMS(eventType, phone, vars, customerId, appointmentId);
  }

  /**
   * Send cancellation notification
   */
  async sendCancellationNotification(
    phone: string,
    vars: AppointmentTemplateVars,
    customerId?: string,
    appointmentId?: string
  ): Promise<SMSSendResult> {
    return this.sendAppointmentSMS(
      'appointment_cancelled',
      phone,
      vars,
      customerId,
      appointmentId
    );
  }

  /**
   * Get delivery status for a message
   */
  async getDeliveryStatus(messageId: string): Promise<DeliveryStatus | null> {
    try {
      const message = await this.client.messages(messageId).fetch();

      return {
        messageId: message.sid,
        status: this.mapTwilioStatus(message.status),
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage || undefined,
        timestamp: message.dateUpdated || new Date(),
      };
    } catch (error) {
      logger.error('Failed to fetch delivery status', error as Error, { messageId });
      return null;
    }
  }

  /**
   * Map Twilio status to our status type
   */
  private mapTwilioStatus(
    twilioStatus: string
  ): 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed' {
    switch (twilioStatus) {
      case 'queued':
      case 'accepted':
        return 'queued';
      case 'sending':
        return 'sending';
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'undelivered':
        return 'undelivered';
      case 'failed':
      case 'canceled':
      default:
        return 'failed';
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let smsServiceInstance: SMSService | null = null;

export function getSMSService(): SMSService {
  if (!smsServiceInstance) {
    smsServiceInstance = new SMSService();
  }
  return smsServiceInstance;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if SMS is configured
 */
export function isSMSConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
}

/**
 * Quick send function for simple use cases
 */
export async function sendSMS(
  to: string,
  eventType: SMSEventType,
  templateVars: Record<string, string | number>,
  options?: {
    customerId?: string;
    appointmentId?: string;
    orderId?: string;
  }
): Promise<SMSSendResult> {
  if (!isSMSConfigured()) {
    logger.warn('SMS not configured, skipping send');
    return { success: false, error: 'SMS not configured' };
  }

  const template = getTemplateByEventType(eventType);
  if (!template) {
    return { success: false, error: `Template not found: ${eventType}` };
  }

  const body = renderTemplate(template.template, templateVars);
  const service = getSMSService();

  return service.sendWithRetry({
    to,
    body,
    eventType,
    ...options,
  });
}

// ============================================
// EXPORTS
// ============================================

export { DEFAULT_SMS_TEMPLATES };
