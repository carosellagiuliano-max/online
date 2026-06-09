/**
 * BeautifyPRO - Notification System
 * Central export for all notification services
 */

// Types
export * from './types';

// Templates
export {
  DEFAULT_SMS_TEMPLATES,
  renderTemplate,
  getTemplateByEventType,
  isTemplateEnabled,
  createAppointmentConfirmationMessage,
  createReminderMessage,
  createCancellationMessage,
  calculateSmsSegments,
  truncateToSegments,
  isValidSwissPhone,
  normalizeToE164,
} from './templates';

// SMS Service
export {
  SMSService,
  getSMSService,
  isSMSConfigured,
  sendSMS,
} from './sms';

// Reminder Service
export {
  ReminderService,
  getReminderService,
  process24HourReminders,
  process1HourReminders,
} from './reminders';

// Push Service
export {
  PushService,
  getPushService,
  isPushConfigured,
  getVapidPublicKey,
} from './push';
