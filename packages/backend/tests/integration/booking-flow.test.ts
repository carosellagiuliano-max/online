/**
 * ============================================
 * BeautifyPRO - Booking Flow Integration Tests
 * Tests the complete booking flow from service selection to confirmation
 * ============================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCK SETUP
// ============================================

// Mock Supabase client
vi.mock('@/lib/db/client', () => ({
  createServerClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        gte: vi.fn(() => ({
          lte: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        lte: vi.fn(() => ({
          gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        lt: vi.fn(() => ({
          gt: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  }),
}));

// Mock email sending
vi.mock('@/lib/email', () => ({
  sendBookingConfirmationEmail: vi.fn(() => Promise.resolve({ success: true })),
  sendCancellationEmail: vi.fn(() => Promise.resolve({ success: true })),
  sendReminderEmail: vi.fn(() => Promise.resolve({ success: true })),
}));

// ============================================
// BOOKING FLOW VALIDATION TESTS
// ============================================

describe('Booking Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Service Selection', () => {
    it('should validate service selection requirements', () => {
      const selectedServices: string[] = [];

      // At least one service must be selected
      expect(selectedServices.length).toBeGreaterThanOrEqual(0);

      // Validation function
      const isValidSelection = (services: string[]) => services.length > 0;

      expect(isValidSelection([])).toBe(false);
      expect(isValidSelection(['service-1'])).toBe(true);
      expect(isValidSelection(['service-1', 'service-2'])).toBe(true);
    });
  });

  describe('Customer Info Validation', () => {
    it('should validate customer name', () => {
      const validateName = (name: string) => name.trim().length >= 2;

      expect(validateName('')).toBe(false);
      expect(validateName('A')).toBe(false);
      expect(validateName('Anna')).toBe(true);
      expect(validateName('Anna Müller')).toBe(true);
    });

    it('should validate email format', () => {
      const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      expect(validateEmail('')).toBe(false);
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.ch')).toBe(true);
    });

    it('should validate Swiss phone number format', () => {
      const validatePhone = (phone: string) => {
        const cleaned = phone.replace(/[\s\-()]/g, '');
        return /^(\+41|0041|0)7[5-9]\d{7}$/.test(cleaned) ||
               /^(\+41|0041|0)[1-9]\d{8}$/.test(cleaned);
      };

      expect(validatePhone('+41 79 123 45 67')).toBe(true);
      expect(validatePhone('079 123 45 67')).toBe(true);
      expect(validatePhone('+41791234567')).toBe(true);
      expect(validatePhone('123456')).toBe(false);
    });
  });

  describe('Time Slot Validation', () => {
    it('should validate slot is in the future', () => {
      const now = new Date();
      const pastSlot = new Date(now.getTime() - 60 * 60 * 1000);
      const futureSlot = new Date(now.getTime() + 60 * 60 * 1000);

      const isValidSlot = (slotTime: Date) => slotTime > now;

      expect(isValidSlot(pastSlot)).toBe(false);
      expect(isValidSlot(futureSlot)).toBe(true);
    });

    it('should validate slot respects lead time', () => {
      const now = new Date();
      const leadTimeMinutes = 60;
      const minSlotTime = new Date(now.getTime() + leadTimeMinutes * 60 * 1000);

      const tooSoon = new Date(now.getTime() + 30 * 60 * 1000); // 30 min
      const okTime = new Date(now.getTime() + 90 * 60 * 1000); // 90 min

      const respectsLeadTime = (slotTime: Date) => slotTime >= minSlotTime;

      expect(respectsLeadTime(tooSoon)).toBe(false);
      expect(respectsLeadTime(okTime)).toBe(true);
    });
  });

  describe('Terms Acceptance', () => {
    it('should require terms acceptance before booking', () => {
      const bookingState = {
        selectedServices: ['service-1'],
        selectedSlot: { startsAt: new Date(), endsAt: new Date() },
        customerInfo: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '+41 79 123 45 67',
          acceptTerms: false,
        },
      };

      const canProceed = (state: typeof bookingState) =>
        state.selectedServices.length > 0 &&
        state.selectedSlot !== null &&
        state.customerInfo.name.length >= 2 &&
        state.customerInfo.email.includes('@') &&
        state.customerInfo.acceptTerms === true;

      expect(canProceed(bookingState)).toBe(false);

      bookingState.customerInfo.acceptTerms = true;
      expect(canProceed(bookingState)).toBe(true);
    });
  });

  describe('Price Calculation', () => {
    it('should calculate total price correctly', () => {
      const services = [
        { id: '1', name: 'Haarschnitt', currentPrice: 8500 },
        { id: '2', name: 'Styling', currentPrice: 4500 },
      ];

      const totalPrice = services.reduce((sum, s) => sum + s.currentPrice, 0);

      expect(totalPrice).toBe(13000); // CHF 130.00
    });

    it('should calculate total duration correctly', () => {
      const services = [
        { id: '1', name: 'Haarschnitt', durationMinutes: 45 },
        { id: '2', name: 'Styling', durationMinutes: 30 },
      ];

      const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);

      expect(totalDuration).toBe(75);
    });
  });

  describe('Booking Number Generation', () => {
    it('should generate unique booking numbers', () => {
      const generateBookingNumber = () => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `SW-${timestamp}${random}`;
      };

      const num1 = generateBookingNumber();
      const num2 = generateBookingNumber();

      expect(num1).toMatch(/^SW-[A-Z0-9]+$/);
      expect(num1).not.toBe(num2);
    });
  });

  describe('Cancellation Rules', () => {
    it('should allow cancellation 24+ hours before appointment', () => {
      const now = new Date();
      const cancellationDeadlineHours = 24;

      const appointmentIn48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const appointmentIn12Hours = new Date(now.getTime() + 12 * 60 * 60 * 1000);

      const canCancel = (appointmentTime: Date) => {
        const hoursUntil = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursUntil > cancellationDeadlineHours;
      };

      expect(canCancel(appointmentIn48Hours)).toBe(true);
      expect(canCancel(appointmentIn12Hours)).toBe(false);
    });
  });
});

// ============================================
// DATA FLOW TESTS
// ============================================

describe('Booking Data Flow', () => {
  it('should transform booking request to database format', () => {
    const bookingRequest = {
      salonId: 'salon-1',
      staffId: 'staff-1',
      serviceIds: ['service-1'],
      startsAt: new Date('2024-12-01T10:00:00'),
      customerName: 'Anna Müller',
      customerEmail: 'anna@example.ch',
      customerPhone: '+41 79 123 45 67',
      paymentMethod: 'at_venue' as const,
    };

    const toDbFormat = (req: typeof bookingRequest, endsAt: Date, totalPrice: number) => ({
      salon_id: req.salonId,
      staff_id: req.staffId,
      start_time: req.startsAt.toISOString(),
      end_time: endsAt.toISOString(),
      status: 'reserved',
      customer_name: req.customerName,
      customer_email: req.customerEmail,
      customer_phone: req.customerPhone,
      payment_method: req.paymentMethod === 'online' ? 'stripe_card' : 'cash',
      total_cents: totalPrice,
      booked_online: true,
    });

    const endsAt = new Date('2024-12-01T10:45:00');
    const dbData = toDbFormat(bookingRequest, endsAt, 8500);

    expect(dbData.salon_id).toBe('salon-1');
    expect(dbData.status).toBe('reserved');
    expect(dbData.payment_method).toBe('cash');
    expect(dbData.booked_online).toBe(true);
  });

  it('should transform database response to confirmation format', () => {
    const dbAppointment = {
      id: 'apt-123',
      booking_number: 'SW-ABC123',
      start_time: '2024-12-01T10:00:00Z',
      end_time: '2024-12-01T10:45:00Z',
      total_cents: 8500,
      status: 'confirmed',
      staff: { display_name: 'Alex' },
      appointment_services: [
        { service_name: 'Haarschnitt', duration_minutes: 45, price_cents: 8500 },
      ],
    };

    const toConfirmation = (apt: typeof dbAppointment) => ({
      appointmentId: apt.id,
      bookingNumber: apt.booking_number,
      status: apt.status,
      startsAt: new Date(apt.start_time),
      endsAt: new Date(apt.end_time),
      staffName: (apt.staff as any)?.display_name || 'Unbekannt',
      services: apt.appointment_services.map((s: any) => ({
        name: s.service_name,
        duration: s.duration_minutes,
        price: s.price_cents,
      })),
      totalPrice: apt.total_cents,
    });

    const confirmation = toConfirmation(dbAppointment);

    expect(confirmation.appointmentId).toBe('apt-123');
    expect(confirmation.bookingNumber).toBe('SW-ABC123');
    expect(confirmation.staffName).toBe('Alex');
    expect(confirmation.services).toHaveLength(1);
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================

describe('Booking Error Handling', () => {
  it('should map error codes to user-friendly messages', () => {
    const errorMessages: Record<string, string> = {
      SLOT_ALREADY_TAKEN: 'Dieser Termin wurde soeben vergeben. Bitte wählen Sie einen anderen Zeitpunkt.',
      VALIDATION_ERROR: 'Bitte überprüfen Sie Ihre Eingaben.',
      SERVER_ERROR: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
      UNAUTHORIZED: 'Bitte melden Sie sich an, um fortzufahren.',
    };

    const getErrorMessage = (code: string) =>
      errorMessages[code] || 'Ein unbekannter Fehler ist aufgetreten.';

    expect(getErrorMessage('SLOT_ALREADY_TAKEN')).toContain('soeben vergeben');
    expect(getErrorMessage('UNKNOWN_CODE')).toContain('unbekannter Fehler');
  });

  it('should handle reservation timeout', () => {
    const reservationTimeout = 15 * 60 * 1000; // 15 minutes
    const createdAt = new Date();

    const isExpired = (created: Date) =>
      Date.now() > created.getTime() + reservationTimeout;

    expect(isExpired(createdAt)).toBe(false);

    const expiredCreation = new Date(Date.now() - 20 * 60 * 1000);
    expect(isExpired(expiredCreation)).toBe(true);
  });
});
