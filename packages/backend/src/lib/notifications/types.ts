/**
 * BeautifyPRO - Notification Types
 * Type definitions for SMS, Email, and Push notifications
 */

// ============================================
// SMS TYPES
// ============================================

export type SMSEventType =
  | 'appointment_confirmed'
  | 'appointment_reminder_24h'
  | 'appointment_reminder_1h'
  | 'appointment_cancelled'
  | 'appointment_no_show'
  | 'appointment_rescheduled'
  | 'order_confirmed'
  | 'voucher_received'
  | 'loyalty_tier_upgrade'
  | 'waitlist_available';

export interface SMSMessage {
  to: string; // E.164 format: +41791234567
  body: string;
  eventType: SMSEventType;
  customerId?: string;
  appointmentId?: string;
  orderId?: string;
}

export interface SMSSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed';
}

export interface SMSTemplate {
  id: SMSEventType;
  name: string;
  template: string; // With {{placeholders}}
  enabled: boolean;
}

// ============================================
// NOTIFICATION PREFERENCES
// ============================================

export interface NotificationPreferences {
  smsEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  reminder24h: boolean;
  reminder1h: boolean;
  marketingEmails: boolean;
  marketingSms: boolean;
}

// ============================================
// REMINDER TYPES
// ============================================

export interface AppointmentReminder {
  appointmentId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceName: string;
  staffName: string;
  startsAt: Date;
  salonName: string;
  salonAddress: string;
  reminderType: '24h' | '1h';
}

// ============================================
// TEMPLATE VARIABLES
// ============================================

export interface AppointmentTemplateVars {
  customerName: string;
  serviceName: string;
  staffName: string;
  date: string; // DD.MM.YYYY
  time: string; // HH:mm
  salonName: string;
  salonAddress: string;
  confirmationCode?: string;
  cancelLink?: string;
}

export interface OrderTemplateVars {
  customerName: string;
  orderNumber: string;
  totalAmount: string;
  itemCount: number;
}

export interface LoyaltyTemplateVars {
  customerName: string;
  currentPoints: number;
  newTier: string;
  discount: string;
}

export interface WaitlistTemplateVars {
  customerName: string;
  serviceName: string;
  date: string;
  time: string;
  expiresAt: string;
  bookingLink: string;
}

// ============================================
// QUEUE TYPES
// ============================================

export type QueueStatus = 'pending' | 'processing' | 'sent' | 'failed';

export interface QueuedNotification {
  id: string;
  type: 'sms' | 'email' | 'push';
  eventType: SMSEventType;
  recipient: string;
  payload: Record<string, unknown>;
  status: QueueStatus;
  attempts: number;
  maxAttempts: number;
  scheduledFor: Date;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DELIVERY STATUS
// ============================================

export interface DeliveryStatus {
  messageId: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  timestamp: Date;
}
