import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  formatDate,
  formatTime,
  formatDateTime,
  getDayName,
  getShortDayName,
  getMonthName,
  isToday,
  isPast,
  isFuture,
  addMinutes,
  startOfDay,
  endOfDay,
  formatChf,
  formatPrice,
  capitalize,
  truncate,
  getInitials,
  formatPhone,
  formatDuration,
  isValidEmail,
  isValidSwissPhone,
  groupBy,
  uniqueBy,
  generateId,
} from '@/lib/utils';

// ============================================
// STYLING UTILITIES
// ============================================

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('should merge tailwind classes correctly', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

// ============================================
// DATE UTILITIES
// ============================================

describe('formatDate', () => {
  it('should format date in Swiss format', () => {
    const date = new Date('2024-03-15');
    const result = formatDate(date);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/03/);
    expect(result).toMatch(/2024/);
  });

  it('should handle string dates', () => {
    const result = formatDate('2024-03-15');
    expect(result).toMatch(/15/);
  });
});

describe('formatTime', () => {
  it('should format time in 24h format', () => {
    const date = new Date('2024-03-15T14:30:00');
    const result = formatTime(date);
    expect(result).toMatch(/14/);
    expect(result).toMatch(/30/);
  });
});

describe('formatDateTime', () => {
  it('should format both date and time', () => {
    const date = new Date('2024-03-15T14:30:00');
    const result = formatDateTime(date);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/14/);
  });
});

describe('getDayName', () => {
  it('should return German day name from Date', () => {
    const monday = new Date('2024-03-18'); // Monday
    expect(getDayName(monday)).toBe('Montag');
  });

  it('should return German day name from index', () => {
    expect(getDayName(0)).toBe('Sonntag');
    expect(getDayName(1)).toBe('Montag');
    expect(getDayName(6)).toBe('Samstag');
  });
});

describe('getShortDayName', () => {
  it('should return short German day name', () => {
    expect(getShortDayName(0)).toBe('So');
    expect(getShortDayName(1)).toBe('Mo');
  });
});

describe('getMonthName', () => {
  it('should return German month name', () => {
    expect(getMonthName(0)).toBe('Januar');
    expect(getMonthName(2)).toBe('März');
    expect(getMonthName(11)).toBe('Dezember');
  });
});

describe('isToday', () => {
  it('should return true for today', () => {
    expect(isToday(new Date())).toBe(true);
  });

  it('should return false for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday)).toBe(false);
  });
});

describe('isPast', () => {
  it('should return true for past dates', () => {
    const past = new Date('2020-01-01');
    expect(isPast(past)).toBe(true);
  });

  it('should return false for future dates', () => {
    const future = new Date('2099-01-01');
    expect(isPast(future)).toBe(false);
  });
});

describe('isFuture', () => {
  it('should return true for future dates', () => {
    const future = new Date('2099-01-01');
    expect(isFuture(future)).toBe(true);
  });

  it('should return false for past dates', () => {
    const past = new Date('2020-01-01');
    expect(isFuture(past)).toBe(false);
  });
});

describe('addMinutes', () => {
  it('should add minutes to date', () => {
    const date = new Date('2024-03-15T10:00:00');
    const result = addMinutes(date, 30);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(30);
  });

  it('should handle crossing hour boundary', () => {
    const date = new Date('2024-03-15T10:45:00');
    const result = addMinutes(date, 30);
    expect(result.getHours()).toBe(11);
    expect(result.getMinutes()).toBe(15);
  });
});

describe('startOfDay', () => {
  it('should return start of day', () => {
    const date = new Date('2024-03-15T14:30:45');
    const result = startOfDay(date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });
});

describe('endOfDay', () => {
  it('should return end of day', () => {
    const date = new Date('2024-03-15T14:30:45');
    const result = endOfDay(date);
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
  });
});

// ============================================
// CURRENCY UTILITIES
// ============================================

describe('formatChf', () => {
  it('should format cents to CHF', () => {
    expect(formatChf(2500)).toMatch(/25/);
    expect(formatChf(2500)).toMatch(/CHF/);
  });

  it('should handle zero', () => {
    expect(formatChf(0)).toMatch(/0/);
  });
});

describe('formatPrice', () => {
  it('should format cents to decimal', () => {
    expect(formatPrice(2500)).toBe('25.00');
    expect(formatPrice(1999)).toBe('19.99');
  });
});

// ============================================
// STRING UTILITIES
// ============================================

describe('capitalize', () => {
  it('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('HELLO')).toBe('HELLO');
  });

  it('should handle empty string', () => {
    expect(capitalize('')).toBe('');
  });
});

describe('truncate', () => {
  it('should truncate long strings', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
  });

  it('should not truncate short strings', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });
});

describe('getInitials', () => {
  it('should return initials', () => {
    expect(getInitials('John', 'Doe')).toBe('JD');
  });

  it('should handle missing names', () => {
    expect(getInitials('John')).toBe('J');
    expect(getInitials(undefined, 'Doe')).toBe('D');
    expect(getInitials()).toBe('??');
  });
});

describe('formatPhone', () => {
  it('should format Swiss phone numbers', () => {
    expect(formatPhone('0791234567')).toBe('079 123 45 67');
  });

  it('should format international Swiss numbers', () => {
    expect(formatPhone('41791234567')).toBe('+41 79 123 45 67');
  });

  it('should return original if unknown format', () => {
    expect(formatPhone('123')).toBe('123');
  });
});

// ============================================
// DURATION UTILITIES
// ============================================

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

// ============================================
// VALIDATION UTILITIES
// ============================================

describe('isValidEmail', () => {
  it('should validate correct emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.co')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('invalid@')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
  });
});

describe('isValidSwissPhone', () => {
  it('should validate Swiss phone numbers', () => {
    expect(isValidSwissPhone('0791234567')).toBe(true);
    expect(isValidSwissPhone('41791234567')).toBe(true);
  });

  it('should reject invalid numbers', () => {
    expect(isValidSwissPhone('123')).toBe(false);
    expect(isValidSwissPhone('12345678901234')).toBe(false);
  });
});

// ============================================
// ARRAY UTILITIES
// ============================================

describe('groupBy', () => {
  it('should group array by key', () => {
    const items = [
      { category: 'a', value: 1 },
      { category: 'b', value: 2 },
      { category: 'a', value: 3 },
    ];
    const result = groupBy(items, 'category');
    expect(result.a).toHaveLength(2);
    expect(result.b).toHaveLength(1);
  });
});

describe('uniqueBy', () => {
  it('should remove duplicates by key', () => {
    const items = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 1, name: 'c' },
    ];
    const result = uniqueBy(items, 'id');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('a');
  });
});

// ============================================
// ID UTILITIES
// ============================================

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('should generate string IDs', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});
