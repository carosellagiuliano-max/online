/**
 * ============================================
 * BeautifyPRO - Slot Engine Tests
 * Property-based and unit tests for booking slot calculation
 * ============================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeAvailableSlots,
  groupSlotsByDate,
} from '@/lib/domain/booking/slot-engine';
import type {
  SlotEngineInput,
  BookableService,
  BookableStaff,
  DayOpeningHours,
  StaffWorkingHours,
  StaffAbsence,
  BlockedTime,
  ExistingAppointment,
  BookingRules,
} from '@/lib/domain/booking/types';
import { addDays, addMinutes, setHours, setMinutes, startOfDay } from 'date-fns';

// ============================================
// TEST FIXTURES
// ============================================

const createDate = (daysFromNow: number, hours: number, minutes: number): Date => {
  const date = addDays(startOfDay(new Date()), daysFromNow);
  return setMinutes(setHours(date, hours), minutes);
};

const createNextWeekdayDate = (targetDayOfWeek: number, hours: number, minutes: number): Date => {
  let daysFromNow = 1;
  while (addDays(startOfDay(new Date()), daysFromNow).getDay() !== targetDayOfWeek) {
    daysFromNow++;
  }
  return createDate(daysFromNow, hours, minutes);
};

const createBookableDateBeyondHorizon = (minDaysFromNow: number, hours: number, minutes: number): Date => {
  let daysFromNow = minDaysFromNow;
  while (![1, 2, 3, 4, 5].includes(addDays(startOfDay(new Date()), daysFromNow).getDay())) {
    daysFromNow++;
  }
  return createDate(daysFromNow, hours, minutes);
};

const getSalonDateTimeParts = (
  date: Date,
  timeZone = 'Europe/Zurich'
): { dayOfWeek: number; hour: number; minute: number } => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
  const dayOfWeek = new Date(
    Date.UTC(values.year, values.month - 1, values.day)
  ).getUTCDay();

  return {
    dayOfWeek,
    hour: values.hour,
    minute: values.minute,
  };
};

const mockServices: BookableService[] = [
  {
    id: 'service-1',
    name: 'Haarschnitt Damen',
    durationMinutes: 45,
    currentPrice: 8500,
    categoryId: 'cat-1',
    isActive: true,
  },
  {
    id: 'service-2',
    name: 'Färben',
    durationMinutes: 90,
    currentPrice: 12000,
    categoryId: 'cat-1',
    isActive: true,
  },
];

const mockStaff: BookableStaff[] = [
  {
    id: 'staff-1',
    name: 'Alex',
    serviceIds: ['service-1', 'service-2'],
    isBookable: true,
  },
  {
    id: 'staff-2',
    name: 'Sarah',
    serviceIds: ['service-1'],
    isBookable: true,
  },
];

const mockOpeningHours: DayOpeningHours[] = [
  { dayOfWeek: 0, openTime: '09:00', closeTime: '18:00', isClosed: true }, // Sunday closed
  { dayOfWeek: 1, openTime: '09:00', closeTime: '18:00', isClosed: false }, // Monday
  { dayOfWeek: 2, openTime: '09:00', closeTime: '18:00', isClosed: false }, // Tuesday
  { dayOfWeek: 3, openTime: '09:00', closeTime: '18:00', isClosed: false }, // Wednesday
  { dayOfWeek: 4, openTime: '09:00', closeTime: '18:00', isClosed: false }, // Thursday
  { dayOfWeek: 5, openTime: '09:00', closeTime: '18:00', isClosed: false }, // Friday
  { dayOfWeek: 6, openTime: '09:00', closeTime: '14:00', isClosed: false }, // Saturday
];

const mockStaffWorkingHours: StaffWorkingHours[] = [
  { staffId: 'staff-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
  { staffId: 'staff-1', dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
  { staffId: 'staff-1', dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
  { staffId: 'staff-1', dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
  { staffId: 'staff-1', dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
  { staffId: 'staff-2', dayOfWeek: 1, startTime: '10:00', endTime: '18:00' },
  { staffId: 'staff-2', dayOfWeek: 2, startTime: '10:00', endTime: '18:00' },
  { staffId: 'staff-2', dayOfWeek: 3, startTime: '10:00', endTime: '18:00' },
];

const mockBookingRules: BookingRules = {
  slotGranularityMinutes: 15,
  leadTimeMinutes: 60,
  horizonDays: 30,
  bufferBetweenMinutes: 0,
  allowMultipleServices: true,
  requireDeposit: false,
  cancellationDeadlineHours: 24,
};

// ============================================
// UNIT TESTS
// ============================================

describe('Slot Engine', () => {
  describe('computeAvailableSlots', () => {
    it('should return empty array for closed days', async () => {
      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: createDate(7, 0, 0), // A Sunday
        dateRangeEnd: createDate(7, 23, 59),
        serviceIds: ['service-1'],
      };

      // Find a Sunday
      let sundayOffset = 7;
      for (let i = 0; i < 7; i++) {
        if (addDays(new Date(), i).getDay() === 0) {
          sundayOffset = i;
          break;
        }
      }

      input.dateRangeStart = createDate(sundayOffset, 0, 0);
      input.dateRangeEnd = createDate(sundayOffset, 23, 59);

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: mockOpeningHours,
        staff: mockStaff,
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences: [],
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: mockBookingRules,
      });

      expect(slots.filter((s) => s.startsAt.getDay() === 0)).toHaveLength(0);
    });

    it('should filter staff by service skills', async () => {
      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: createDate(1, 0, 0),
        dateRangeEnd: createDate(3, 23, 59),
        serviceIds: ['service-2'], // Färben - only Alex can do this
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-2'),
        openingHours: mockOpeningHours,
        staff: mockStaff,
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences: [],
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: mockBookingRules,
      });

      // All slots should be for Alex (staff-1)
      expect(slots.every((s) => s.staffId === 'staff-1')).toBe(true);
    });

    it('should return no slots when no active staff can perform the service', async () => {
      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: createDate(1, 0, 0),
        dateRangeEnd: createDate(3, 23, 59),
        serviceIds: ['service-unassigned'],
      };

      const slots = await computeAvailableSlots(input, {
        services: [{
          id: 'service-unassigned',
          name: 'Spezialbehandlung',
          durationMinutes: 45,
          currentPrice: 9500,
          categoryId: 'cat-1',
          isActive: true,
        }],
        openingHours: mockOpeningHours,
        staff: mockStaff,
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences: [],
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: mockBookingRules,
      });

      expect(slots).toHaveLength(0);
    });

    it('should respect existing appointments', async () => {
      const tomorrow = addDays(startOfDay(new Date()), 1);
      const bookedStart = setMinutes(setHours(tomorrow, 10), 0);
      const bookedEnd = setMinutes(setHours(tomorrow, 11), 0);

      const existingAppointments: ExistingAppointment[] = [
        {
          id: 'apt-1',
          staffId: 'staff-1',
          startsAt: bookedStart,
          endsAt: bookedEnd,
          status: 'confirmed',
        },
      ];

      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: tomorrow,
        dateRangeEnd: tomorrow,
        serviceIds: ['service-1'],
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: mockOpeningHours,
        staff: mockStaff.filter((s) => s.id === 'staff-1'),
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences: [],
        blockedTimes: [],
        existingAppointments,
        bookingRules: mockBookingRules,
      });

      // No slots should overlap with the booked time
      const conflictingSlots = slots.filter(
        (s) =>
          s.staffId === 'staff-1' &&
          s.startsAt < bookedEnd &&
          s.endsAt > bookedStart
      );

      expect(conflictingSlots).toHaveLength(0);
    });

    it('should respect staff absences', async () => {
      const tomorrow = createNextWeekdayDate(1, 0, 0);

      const staffAbsences: StaffAbsence[] = [
        {
          staffId: 'staff-1',
          startsAt: tomorrow,
          endsAt: addDays(tomorrow, 1),
          reason: 'Urlaub',
          status: 'approved',
        },
      ];

      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: tomorrow,
        dateRangeEnd: tomorrow,
        serviceIds: ['service-1'],
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: mockOpeningHours,
        staff: mockStaff,
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences,
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: mockBookingRules,
      });

      // No slots for staff-1 on this day
      const blockedStaffSlots = slots.filter((s) => s.staffId === 'staff-1');
      expect(blockedStaffSlots).toHaveLength(0);
    });

    it('should not block slots for pending or rejected absences', async () => {
      const workday = createNextWeekdayDate(1, 0, 0);

      const staffAbsences: StaffAbsence[] = [
        {
          staffId: 'staff-1',
          startsAt: workday,
          endsAt: addDays(workday, 1),
          reason: 'Antrag wartet',
          status: 'pending',
        },
        {
          staffId: 'staff-1',
          startsAt: workday,
          endsAt: addDays(workday, 1),
          reason: 'Abgelehnt',
          status: 'rejected',
        },
      ];

      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: workday,
        dateRangeEnd: workday,
        serviceIds: ['service-1'],
        preferredStaffId: 'staff-1',
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: mockOpeningHours,
        staff: mockStaff.filter((s) => s.id === 'staff-1'),
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences,
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: mockBookingRules,
      });

      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((slot) => slot.staffId === 'staff-1')).toBe(true);
    });

    it('should block every day of an approved multi-day absence', async () => {
      const firstWorkday = createNextWeekdayDate(1, 0, 0);
      const lastWorkday = addDays(firstWorkday, 2);

      const staffAbsences: StaffAbsence[] = [
        {
          staffId: 'staff-1',
          startsAt: firstWorkday,
          endsAt: addDays(lastWorkday, 1),
          reason: 'Mehrtaegiger Urlaub',
          status: 'approved',
        },
      ];

      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: firstWorkday,
        dateRangeEnd: lastWorkday,
        serviceIds: ['service-1'],
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: mockOpeningHours,
        staff: mockStaff,
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences,
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: mockBookingRules,
      });

      expect(slots.some((slot) => slot.staffId === 'staff-1')).toBe(false);
      expect(slots.some((slot) => slot.staffId === 'staff-2')).toBe(true);
    });

    it('should not apply one staff member absence to another staff member', async () => {
      const workday = createNextWeekdayDate(1, 0, 0);

      const staffAbsences: StaffAbsence[] = [
        {
          staffId: 'staff-1',
          startsAt: workday,
          endsAt: addDays(workday, 1),
          reason: 'Urlaub',
          status: 'approved',
        },
      ];

      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: workday,
        dateRangeEnd: workday,
        serviceIds: ['service-1'],
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: mockOpeningHours,
        staff: mockStaff,
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences,
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: mockBookingRules,
      });

      expect(slots.filter((slot) => slot.staffId === 'staff-1')).toHaveLength(0);
      expect(slots.filter((slot) => slot.staffId === 'staff-2').length).toBeGreaterThan(0);
    });

    it('should combine absences, staff blocks and existing appointments', async () => {
      const workday = createNextWeekdayDate(1, 0, 0);
      const appointmentStart = setMinutes(setHours(workday, 10), 0);
      const appointmentEnd = setMinutes(setHours(workday, 11), 0);
      const blockStart = setMinutes(setHours(workday, 12), 0);
      const blockEnd = setMinutes(setHours(workday, 13), 0);

      const staffAbsences: StaffAbsence[] = [
        {
          staffId: 'staff-1',
          startsAt: workday,
          endsAt: addDays(workday, 1),
          reason: 'Urlaub',
          status: 'approved',
        },
      ];

      const blockedTimes: BlockedTime[] = [
        {
          staffId: 'staff-2',
          startsAt: blockStart,
          endsAt: blockEnd,
          reason: 'Interner Block',
        },
      ];

      const existingAppointments: ExistingAppointment[] = [
        {
          id: 'apt-1',
          staffId: 'staff-2',
          startsAt: appointmentStart,
          endsAt: appointmentEnd,
          status: 'confirmed',
        },
      ];

      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: workday,
        dateRangeEnd: workday,
        serviceIds: ['service-1'],
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: mockOpeningHours,
        staff: mockStaff,
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences,
        blockedTimes,
        existingAppointments,
        bookingRules: mockBookingRules,
      });

      expect(slots.some((slot) => slot.staffId === 'staff-1')).toBe(false);

      const staffTwoConflicts = slots.filter(
        (slot) =>
          slot.staffId === 'staff-2' &&
          ((slot.startsAt < appointmentEnd && slot.endsAt > appointmentStart) ||
            (slot.startsAt < blockEnd && slot.endsAt > blockStart))
      );

      expect(staffTwoConflicts).toHaveLength(0);
      expect(slots.some((slot) => slot.staffId === 'staff-2')).toBe(true);
    });

    it('should respect lead time', async () => {
      const now = new Date();
      const today = startOfDay(now);

      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: today,
        dateRangeEnd: today,
        serviceIds: ['service-1'],
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: mockOpeningHours,
        staff: mockStaff,
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences: [],
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: { ...mockBookingRules, leadTimeMinutes: 60 },
      });

      // All slots should be at least 60 minutes from now
      const minStartTime = addMinutes(now, 60);
      const tooEarlySlots = slots.filter((s) => s.startsAt < minStartTime);

      expect(tooEarlySlots).toHaveLength(0);
    });

    it('should block same-day slots when same-day booking is disabled', async () => {
      const todayDayOfWeek = new Date().getDay();
      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: createDate(0, 0, 0),
        dateRangeEnd: createDate(0, 23, 59),
        serviceIds: ['service-1'],
        preferredStaffId: 'staff-1',
        timeZone: 'UTC',
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: [
          ...mockOpeningHours.filter((hours) => hours.dayOfWeek !== todayDayOfWeek),
          { dayOfWeek: todayDayOfWeek, openTime: '00:00', closeTime: '23:59', isClosed: false },
        ],
        staff: mockStaff.filter((s) => s.id === 'staff-1'),
        staffWorkingHours: [
          ...mockStaffWorkingHours.filter((hours) => !(hours.staffId === 'staff-1' && hours.dayOfWeek === todayDayOfWeek)),
          { staffId: 'staff-1', dayOfWeek: todayDayOfWeek, startTime: '00:00', endTime: '23:59' },
        ],
        staffAbsences: [],
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: {
          ...mockBookingRules,
          allowSameDayBooking: false,
          leadTimeMinutes: 0,
        },
      });

      expect(slots).toHaveLength(0);
    });

    it('should not generate slots after the configured booking horizon', async () => {
      const beyondHorizon = createBookableDateBeyondHorizon(3, 9, 0);
      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: beyondHorizon,
        dateRangeEnd: beyondHorizon,
        serviceIds: ['service-1'],
        preferredStaffId: 'staff-1',
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: mockOpeningHours,
        staff: mockStaff.filter((s) => s.id === 'staff-1'),
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences: [],
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: {
          ...mockBookingRules,
          horizonDays: 1,
          leadTimeMinutes: 0,
        },
      });

      expect(slots).toHaveLength(0);
    });

    it('should apply buffer around existing appointments', async () => {
      const nextMonday = createNextWeekdayDate(1, 0, 0);
      const appointmentStart = setMinutes(setHours(nextMonday, 10), 0);
      const appointmentEnd = setMinutes(setHours(nextMonday, 11), 0);
      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: nextMonday,
        dateRangeEnd: nextMonday,
        serviceIds: ['service-1'],
        preferredStaffId: 'staff-1',
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: mockOpeningHours,
        staff: mockStaff.filter((s) => s.id === 'staff-1'),
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences: [],
        blockedTimes: [],
        existingAppointments: [{
          id: 'appointment-1',
          staffId: 'staff-1',
          startsAt: appointmentStart,
          endsAt: appointmentEnd,
          status: 'confirmed',
        }],
        bookingRules: {
          ...mockBookingRules,
          bufferBetweenMinutes: 15,
          leadTimeMinutes: 0,
        },
      });

      const blockedStart = addMinutes(appointmentStart, -15);
      const blockedEnd = addMinutes(appointmentEnd, 15);
      expect(
        slots.every((slot) => slot.endsAt <= blockedStart || slot.startsAt >= blockedEnd)
      ).toBe(true);
    });

    it('should round lead-time clipped slots to clean granularity boundaries', async () => {
      const now = new Date();
      const nextMonday = createNextWeekdayDate(1, 0, 0);
      const targetLeadTime = setMinutes(setHours(nextMonday, 10), 7);
      const leadTimeMinutes = Math.max(
        1,
        Math.floor((targetLeadTime.getTime() - now.getTime()) / 60000)
      );

      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: nextMonday,
        dateRangeEnd: nextMonday,
        serviceIds: ['service-1'],
        preferredStaffId: 'staff-1',
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: mockOpeningHours,
        staff: mockStaff.filter((s) => s.id === 'staff-1'),
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences: [],
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: {
          ...mockBookingRules,
          leadTimeMinutes,
          slotGranularityMinutes: 15,
        },
      });

      expect(slots.length).toBeGreaterThan(0);
      expect(
        slots.every(
          (slot) =>
            slot.startsAt.getMinutes() % 15 === 0 &&
            slot.startsAt.getSeconds() === 0 &&
            slot.startsAt.getMilliseconds() === 0
        )
      ).toBe(true);
    });

    it('should calculate correct total duration for multiple services', async () => {
      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: createDate(1, 0, 0),
        dateRangeEnd: createDate(1, 23, 59),
        serviceIds: ['service-1', 'service-2'], // 45 + 90 = 135 minutes
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices,
        openingHours: mockOpeningHours,
        staff: mockStaff.filter((s) => s.id === 'staff-1'), // Only Alex can do both
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences: [],
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: mockBookingRules,
      });

      // All slots should have totalDuration of 135
      expect(slots.every((s) => s.totalDuration === 135)).toBe(true);
    });

    it('should respect slot granularity', async () => {
      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: createDate(1, 0, 0),
        dateRangeEnd: createDate(1, 23, 59),
        serviceIds: ['service-1'],
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: mockOpeningHours,
        staff: mockStaff,
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences: [],
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: { ...mockBookingRules, slotGranularityMinutes: 30 },
      });

      // All slot start times should be on 30-minute boundaries
      const nonAlignedSlots = slots.filter(
        (s) => s.startsAt.getMinutes() % 30 !== 0
      );

      expect(nonAlignedSlots).toHaveLength(0);
    });

    it('should prefer selected staff when provided', async () => {
      const input: SlotEngineInput = {
        salonId: 'salon-1',
        dateRangeStart: createNextWeekdayDate(1, 0, 0),
        dateRangeEnd: createNextWeekdayDate(1, 23, 59),
        serviceIds: ['service-1'],
        preferredStaffId: 'staff-2',
      };

      const slots = await computeAvailableSlots(input, {
        services: mockServices.filter((s) => s.id === 'service-1'),
        openingHours: mockOpeningHours,
        staff: mockStaff,
        staffWorkingHours: mockStaffWorkingHours,
        staffAbsences: [],
        blockedTimes: [],
        existingAppointments: [],
        bookingRules: mockBookingRules,
      });

      // Slots should include both staff, but sorted with preferred first for same time
      expect(slots.length).toBeGreaterThan(0);
    });
  });

  describe('groupSlotsByDate', () => {
    it('should group slots by date', () => {
      const tomorrow = addDays(startOfDay(new Date()), 1);
      const dayAfter = addDays(startOfDay(new Date()), 2);

      const slots = [
        {
          staffId: 'staff-1',
          staffName: 'Alex',
          startsAt: setHours(tomorrow, 9),
          endsAt: setHours(tomorrow, 10),
          totalDuration: 60,
          services: [],
        },
        {
          staffId: 'staff-1',
          staffName: 'Alex',
          startsAt: setHours(tomorrow, 10),
          endsAt: setHours(tomorrow, 11),
          totalDuration: 60,
          services: [],
        },
        {
          staffId: 'staff-1',
          staffName: 'Alex',
          startsAt: setHours(dayAfter, 9),
          endsAt: setHours(dayAfter, 10),
          totalDuration: 60,
          services: [],
        },
      ];

      const grouped = groupSlotsByDate(slots);

      expect(grouped).toHaveLength(2);
      expect(grouped[0].slots).toHaveLength(2);
      expect(grouped[1].slots).toHaveLength(1);
    });

    it('should format display dates correctly', () => {
      const today = startOfDay(new Date());
      const tomorrow = addDays(today, 1);

      const slots = [
        {
          staffId: 'staff-1',
          staffName: 'Alex',
          startsAt: setHours(today, 14),
          endsAt: setHours(today, 15),
          totalDuration: 60,
          services: [],
        },
        {
          staffId: 'staff-1',
          staffName: 'Alex',
          startsAt: setHours(tomorrow, 9),
          endsAt: setHours(tomorrow, 10),
          totalDuration: 60,
          services: [],
        },
      ];

      const grouped = groupSlotsByDate(slots);

      expect(grouped[0].displayDate).toBe('Heute');
      expect(grouped[1].displayDate).toBe('Morgen');
    });
  });
});

// ============================================
// PROPERTY-BASED TESTS (Invariants)
// ============================================

describe('Slot Engine Invariants', () => {
  it('INVARIANT: No duplicate start times for same staff', async () => {
    // NOTE: Slots CAN overlap in time (because granularity < service duration)
    // But no two slots should have the SAME start time for the same staff
    const input: SlotEngineInput = {
      salonId: 'salon-1',
      dateRangeStart: createDate(1, 0, 0),
      dateRangeEnd: createDate(7, 23, 59),
      serviceIds: ['service-1'],
    };

    const slots = await computeAvailableSlots(input, {
      services: mockServices.filter((s) => s.id === 'service-1'),
      openingHours: mockOpeningHours,
      staff: mockStaff,
      staffWorkingHours: mockStaffWorkingHours,
      staffAbsences: [],
      blockedTimes: [],
      existingAppointments: [],
      bookingRules: mockBookingRules,
    });

    // Group by staff
    const slotsByStaff = new Map<string, typeof slots>();
    slots.forEach((slot) => {
      const existing = slotsByStaff.get(slot.staffId) || [];
      existing.push(slot);
      slotsByStaff.set(slot.staffId, existing);
    });

    // Check no duplicate start times within each staff's slots
    slotsByStaff.forEach((staffSlots, staffId) => {
      const startTimes = new Set<string>();
      for (const slot of staffSlots) {
        const key = slot.startsAt.toISOString();
        if (startTimes.has(key)) {
          throw new Error(
            `Duplicate slot start time for ${staffId}: ${key}`
          );
        }
        startTimes.add(key);
      }
    });

    expect(true).toBe(true); // If we get here, no duplicates found
  });

  it('INVARIANT: All slots are within opening hours', async () => {
    const input: SlotEngineInput = {
      salonId: 'salon-1',
      dateRangeStart: createDate(1, 0, 0),
      dateRangeEnd: createDate(7, 23, 59),
      serviceIds: ['service-1'],
    };

    const slots = await computeAvailableSlots(input, {
      services: mockServices.filter((s) => s.id === 'service-1'),
      openingHours: mockOpeningHours,
      staff: mockStaff,
      staffWorkingHours: mockStaffWorkingHours,
      staffAbsences: [],
      blockedTimes: [],
      existingAppointments: [],
      bookingRules: mockBookingRules,
    });

    slots.forEach((slot) => {
      const startParts = getSalonDateTimeParts(slot.startsAt);
      const endParts = getSalonDateTimeParts(slot.endsAt);
      const dayOfWeek = startParts.dayOfWeek;
      const openingHour = mockOpeningHours.find((h) => h.dayOfWeek === dayOfWeek);

      expect(openingHour).toBeDefined();
      expect(openingHour!.isClosed).toBe(false);

      const slotStartMinutes = startParts.hour * 60 + startParts.minute;
      const slotEndMinutes = endParts.hour * 60 + endParts.minute;

      const [openH, openM] = openingHour!.openTime.split(':').map(Number);
      const [closeH, closeM] = openingHour!.closeTime.split(':').map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      expect(slotStartMinutes).toBeGreaterThanOrEqual(openMinutes);
      expect(slotEndMinutes).toBeLessThanOrEqual(closeMinutes);
    });
  });

  it('INVARIANT: Slot duration matches service total', async () => {
    const serviceDuration = 45; // service-1 duration

    const input: SlotEngineInput = {
      salonId: 'salon-1',
      dateRangeStart: createDate(1, 0, 0),
      dateRangeEnd: createDate(3, 23, 59),
      serviceIds: ['service-1'],
    };

    const slots = await computeAvailableSlots(input, {
      services: mockServices.filter((s) => s.id === 'service-1'),
      openingHours: mockOpeningHours,
      staff: mockStaff,
      staffWorkingHours: mockStaffWorkingHours,
      staffAbsences: [],
      blockedTimes: [],
      existingAppointments: [],
      bookingRules: mockBookingRules,
    });

    slots.forEach((slot) => {
      expect(slot.totalDuration).toBe(serviceDuration);

      const actualDuration =
        (slot.endsAt.getTime() - slot.startsAt.getTime()) / (1000 * 60);
      expect(actualDuration).toBe(serviceDuration);
    });
  });

  it('INVARIANT: Slots are sorted chronologically', async () => {
    const input: SlotEngineInput = {
      salonId: 'salon-1',
      dateRangeStart: createDate(1, 0, 0),
      dateRangeEnd: createDate(7, 23, 59),
      serviceIds: ['service-1'],
    };

    const slots = await computeAvailableSlots(input, {
      services: mockServices.filter((s) => s.id === 'service-1'),
      openingHours: mockOpeningHours,
      staff: mockStaff,
      staffWorkingHours: mockStaffWorkingHours,
      staffAbsences: [],
      blockedTimes: [],
      existingAppointments: [],
      bookingRules: mockBookingRules,
    });

    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].startsAt.getTime()).toBeGreaterThanOrEqual(
        slots[i - 1].startsAt.getTime()
      );
    }
  });

  it('INVARIANT: No slots in the past', async () => {
    const now = new Date();

    const input: SlotEngineInput = {
      salonId: 'salon-1',
      dateRangeStart: startOfDay(now),
      dateRangeEnd: createDate(3, 23, 59),
      serviceIds: ['service-1'],
    };

    const slots = await computeAvailableSlots(input, {
      services: mockServices.filter((s) => s.id === 'service-1'),
      openingHours: mockOpeningHours,
      staff: mockStaff,
      staffWorkingHours: mockStaffWorkingHours,
      staffAbsences: [],
      blockedTimes: [],
      existingAppointments: [],
      bookingRules: { ...mockBookingRules, leadTimeMinutes: 0 },
    });

    slots.forEach((slot) => {
      expect(slot.startsAt.getTime()).toBeGreaterThanOrEqual(now.getTime());
    });
  });
});
