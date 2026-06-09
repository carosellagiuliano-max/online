/**
 * ============================================
 * BeautifyPRO - Validators Tests
 * Unit tests for input validation functions
 * ============================================
 */

import { describe, it, expect } from 'vitest';

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Email validation
 */
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Swiss phone number validation
 */
function isValidSwissPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  // Swiss mobile: 07x xxx xx xx
  // Swiss landline: 0xx xxx xx xx
  // International: +41 xx xxx xx xx
  return /^(\+41|0041|0)[1-9]\d{8}$/.test(cleaned);
}

/**
 * Swiss postal code validation
 */
function isValidSwissZip(zip: string): boolean {
  if (!zip || typeof zip !== 'string') return false;
  // Swiss postal codes are 4 digits, starting with 1-9
  return /^[1-9]\d{3}$/.test(zip.trim());
}

/**
 * Name validation (min 2 chars, no numbers)
 */
function isValidName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && !/\d/.test(trimmed);
}

/**
 * Price validation (positive integer in cents)
 */
function isValidPriceCents(cents: number): boolean {
  return Number.isInteger(cents) && cents >= 0;
}

/**
 * Quantity validation
 */
function isValidQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1;
}

/**
 * UUID validation
 */
function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

/**
 * Time string validation (HH:MM)
 */
function isValidTimeString(time: string): boolean {
  if (!time || typeof time !== 'string') return false;
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Duration validation (in minutes)
 */
function isValidDurationMinutes(duration: number): boolean {
  return Number.isInteger(duration) && duration >= 5 && duration <= 480; // 5 min to 8 hours
}

/**
 * Date range validation
 */
function isValidDateRange(start: Date, end: Date): boolean {
  return start instanceof Date && end instanceof Date && start <= end;
}

/**
 * Booking notes validation
 */
function isValidBookingNotes(notes: string | undefined): boolean {
  if (notes === undefined || notes === null || notes === '') return true;
  if (typeof notes !== 'string') return false;
  return notes.length <= 500; // Max 500 characters
}

/**
 * Voucher code validation
 */
function isValidVoucherCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  // Alphanumeric, 4-20 chars, uppercase
  return /^[A-Z0-9]{4,20}$/.test(code.toUpperCase());
}

// ============================================
// UNIT TESTS
// ============================================

describe('Validators', () => {
  describe('isValidEmail', () => {
    it('should accept valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
      expect(isValidEmail('a@b.co')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('no@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('no@.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isValidEmail(null as any)).toBe(false);
      expect(isValidEmail(undefined as any)).toBe(false);
      expect(isValidEmail(123 as any)).toBe(false);
    });

    it('should trim whitespace', () => {
      expect(isValidEmail('  test@example.com  ')).toBe(true);
    });
  });

  describe('isValidSwissPhone', () => {
    it('should accept valid Swiss mobile numbers', () => {
      expect(isValidSwissPhone('0791234567')).toBe(true);
      expect(isValidSwissPhone('079 123 45 67')).toBe(true);
      expect(isValidSwissPhone('079-123-45-67')).toBe(true);
      expect(isValidSwissPhone('+41791234567')).toBe(true);
      expect(isValidSwissPhone('+41 79 123 45 67')).toBe(true);
    });

    it('should accept valid Swiss landline numbers', () => {
      expect(isValidSwissPhone('0712345678')).toBe(true);
      expect(isValidSwissPhone('044 123 45 67')).toBe(true);
      expect(isValidSwissPhone('+41 44 123 45 67')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidSwissPhone('')).toBe(false);
      expect(isValidSwissPhone('123')).toBe(false);
      expect(isValidSwissPhone('00791234567890')).toBe(false); // Too long
      expect(isValidSwissPhone('079123456')).toBe(false); // Too short
    });

    it('should handle edge cases', () => {
      expect(isValidSwissPhone(null as any)).toBe(false);
      expect(isValidSwissPhone(undefined as any)).toBe(false);
    });
  });

  describe('isValidSwissZip', () => {
    it('should accept valid Swiss postal codes', () => {
      expect(isValidSwissZip('9000')).toBe(true); // St. Gallen
      expect(isValidSwissZip('8000')).toBe(true); // Zürich
      expect(isValidSwissZip('1000')).toBe(true); // Lausanne
      expect(isValidSwissZip('3000')).toBe(true); // Bern
    });

    it('should reject invalid postal codes', () => {
      expect(isValidSwissZip('')).toBe(false);
      expect(isValidSwissZip('0000')).toBe(false); // Starts with 0
      expect(isValidSwissZip('999')).toBe(false); // Too short
      expect(isValidSwissZip('90000')).toBe(false); // Too long
      expect(isValidSwissZip('9OOO')).toBe(false); // Contains letters
    });

    it('should trim whitespace', () => {
      expect(isValidSwissZip(' 9000 ')).toBe(true);
    });
  });

  describe('isValidName', () => {
    it('should accept valid names', () => {
      expect(isValidName('Max')).toBe(true);
      expect(isValidName('Anna-Maria')).toBe(true);
      expect(isValidName('Jean-Pierre')).toBe(true);
      expect(isValidName("O'Brien")).toBe(true);
      expect(isValidName('Müller')).toBe(true);
      expect(isValidName('José')).toBe(true);
    });

    it('should reject names with numbers', () => {
      expect(isValidName('Max123')).toBe(false);
      expect(isValidName('User1')).toBe(false);
    });

    it('should reject too short names', () => {
      expect(isValidName('')).toBe(false);
      expect(isValidName('A')).toBe(false);
    });

    it('should trim whitespace', () => {
      expect(isValidName('  Max  ')).toBe(true);
    });
  });

  describe('isValidPriceCents', () => {
    it('should accept valid prices', () => {
      expect(isValidPriceCents(0)).toBe(true);
      expect(isValidPriceCents(100)).toBe(true);
      expect(isValidPriceCents(8500)).toBe(true);
      expect(isValidPriceCents(999999)).toBe(true);
    });

    it('should reject negative prices', () => {
      expect(isValidPriceCents(-1)).toBe(false);
      expect(isValidPriceCents(-100)).toBe(false);
    });

    it('should reject non-integer prices', () => {
      expect(isValidPriceCents(10.5)).toBe(false);
      expect(isValidPriceCents(99.99)).toBe(false);
    });
  });

  describe('isValidQuantity', () => {
    it('should accept valid quantities', () => {
      expect(isValidQuantity(1)).toBe(true);
      expect(isValidQuantity(10)).toBe(true);
      expect(isValidQuantity(100)).toBe(true);
    });

    it('should reject zero or negative', () => {
      expect(isValidQuantity(0)).toBe(false);
      expect(isValidQuantity(-1)).toBe(false);
    });

    it('should reject non-integer', () => {
      expect(isValidQuantity(1.5)).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should accept valid UUIDs', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should accept uppercase UUIDs', () => {
      expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false); // Too short
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000-extra')).toBe(false); // Too long
    });
  });

  describe('isValidTimeString', () => {
    it('should accept valid time strings', () => {
      expect(isValidTimeString('00:00')).toBe(true);
      expect(isValidTimeString('09:00')).toBe(true);
      expect(isValidTimeString('12:30')).toBe(true);
      expect(isValidTimeString('23:59')).toBe(true);
    });

    it('should reject invalid time strings', () => {
      expect(isValidTimeString('')).toBe(false);
      expect(isValidTimeString('9:00')).toBe(false); // Single digit hour
      expect(isValidTimeString('09:0')).toBe(false); // Single digit minute
      expect(isValidTimeString('24:00')).toBe(false); // Invalid hour
      expect(isValidTimeString('12:60')).toBe(false); // Invalid minute
      expect(isValidTimeString('12:30:00')).toBe(false); // With seconds
    });
  });

  describe('isValidDurationMinutes', () => {
    it('should accept valid durations', () => {
      expect(isValidDurationMinutes(5)).toBe(true); // Minimum
      expect(isValidDurationMinutes(30)).toBe(true);
      expect(isValidDurationMinutes(60)).toBe(true);
      expect(isValidDurationMinutes(120)).toBe(true);
      expect(isValidDurationMinutes(480)).toBe(true); // Maximum (8 hours)
    });

    it('should reject too short durations', () => {
      expect(isValidDurationMinutes(0)).toBe(false);
      expect(isValidDurationMinutes(4)).toBe(false);
    });

    it('should reject too long durations', () => {
      expect(isValidDurationMinutes(481)).toBe(false);
      expect(isValidDurationMinutes(1000)).toBe(false);
    });
  });

  describe('isValidDateRange', () => {
    it('should accept valid date ranges', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      expect(isValidDateRange(start, end)).toBe(true);
    });

    it('should accept same start and end date', () => {
      const date = new Date('2024-01-15');
      expect(isValidDateRange(date, date)).toBe(true);
    });

    it('should reject end before start', () => {
      const start = new Date('2024-01-31');
      const end = new Date('2024-01-01');
      expect(isValidDateRange(start, end)).toBe(false);
    });

    it('should reject invalid dates', () => {
      expect(isValidDateRange('invalid' as any, new Date())).toBe(false);
      expect(isValidDateRange(new Date(), 'invalid' as any)).toBe(false);
    });
  });

  describe('isValidBookingNotes', () => {
    it('should accept empty notes', () => {
      expect(isValidBookingNotes('')).toBe(true);
      expect(isValidBookingNotes(undefined)).toBe(true);
    });

    it('should accept valid notes', () => {
      expect(isValidBookingNotes('Bitte keine Produkte verwenden')).toBe(true);
      expect(isValidBookingNotes('Allergiker')).toBe(true);
    });

    it('should reject too long notes', () => {
      const longNotes = 'a'.repeat(501);
      expect(isValidBookingNotes(longNotes)).toBe(false);
    });

    it('should accept max length notes', () => {
      const maxNotes = 'a'.repeat(500);
      expect(isValidBookingNotes(maxNotes)).toBe(true);
    });
  });

  describe('isValidVoucherCode', () => {
    it('should accept valid voucher codes', () => {
      expect(isValidVoucherCode('SAVE10')).toBe(true);
      expect(isValidVoucherCode('SPRING2024')).toBe(true);
      expect(isValidVoucherCode('ABCD')).toBe(true); // Minimum length
      expect(isValidVoucherCode('A1B2C3D4E5F6G7H8I9J0')).toBe(true); // Maximum length
    });

    it('should be case insensitive', () => {
      expect(isValidVoucherCode('save10')).toBe(true);
      expect(isValidVoucherCode('Save10')).toBe(true);
    });

    it('should reject too short codes', () => {
      expect(isValidVoucherCode('ABC')).toBe(false);
      expect(isValidVoucherCode('')).toBe(false);
    });

    it('should reject too long codes', () => {
      expect(isValidVoucherCode('A'.repeat(21))).toBe(false);
    });

    it('should reject special characters', () => {
      expect(isValidVoucherCode('SAVE-10')).toBe(false);
      expect(isValidVoucherCode('SAVE_10')).toBe(false);
      expect(isValidVoucherCode('SAVE 10')).toBe(false);
    });
  });
});

describe('Validation Scenarios', () => {
  describe('Booking Form Validation', () => {
    interface BookingFormData {
      email: string;
      phone: string;
      name: string;
      notes?: string;
    }

    function validateBookingForm(data: BookingFormData): string[] {
      const errors: string[] = [];

      if (!isValidEmail(data.email)) {
        errors.push('Ungültige E-Mail-Adresse');
      }
      if (!isValidSwissPhone(data.phone)) {
        errors.push('Ungültige Telefonnummer');
      }
      if (!isValidName(data.name)) {
        errors.push('Ungültiger Name');
      }
      if (!isValidBookingNotes(data.notes)) {
        errors.push('Notizen zu lang (max. 500 Zeichen)');
      }

      return errors;
    }

    it('should validate complete form', () => {
      const validForm: BookingFormData = {
        email: 'kunde@example.com',
        phone: '079 123 45 67',
        name: 'Max Muster',
        notes: 'Keine besonderen Wünsche',
      };

      expect(validateBookingForm(validForm)).toHaveLength(0);
    });

    it('should catch all errors', () => {
      const invalidForm: BookingFormData = {
        email: 'invalid',
        phone: '123',
        name: 'X',
        notes: 'a'.repeat(600),
      };

      const errors = validateBookingForm(invalidForm);
      expect(errors).toHaveLength(4);
    });
  });

  describe('Address Validation', () => {
    interface AddressData {
      name: string;
      street: string;
      zip: string;
      city: string;
    }

    function validateAddress(data: AddressData): boolean {
      return (
        isValidName(data.name) &&
        data.street.length >= 3 &&
        isValidSwissZip(data.zip) &&
        isValidName(data.city)
      );
    }

    it('should validate Swiss address', () => {
      const validAddress: AddressData = {
        name: 'Max Muster',
        street: 'Bahnhofstrasse 1',
        zip: '9000',
        city: 'St. Gallen',
      };

      expect(validateAddress(validAddress)).toBe(true);
    });

    it('should reject invalid address', () => {
      const invalidAddress: AddressData = {
        name: 'M',
        street: 'AB',
        zip: '123',
        city: 'X',
      };

      expect(validateAddress(invalidAddress)).toBe(false);
    });
  });
});
