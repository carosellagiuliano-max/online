/**
 * BeautifyPRO - SMS Templates
 * Pre-defined templates for SMS notifications
 */

import type {
  SMSEventType,
  SMSTemplate,
  AppointmentTemplateVars,
  OrderTemplateVars,
  LoyaltyTemplateVars,
  WaitlistTemplateVars,
} from './types';

// ============================================
// DEFAULT TEMPLATES (German)
// ============================================

export const DEFAULT_SMS_TEMPLATES: SMSTemplate[] = [
  {
    id: 'appointment_confirmed',
    name: 'Terminbestätigung',
    template:
      'Hallo {{customerName}}, Ihr Termin bei BeautifyPRO wurde bestätigt: {{date}} um {{time}} Uhr ({{serviceName}} mit {{staffName}}). Wir freuen uns auf Sie!',
    enabled: true,
  },
  {
    id: 'appointment_reminder_24h',
    name: 'Terminerinnerung (24h)',
    template:
      'Hallo {{customerName}}, zur Erinnerung: Morgen um {{time}} Uhr haben Sie einen Termin bei BeautifyPRO ({{serviceName}}). Bis morgen!',
    enabled: true,
  },
  {
    id: 'appointment_reminder_1h',
    name: 'Terminerinnerung (1h)',
    template:
      'Hallo {{customerName}}, in einer Stunde beginnt Ihr Termin bei BeautifyPRO ({{serviceName}} mit {{staffName}}). Wir erwarten Sie!',
    enabled: true,
  },
  {
    id: 'appointment_cancelled',
    name: 'Termin abgesagt',
    template:
      'Hallo {{customerName}}, Ihr Termin am {{date}} um {{time}} bei BeautifyPRO wurde storniert. Bei Fragen kontaktieren Sie uns gerne.',
    enabled: true,
  },
  {
    id: 'appointment_no_show',
    name: 'Verpasster Termin',
    template:
      'Hallo {{customerName}}, leider haben Sie Ihren Termin am {{date}} verpasst. Bitte kontaktieren Sie uns für einen neuen Termin.',
    enabled: true,
  },
  {
    id: 'appointment_rescheduled',
    name: 'Termin verschoben',
    template:
      'Hallo {{customerName}}, Ihr Termin wurde verschoben auf: {{date}} um {{time}} Uhr ({{serviceName}}). Bis dann!',
    enabled: true,
  },
  {
    id: 'order_confirmed',
    name: 'Bestellung bestätigt',
    template:
      'Hallo {{customerName}}, Ihre Bestellung #{{orderNumber}} über CHF {{totalAmount}} wurde bestätigt. Vielen Dank!',
    enabled: true,
  },
  {
    id: 'voucher_received',
    name: 'Gutschein erhalten',
    template:
      'Hallo {{customerName}}, Sie haben einen BeautifyPRO Gutschein erhalten! Code: {{voucherCode}}, Wert: CHF {{voucherValue}}. Geniessen Sie es!',
    enabled: true,
  },
  {
    id: 'loyalty_tier_upgrade',
    name: 'Loyalty-Stufe Upgrade',
    template:
      'Herzlichen Glückwunsch {{customerName}}! Sie sind jetzt {{newTier}}-Mitglied bei BeautifyPRO und erhalten {{discount}} Rabatt auf alle Termine!',
    enabled: true,
  },
  {
    id: 'waitlist_available',
    name: 'Warteliste: Platz frei',
    template:
      'Gute Nachricht {{customerName}}! Am {{date}} um {{time}} ist ein Termin für {{serviceName}} frei geworden. Jetzt buchen: {{bookingLink}} (gültig bis {{expiresAt}})',
    enabled: true,
  },
];

// ============================================
// TEMPLATE RENDERING
// ============================================

type TemplateVars =
  | AppointmentTemplateVars
  | OrderTemplateVars
  | LoyaltyTemplateVars
  | WaitlistTemplateVars
  | Record<string, string | number>;

/**
 * Replace template placeholders with actual values
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  let result = template;

  Object.entries(vars).forEach(([key, value]) => {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(placeholder, String(value));
  });

  return result;
}

/**
 * Get template by event type
 */
export function getTemplateByEventType(
  eventType: SMSEventType,
  customTemplates?: SMSTemplate[]
): SMSTemplate | undefined {
  const templates = customTemplates || DEFAULT_SMS_TEMPLATES;
  return templates.find((t) => t.id === eventType);
}

/**
 * Check if template is enabled
 */
export function isTemplateEnabled(
  eventType: SMSEventType,
  customTemplates?: SMSTemplate[]
): boolean {
  const template = getTemplateByEventType(eventType, customTemplates);
  return template?.enabled ?? false;
}

// ============================================
// APPOINTMENT TEMPLATE HELPERS
// ============================================

export function createAppointmentConfirmationMessage(
  vars: AppointmentTemplateVars,
  customTemplate?: string
): string {
  const template =
    customTemplate ||
    getTemplateByEventType('appointment_confirmed')?.template ||
    DEFAULT_SMS_TEMPLATES[0].template;

  return renderTemplate(template, vars);
}

export function createReminderMessage(
  vars: AppointmentTemplateVars,
  type: '24h' | '1h',
  customTemplate?: string
): string {
  const eventType: SMSEventType =
    type === '24h' ? 'appointment_reminder_24h' : 'appointment_reminder_1h';
  const template =
    customTemplate ||
    getTemplateByEventType(eventType)?.template ||
    DEFAULT_SMS_TEMPLATES.find((t) => t.id === eventType)?.template ||
    '';

  return renderTemplate(template, vars);
}

export function createCancellationMessage(
  vars: AppointmentTemplateVars,
  customTemplate?: string
): string {
  const template =
    customTemplate ||
    getTemplateByEventType('appointment_cancelled')?.template ||
    DEFAULT_SMS_TEMPLATES.find((t) => t.id === 'appointment_cancelled')?.template ||
    '';

  return renderTemplate(template, vars);
}

// ============================================
// MESSAGE LENGTH UTILITIES
// ============================================

const SMS_MAX_LENGTH = 160;
const SMS_EXTENDED_LENGTH = 153; // per segment after first

/**
 * Calculate SMS segment count
 */
export function calculateSmsSegments(message: string): number {
  const length = message.length;

  if (length <= SMS_MAX_LENGTH) {
    return 1;
  }

  // For concatenated SMS, each segment is 153 chars
  return Math.ceil(length / SMS_EXTENDED_LENGTH);
}

/**
 * Truncate message to fit within segment limit
 */
export function truncateToSegments(message: string, maxSegments: number = 2): string {
  const maxLength = maxSegments === 1 ? SMS_MAX_LENGTH : SMS_MAX_LENGTH + (maxSegments - 1) * SMS_EXTENDED_LENGTH;

  if (message.length <= maxLength) {
    return message;
  }

  return message.slice(0, maxLength - 3) + '...';
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate Swiss phone number format
 */
export function isValidSwissPhone(phone: string): boolean {
  // Swiss numbers: +41 or 0041 followed by 9 digits
  const normalized = phone.replace(/\s|-/g, '');
  return /^(\+41|0041)?[0-9]{9}$/.test(normalized);
}

/**
 * Normalize phone to E.164 format
 */
export function normalizeToE164(phone: string): string {
  // Remove spaces and dashes
  let normalized = phone.replace(/\s|-/g, '');

  // Handle Swiss formats
  if (normalized.startsWith('0041')) {
    normalized = '+41' + normalized.slice(4);
  } else if (normalized.startsWith('0')) {
    normalized = '+41' + normalized.slice(1);
  } else if (!normalized.startsWith('+')) {
    normalized = '+41' + normalized;
  }

  return normalized;
}
