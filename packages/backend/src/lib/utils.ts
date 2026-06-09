import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ============================================
// STYLING UTILITIES
// ============================================

/**
 * Merges Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// DATE UTILITIES
// ============================================

/**
 * Formats a date in Swiss German format
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
}

/**
 * Formats a time in Swiss format (24h)
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a date and time in Swiss format
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${formatDate(d)} ${formatTime(d)}`;
}

/**
 * Gets the day name in German
 */
export function getDayName(date: Date | number): string {
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const dayIndex = typeof date === 'number' ? date : date.getDay();
  return days[dayIndex];
}

/**
 * Gets the short day name in German
 */
export function getShortDayName(date: Date | number): string {
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const dayIndex = typeof date === 'number' ? date : date.getDay();
  return days[dayIndex];
}

/**
 * Gets the month name in German
 */
export function getMonthName(date: Date | number): string {
  const months = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  const monthIndex = typeof date === 'number' ? date : date.getMonth();
  return months[monthIndex];
}

/**
 * Checks if a date is today
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

/**
 * Checks if a date is in the past
 */
export function isPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d < new Date();
}

/**
 * Checks if a date is in the future
 */
export function isFuture(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d > new Date();
}

/**
 * Adds minutes to a date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

/**
 * Gets start of day
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Gets end of day
 */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ============================================
// CURRENCY UTILITIES
// ============================================

/**
 * Formats price in CHF
 */
export function formatChf(amountCents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(amountCents / 100);
}

/**
 * Formats price without currency symbol
 */
export function formatPrice(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Capitalizes first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncates string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Generates initials from name
 */
export function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  return `${first}${last}` || '??';
}

/**
 * Formats a phone number
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('41') && cleaned.length === 11) {
    return `+41 ${cleaned.slice(2, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9)}`;
  }

  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }

  return phone;
}

// ============================================
// DURATION UTILITIES
// ============================================

/**
 * Formats duration in minutes to human readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} Min.`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} Std.`;
  }

  return `${hours} Std. ${remainingMinutes} Min.`;
}

// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates Swiss phone number
 */
export function isValidSwissPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.startsWith('41') && cleaned.length === 11);
}

// ============================================
// ARRAY UTILITIES
// ============================================

/**
 * Groups array by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Removes duplicates from array by key
 */
export function uniqueBy<T>(array: T[], key: keyof T): T[] {
  const seen = new Set();
  return array.filter((item) => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

// ============================================
// ID UTILITIES
// ============================================

/**
 * Generates a simple ID for client-side use
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
