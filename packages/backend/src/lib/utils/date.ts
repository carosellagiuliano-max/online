import { format, formatDistance, parseISO, addMinutes, isAfter, isBefore } from 'date-fns';
import { de } from 'date-fns/locale';

const TIMEZONE = 'Europe/Zurich';

// Format date for display
export function formatDate(date: Date | string, formatStr: string = 'dd.MM.yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: de });
}

// Format time for display
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm', { locale: de });
}

// Format date and time
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd.MM.yyyy HH:mm', { locale: de });
}

// Relative time (e.g., "in 2 Stunden")
export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistance(d, new Date(), { addSuffix: true, locale: de });
}

// German day names
export function getDayName(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEEE', { locale: de });
}

// Duration formatting
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} Min.`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} Std.`;
  }
  return `${hours} Std. ${mins} Min.`;
}

// Check if date is in the future
export function isFuture(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isAfter(d, new Date());
}

// Check if date is in the past
export function isPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isBefore(d, new Date());
}

// Add minutes to date
export function addMinutesToDate(date: Date, minutes: number): Date {
  return addMinutes(date, minutes);
}

export { parseISO };
