/**
 * ============================================
 * BeautifyPRO - Date Utils Tests
 * Unit tests for date handling utilities
 * ============================================
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// DATE UTILITY FUNCTIONS
// ============================================

/**
 * Format date for display (Swiss format)
 */
function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Format time for display (HH:MM)
 */
function formatDisplayTime(date: Date): string {
  return new Intl.DateTimeFormat('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format date and time
 */
function formatDateTime(date: Date): string {
  return `${formatDisplayDate(date)}, ${formatDisplayTime(date)}`;
}

/**
 * Get relative date string (Heute, Morgen, etc.)
 */
function getRelativeDateString(date: Date, referenceDate: Date = new Date()): string {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Heute';
  if (diffDays === 1) return 'Morgen';
  if (diffDays === -1) return 'Gestern';
  if (diffDays > 1 && diffDays < 7) return `In ${diffDays} Tagen`;
  if (diffDays >= 7 && diffDays < 14) return 'Nächste Woche';

  return formatDisplayDate(date);
}

/**
 * Get day name
 */
function getDayName(date: Date): string {
  return new Intl.DateTimeFormat('de-CH', { weekday: 'long' }).format(date);
}

/**
 * Get short day name
 */
function getShortDayName(date: Date): string {
  return new Intl.DateTimeFormat('de-CH', { weekday: 'short' }).format(date);
}

/**
 * Get month name
 */
function getMonthName(date: Date): string {
  return new Intl.DateTimeFormat('de-CH', { month: 'long' }).format(date);
}

/**
 * Check if date is today
 */
function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if date is in the past
 */
function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Check if date is in the future
 */
function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Get start of day
 */
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day
 */
function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Add days to date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add hours to date
 */
function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Add minutes to date
 */
function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/**
 * Get difference in minutes
 */
function diffInMinutes(date1: Date, date2: Date): number {
  return Math.round((date1.getTime() - date2.getTime()) / (1000 * 60));
}

/**
 * Get difference in hours
 */
function diffInHours(date1: Date, date2: Date): number {
  return Math.round((date1.getTime() - date2.getTime()) / (1000 * 60 * 60));
}

/**
 * Get difference in days
 */
function diffInDays(date1: Date, date2: Date): number {
  return Math.round((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Parse time string to Date
 */
function parseTimeString(timeString: string, baseDate: Date = new Date()): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Check if two dates are on the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

/**
 * Get week number (ISO)
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Format duration in minutes to readable string
 */
function formatDuration(minutes: number): string {
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

// ============================================
// UNIT TESTS
// ============================================

describe('Date Utils', () => {
  describe('formatDisplayDate', () => {
    it('should format date in Swiss format (DD.MM.YYYY)', () => {
      const date = new Date('2024-12-25');
      const formatted = formatDisplayDate(date);
      expect(formatted).toMatch(/25/);
      expect(formatted).toMatch(/12/);
      expect(formatted).toMatch(/2024/);
    });
  });

  describe('formatDisplayTime', () => {
    it('should format time in 24h format', () => {
      const date = new Date('2024-01-15T14:30:00');
      const formatted = formatDisplayTime(date);
      expect(formatted).toMatch(/14/);
      expect(formatted).toMatch(/30/);
    });

    it('should handle midnight', () => {
      const date = new Date('2024-01-15T00:00:00');
      const formatted = formatDisplayTime(date);
      expect(formatted).toMatch(/00/);
    });
  });

  describe('getRelativeDateString', () => {
    const baseDate = new Date('2024-06-15T12:00:00');

    it('should return "Heute" for today', () => {
      expect(getRelativeDateString(baseDate, baseDate)).toBe('Heute');
    });

    it('should return "Morgen" for tomorrow', () => {
      const tomorrow = addDays(baseDate, 1);
      expect(getRelativeDateString(tomorrow, baseDate)).toBe('Morgen');
    });

    it('should return "Gestern" for yesterday', () => {
      const yesterday = addDays(baseDate, -1);
      expect(getRelativeDateString(yesterday, baseDate)).toBe('Gestern');
    });

    it('should return "In X Tagen" for 2-6 days ahead', () => {
      const in3Days = addDays(baseDate, 3);
      expect(getRelativeDateString(in3Days, baseDate)).toBe('In 3 Tagen');
    });

    it('should return "Nächste Woche" for 7-13 days ahead', () => {
      const nextWeek = addDays(baseDate, 7);
      expect(getRelativeDateString(nextWeek, baseDate)).toBe('Nächste Woche');
    });

    it('should return formatted date for dates further away', () => {
      const farDate = addDays(baseDate, 30);
      const result = getRelativeDateString(farDate, baseDate);
      expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    });
  });

  describe('getDayName', () => {
    it('should return German day names', () => {
      // Monday = 1, so we need to find a Monday
      const monday = new Date('2024-01-15'); // This is a Monday
      const dayName = getDayName(monday);
      expect(dayName).toBe('Montag');
    });
  });

  describe('getShortDayName', () => {
    it('should return short German day names', () => {
      const monday = new Date('2024-01-15');
      const shortName = getShortDayName(monday);
      expect(shortName).toMatch(/Mo/);
    });
  });

  describe('getMonthName', () => {
    it('should return German month names', () => {
      const january = new Date('2024-01-15');
      const monthName = getMonthName(january);
      expect(monthName).toBe('Januar');

      const december = new Date('2024-12-15');
      expect(getMonthName(december)).toBe('Dezember');
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      expect(isToday(new Date())).toBe(true);
    });

    it('should return false for other days', () => {
      const yesterday = addDays(new Date(), -1);
      const tomorrow = addDays(new Date(), 1);
      expect(isToday(yesterday)).toBe(false);
      expect(isToday(tomorrow)).toBe(false);
    });
  });

  describe('isPast', () => {
    it('should return true for past dates', () => {
      const pastDate = addDays(new Date(), -1);
      expect(isPast(pastDate)).toBe(true);
    });

    it('should return false for future dates', () => {
      const futureDate = addDays(new Date(), 1);
      expect(isPast(futureDate)).toBe(false);
    });
  });

  describe('isFuture', () => {
    it('should return true for future dates', () => {
      const futureDate = addDays(new Date(), 1);
      expect(isFuture(futureDate)).toBe(true);
    });

    it('should return false for past dates', () => {
      const pastDate = addDays(new Date(), -1);
      expect(isFuture(pastDate)).toBe(false);
    });
  });

  describe('startOfDay', () => {
    it('should return date at 00:00:00', () => {
      const date = new Date('2024-06-15T14:30:45');
      const start = startOfDay(date);

      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    });

    it('should preserve the date', () => {
      const date = new Date('2024-06-15T14:30:45');
      const start = startOfDay(date);

      expect(start.getFullYear()).toBe(2024);
      expect(start.getMonth()).toBe(5); // June = 5
      expect(start.getDate()).toBe(15);
    });
  });

  describe('endOfDay', () => {
    it('should return date at 23:59:59.999', () => {
      const date = new Date('2024-06-15T14:30:45');
      const end = endOfDay(date);

      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
      expect(end.getMilliseconds()).toBe(999);
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      const date = new Date('2024-06-15');
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(20);
    });

    it('should subtract with negative days', () => {
      const date = new Date('2024-06-15');
      const result = addDays(date, -5);
      expect(result.getDate()).toBe(10);
    });

    it('should handle month boundaries', () => {
      const date = new Date('2024-06-30');
      const result = addDays(date, 2);
      expect(result.getMonth()).toBe(6); // July
      expect(result.getDate()).toBe(2);
    });
  });

  describe('addHours', () => {
    it('should add hours', () => {
      const date = new Date('2024-06-15T10:00:00');
      const result = addHours(date, 3);
      expect(result.getHours()).toBe(13);
    });

    it('should handle day boundaries', () => {
      const date = new Date('2024-06-15T23:00:00');
      const result = addHours(date, 3);
      expect(result.getDate()).toBe(16);
      expect(result.getHours()).toBe(2);
    });
  });

  describe('addMinutes', () => {
    it('should add minutes', () => {
      const date = new Date('2024-06-15T10:30:00');
      const result = addMinutes(date, 45);
      expect(result.getHours()).toBe(11);
      expect(result.getMinutes()).toBe(15);
    });
  });

  describe('diffInMinutes', () => {
    it('should calculate positive difference', () => {
      const date1 = new Date('2024-06-15T10:30:00');
      const date2 = new Date('2024-06-15T10:00:00');
      expect(diffInMinutes(date1, date2)).toBe(30);
    });

    it('should calculate negative difference', () => {
      const date1 = new Date('2024-06-15T10:00:00');
      const date2 = new Date('2024-06-15T10:30:00');
      expect(diffInMinutes(date1, date2)).toBe(-30);
    });
  });

  describe('diffInHours', () => {
    it('should calculate hour difference', () => {
      const date1 = new Date('2024-06-15T15:00:00');
      const date2 = new Date('2024-06-15T10:00:00');
      expect(diffInHours(date1, date2)).toBe(5);
    });
  });

  describe('diffInDays', () => {
    it('should calculate day difference', () => {
      const date1 = new Date('2024-06-20');
      const date2 = new Date('2024-06-15');
      expect(diffInDays(date1, date2)).toBe(5);
    });
  });

  describe('parseTimeString', () => {
    it('should parse time string', () => {
      const baseDate = new Date('2024-06-15T00:00:00');
      const result = parseTimeString('14:30', baseDate);

      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getDate()).toBe(15);
    });

    it('should handle midnight', () => {
      const result = parseTimeString('00:00');
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day', () => {
      const date1 = new Date('2024-06-15T10:00:00');
      const date2 = new Date('2024-06-15T18:00:00');
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for different days', () => {
      const date1 = new Date('2024-06-15');
      const date2 = new Date('2024-06-16');
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });

  describe('getWeekNumber', () => {
    it('should return correct week number', () => {
      const date = new Date('2024-01-01');
      const weekNum = getWeekNumber(date);
      expect(weekNum).toBe(1);
    });

    it('should handle week 52/53', () => {
      const date = new Date('2024-12-31');
      const weekNum = getWeekNumber(date);
      expect(weekNum).toBeGreaterThanOrEqual(1);
      expect(weekNum).toBeLessThanOrEqual(53);
    });
  });

  describe('formatDuration', () => {
    it('should format minutes only', () => {
      expect(formatDuration(30)).toBe('30 Min.');
      expect(formatDuration(45)).toBe('45 Min.');
    });

    it('should format hours only', () => {
      expect(formatDuration(60)).toBe('1 Std.');
      expect(formatDuration(120)).toBe('2 Std.');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(90)).toBe('1 Std. 30 Min.');
      expect(formatDuration(150)).toBe('2 Std. 30 Min.');
    });
  });
});

describe('Date Scenarios', () => {
  describe('Appointment Booking Window', () => {
    it('should calculate booking window (1 hour lead time)', () => {
      const now = new Date();
      const leadTimeMinutes = 60;
      const earliestBooking = addMinutes(now, leadTimeMinutes);

      expect(earliestBooking.getTime()).toBeGreaterThan(now.getTime());
      expect(diffInMinutes(earliestBooking, now)).toBe(60);
    });

    it('should calculate booking horizon (30 days)', () => {
      const now = new Date();
      const horizonDays = 30;
      const latestBooking = addDays(now, horizonDays);

      expect(diffInDays(latestBooking, now)).toBe(30);
    });
  });

  describe('Reminder Timing', () => {
    it('should calculate 24h reminder time', () => {
      const appointmentTime = new Date('2024-06-15T14:00:00');
      const reminderTime = addHours(appointmentTime, -24);

      expect(reminderTime.getDate()).toBe(14);
      expect(reminderTime.getHours()).toBe(14);
    });

    it('should calculate 1h reminder time', () => {
      const appointmentTime = new Date('2024-06-15T14:00:00');
      const reminderTime = addHours(appointmentTime, -1);

      expect(reminderTime.getDate()).toBe(15);
      expect(reminderTime.getHours()).toBe(13);
    });
  });

  describe('Working Hours', () => {
    it('should check if time is within working hours', () => {
      const openTime = parseTimeString('09:00');
      const closeTime = parseTimeString('18:00');
      const testTime = parseTimeString('14:30');

      const isWithinHours = testTime >= openTime && testTime <= closeTime;
      expect(isWithinHours).toBe(true);
    });

    it('should check if time is outside working hours', () => {
      const openTime = parseTimeString('09:00');
      const closeTime = parseTimeString('18:00');
      const testTime = parseTimeString('08:00');

      const isWithinHours = testTime >= openTime && testTime <= closeTime;
      expect(isWithinHours).toBe(false);
    });
  });
});
