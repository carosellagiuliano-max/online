import {
  addMinutes,
  isBefore,
  isAfter,
  differenceInMinutes,
  format,
} from 'date-fns';
import { de } from 'date-fns/locale';
import type {
  SlotEngineInput,
  AvailableSlot,
  SlotsByDate,
  TimeInterval,
  DayOpeningHours,
  StaffWorkingHours,
  StaffAbsence,
  BlockedTime,
  ExistingAppointment,
  BookingRules,
  BookableService,
  BookableStaff,
} from './types';

// ============================================
// SLOT ENGINE
// ============================================

export const DEFAULT_BOOKING_TIME_ZONE = 'Europe/Zurich';

/**
 * Default booking rules
 */
const DEFAULT_BOOKING_RULES: BookingRules = {
  slotGranularityMinutes: 15,
  leadTimeMinutes: 24 * 60, // 24 hours minimum
  horizonDays: 90, // 90 days in advance
  bufferBetweenMinutes: 15,
  allowMultipleServices: true,
  allowSameDayBooking: false,
  requireDeposit: false,
  cancellationDeadlineHours: 24,
};

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = dateTimeFormatters.get(timeZone);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  dateTimeFormatters.set(timeZone, formatter);
  return formatter;
}

function getZonedParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = getDateTimeFormatter(timeZone).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(
  parts: Omit<ZonedDateParts, 'second'> & { second?: number },
  timeZone: string
): Date {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second ?? 0,
    0
  );

  let result = new Date(utcGuess);
  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMs(result, timeZone);
    const next = new Date(utcGuess - offset);
    if (next.getTime() === result.getTime()) {
      return next;
    }
    result = next;
  }

  return result;
}

function startOfZonedDay(date: Date, timeZone: string): Date {
  const parts = getZonedParts(date, timeZone);
  return zonedDateTimeToUtc(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone
  );
}

function addZonedDays(date: Date, amount: number, timeZone: string): Date {
  const parts = getZonedParts(date, timeZone);
  const nextLocalDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount, 12));

  return zonedDateTimeToUtc(
    {
      year: nextLocalDate.getUTCFullYear(),
      month: nextLocalDate.getUTCMonth() + 1,
      day: nextLocalDate.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone
  );
}

function endOfZonedDayExclusive(date: Date, timeZone: string): Date {
  return addZonedDays(startOfZonedDay(date, timeZone), 1, timeZone);
}

export function formatDateKeyInTimeZone(
  date: Date,
  timeZone: string = DEFAULT_BOOKING_TIME_ZONE
): string {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function parseDateKeyBoundaryInTimeZone(
  dateKey: string,
  boundary: 'start' | 'endExclusive',
  timeZone: string = DEFAULT_BOOKING_TIME_ZONE
): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const localDate = new Date(Date.UTC(year, month - 1, day, 12));

  return zonedDateTimeToUtc(
    {
      year: localDate.getUTCFullYear(),
      month: localDate.getUTCMonth() + 1,
      day: localDate.getUTCDate() + (boundary === 'endExclusive' ? 1 : 0),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone
  );
}

function getZonedDayOfWeek(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

/**
 * Compute available slots for the given input
 */
export async function computeAvailableSlots(
  input: SlotEngineInput,
  data: {
    services: BookableService[];
    openingHours: DayOpeningHours[];
    staff: BookableStaff[];
    staffWorkingHours: StaffWorkingHours[];
    staffAbsences: StaffAbsence[];
    blockedTimes: BlockedTime[];
    existingAppointments: ExistingAppointment[];
    bookingRules?: Partial<BookingRules>;
  }
): Promise<AvailableSlot[]> {
  const {
    services,
    openingHours,
    staff,
    staffWorkingHours,
    staffAbsences,
    blockedTimes,
    existingAppointments,
    bookingRules: customRules,
  } = data;

  const bookingRules = { ...DEFAULT_BOOKING_RULES, ...customRules };
  const timeZone = input.timeZone || DEFAULT_BOOKING_TIME_ZONE;

  // Calculate total duration from selected services
  const totalDuration = calculateTotalDuration(services, bookingRules);

  // Filter staff by skills (can perform all selected services)
  const qualifiedStaff = filterStaffBySkills(
    staff,
    input.serviceIds,
    input.preferredStaffId
  );

  const slots: AvailableSlot[] = [];
  const now = new Date();
  const rangeEndDay = startOfZonedDay(input.dateRangeEnd, timeZone);

  // Iterate through each day in the range
  for (
    let day = startOfZonedDay(input.dateRangeStart, timeZone);
    !isAfter(day, rangeEndDay);
    day = addZonedDays(day, 1, timeZone)
  ) {
    // Check if within booking window
    if (!isWithinBookingWindow(day, now, bookingRules, timeZone)) {
      continue;
    }

    // Get opening hours for this day
    const dayOpeningHours = getOpeningHoursForDay(openingHours, day, timeZone);
    if (!dayOpeningHours || dayOpeningHours.isClosed) {
      continue;
    }

    // For each qualified staff member
    for (const staffMember of qualifiedStaff) {
      // Compute available intervals for this staff on this day
      const availableIntervals = computeAvailableIntervals({
        day,
        staff: staffMember,
        dayOpeningHours,
        staffWorkingHours,
        staffAbsences,
        blockedTimes,
        existingAppointments,
        totalDuration,
        slotGranularity: bookingRules.slotGranularityMinutes,
        bufferMinutes: bookingRules.bufferBetweenMinutes,
        leadTimeMinutes: bookingRules.leadTimeMinutes,
        now,
        timeZone,
      });

      // Generate slots from intervals
      for (const interval of availableIntervals) {
        const intervalSlots = generateSlotsFromInterval(
          interval,
          totalDuration,
          bookingRules.slotGranularityMinutes
        );

        slots.push(
          ...intervalSlots.map((slot) => ({
            staffId: staffMember.id,
            staffName: staffMember.name,
            startsAt: slot.start,
            endsAt: addMinutes(slot.start, totalDuration),
            totalDuration,
            services: services.map((s) => ({
              serviceId: s.id,
              name: s.name,
              duration: s.durationMinutes,
              price: s.currentPrice,
            })),
          }))
        );
      }
    }
  }

  // Sort slots by start time, then by staff name
  return sortSlots(slots);
}

/**
 * Group slots by date for UI display
 */
export function groupSlotsByDate(
  slots: AvailableSlot[],
  timeZone: string = DEFAULT_BOOKING_TIME_ZONE
): SlotsByDate[] {
  const grouped = new Map<string, AvailableSlot[]>();

  for (const slot of slots) {
    const dateKey = formatDateKeyInTimeZone(slot.startsAt, timeZone);
    const existing = grouped.get(dateKey) || [];
    existing.push(slot);
    grouped.set(dateKey, existing);
  }

  const result: SlotsByDate[] = [];
  for (const [dateKey, dateSlots] of grouped) {
    result.push({
      date: dateKey,
      displayDate: formatDisplayDate(dateKey, timeZone),
      slots: dateSlots,
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate total duration from services
 */
function calculateTotalDuration(
  services: BookableService[],
  rules: BookingRules
): number {
  const serviceDuration = services.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );
  // Add buffer between services if multiple
  const bufferTime =
    services.length > 1
      ? (services.length - 1) * rules.bufferBetweenMinutes
      : 0;
  return serviceDuration + bufferTime;
}

/**
 * Filter staff by their ability to perform all selected services
 */
function filterStaffBySkills(
  staff: BookableStaff[],
  serviceIds: string[],
  preferredStaffId?: string
): BookableStaff[] {
  let qualified = staff.filter(
    (s) =>
      s.isBookable && serviceIds.every((sid) => s.serviceIds.includes(sid))
  );

  // If preferred staff is specified and qualified, put them first
  if (preferredStaffId) {
    const preferred = qualified.find((s) => s.id === preferredStaffId);
    if (preferred) {
      qualified = [
        preferred,
        ...qualified.filter((s) => s.id !== preferredStaffId),
      ];
    }
  }

  return qualified;
}

/**
 * Check if a date is within the booking window
 */
function isWithinBookingWindow(
  day: Date,
  now: Date,
  rules: BookingRules,
  timeZone: string
): boolean {
  // Check if same-day booking is allowed
  const isCurrentSalonDay =
    formatDateKeyInTimeZone(day, timeZone) === formatDateKeyInTimeZone(now, timeZone);
  if (isCurrentSalonDay && rules.allowSameDayBooking === false) {
    return false;
  }

  const minDate = addMinutes(now, rules.leadTimeMinutes);
  const maxDate = addZonedDays(startOfZonedDay(now, timeZone), rules.horizonDays, timeZone);
  const dayStart = startOfZonedDay(day, timeZone);
  const dayEndExclusive = endOfZonedDayExclusive(day, timeZone);

  return isAfter(dayEndExclusive, minDate) && !isAfter(dayStart, maxDate);
}

/**
 * Get opening hours for a specific day
 */
function getOpeningHoursForDay(
  openingHours: DayOpeningHours[],
  day: Date,
  timeZone: string
): DayOpeningHours | undefined {
  const dayOfWeek = getZonedDayOfWeek(day, timeZone);
  return openingHours.find((oh) => oh.dayOfWeek === dayOfWeek);
}

/**
 * Format date for display
 */
function formatDisplayDate(dateKey: string, timeZone: string): string {
  const todayKey = formatDateKeyInTimeZone(new Date(), timeZone);
  const tomorrowKey = formatDateKeyInTimeZone(
    addZonedDays(startOfZonedDay(new Date(), timeZone), 1, timeZone),
    timeZone
  );

  if (dateKey === todayKey) return 'Heute';
  if (dateKey === tomorrowKey) return 'Morgen';

  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return format(date, 'EEE, d. MMM', { locale: de });
}

interface IntervalParams {
  day: Date;
  staff: BookableStaff;
  dayOpeningHours: DayOpeningHours;
  staffWorkingHours: StaffWorkingHours[];
  staffAbsences: StaffAbsence[];
  blockedTimes: BlockedTime[];
  existingAppointments: ExistingAppointment[];
  totalDuration: number;
  slotGranularity: number;
  bufferMinutes: number;
  leadTimeMinutes: number;
  now: Date;
  timeZone: string;
}

/**
 * Compute available intervals for a staff member on a day
 */
function computeAvailableIntervals(params: IntervalParams): TimeInterval[] {
  const {
    day,
    staff,
    dayOpeningHours,
    staffWorkingHours,
    staffAbsences,
    blockedTimes,
    existingAppointments,
    totalDuration,
    bufferMinutes,
    leadTimeMinutes,
    now,
    timeZone,
  } = params;

  // Start with salon opening hours
  let intervals: TimeInterval[] = [
    {
      start: combineDateAndTime(day, dayOpeningHours.openTime, timeZone),
      end: combineDateAndTime(day, dayOpeningHours.closeTime, timeZone),
    },
  ];

  // Intersect with staff working hours
  const staffHours = getStaffHoursForDay(staffWorkingHours, staff.id, day, timeZone);
  if (!staffHours) {
    // Staff doesn't work on this day - no available slots
    return [];
  }
  intervals = intersectIntervals(intervals, [
    {
      start: combineDateAndTime(day, staffHours.startTime, timeZone),
      end: combineDateAndTime(day, staffHours.endTime, timeZone),
    },
  ]);

  // Subtract staff absences
  const absences = getAbsencesForDay(staffAbsences, staff.id, day, timeZone);
  intervals = subtractIntervals(intervals, absences);

  // Subtract blocked times
  const blocked = getBlockedTimesForDay(blockedTimes, staff.id, day, timeZone);
  intervals = subtractIntervals(intervals, blocked);

  // Subtract lunch break if configured for this day
  if (dayOpeningHours.hasLunchBreak && dayOpeningHours.lunchStart && dayOpeningHours.lunchEnd) {
    const lunchBreak: TimeInterval = {
      start: combineDateAndTime(day, dayOpeningHours.lunchStart, timeZone),
      end: combineDateAndTime(day, dayOpeningHours.lunchEnd, timeZone),
    };
    intervals = subtractIntervals(intervals, [lunchBreak]);
  }

  // Subtract existing appointments (with buffer)
  const appointments = getAppointmentsForDay(
    existingAppointments,
    staff.id,
    day,
    timeZone
  ).map((apt) => ({
    start: addMinutes(apt.startsAt, -bufferMinutes),
    end: addMinutes(apt.endsAt, bufferMinutes),
  }));
  intervals = subtractIntervals(intervals, appointments);

  // Apply lead time - restrict slots that are within the lead time window
  const minStartTime = addMinutes(now, leadTimeMinutes);
  intervals = intervals
    .map((interval) => ({
      start: isAfter(minStartTime, interval.start)
        ? minStartTime
        : interval.start,
      end: interval.end,
    }))
    .filter((interval) => isBefore(interval.start, interval.end));

  // Filter intervals that are too short
  return intervals.filter(
    (i) => differenceInMinutes(i.end, i.start) >= totalDuration
  );
}

/**
 * Combine a date and time string (HH:mm) into a Date
 */
function combineDateAndTime(
  day: Date,
  timeStr: string,
  timeZone: string = DEFAULT_BOOKING_TIME_ZONE
): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const parts = getZonedParts(day, timeZone);

  return zonedDateTimeToUtc(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: hours,
      minute: minutes,
      second: 0,
    },
    timeZone
  );
}

/**
 * Get staff working hours for a specific day
 */
function getStaffHoursForDay(
  workingHours: StaffWorkingHours[],
  staffId: string,
  day: Date,
  timeZone: string
): StaffWorkingHours | undefined {
  const dayOfWeek = getZonedDayOfWeek(day, timeZone);
  return workingHours.find(
    (wh) => wh.staffId === staffId && wh.dayOfWeek === dayOfWeek
  );
}

/**
 * Get absences for a staff member on a day
 */
function getAbsencesForDay(
  absences: StaffAbsence[],
  staffId: string,
  day: Date,
  timeZone: string
): TimeInterval[] {
  const dayStart = startOfZonedDay(day, timeZone);
  const dayEnd = endOfZonedDayExclusive(day, timeZone);

  const matchingAbsences = absences.filter((a) =>
    a.staffId === staffId &&
    (!a.status || a.status === 'approved') &&
    isBefore(a.startsAt, dayEnd) &&
    isAfter(a.endsAt, dayStart)
  );

  return matchingAbsences.map((a) => ({
    start: isAfter(a.startsAt, dayStart) ? a.startsAt : dayStart,
    end: isBefore(a.endsAt, dayEnd) ? a.endsAt : dayEnd,
  }));
}

/**
 * Get blocked times for a staff member on a day
 * Includes both staff-specific blocks and salon-wide blocks (staffId null)
 */
function getBlockedTimesForDay(
  blockedTimes: BlockedTime[],
  staffId: string,
  day: Date,
  timeZone: string
): TimeInterval[] {
  const dayStart = startOfZonedDay(day, timeZone);
  const dayEnd = endOfZonedDayExclusive(day, timeZone);

  return blockedTimes
    .filter(
      (b) =>
        // Match staff-specific blocks OR salon-wide blocks (null staffId)
        (b.staffId === staffId || b.staffId === null) &&
        isBefore(b.startsAt, dayEnd) &&
        isAfter(b.endsAt, dayStart)
    )
    .map((b) => ({
      start: isAfter(b.startsAt, dayStart) ? b.startsAt : dayStart,
      end: isBefore(b.endsAt, dayEnd) ? b.endsAt : dayEnd,
    }));
}

/**
 * Get appointments for a staff member on a day
 * Also includes unassigned appointments (staff_id = NULL) as they block the time
 * until an admin assigns a staff member
 */
function getAppointmentsForDay(
  appointments: ExistingAppointment[],
  staffId: string,
  day: Date,
  timeZone: string
): ExistingAppointment[] {
  const dayStart = startOfZonedDay(day, timeZone);
  const dayEnd = endOfZonedDayExclusive(day, timeZone);

  return appointments.filter(
    (a) =>
      // Match this staff's appointments OR unassigned appointments (block all staff)
      (a.staffId === staffId || a.staffId === null) &&
      isBefore(a.startsAt, dayEnd) &&
      isAfter(a.endsAt, dayStart) &&
      !['cancelled', 'no_show'].includes(a.status)
  );
}

/**
 * Intersect two sets of intervals
 */
function intersectIntervals(
  a: TimeInterval[],
  b: TimeInterval[]
): TimeInterval[] {
  const result: TimeInterval[] = [];

  for (const intervalA of a) {
    for (const intervalB of b) {
      const start = isAfter(intervalA.start, intervalB.start)
        ? intervalA.start
        : intervalB.start;
      const end = isBefore(intervalA.end, intervalB.end)
        ? intervalA.end
        : intervalB.end;

      if (isBefore(start, end)) {
        result.push({ start, end });
      }
    }
  }

  return result;
}

/**
 * Subtract intervals from a set of intervals
 */
function subtractIntervals(
  intervals: TimeInterval[],
  toSubtract: TimeInterval[]
): TimeInterval[] {
  let result = [...intervals];

  for (const sub of toSubtract) {
    const newResult: TimeInterval[] = [];

    for (const interval of result) {
      // No overlap
      if (
        !isBefore(interval.start, sub.end) ||
        !isAfter(interval.end, sub.start)
      ) {
        newResult.push(interval);
        continue;
      }

      // Part before subtraction
      if (isBefore(interval.start, sub.start)) {
        newResult.push({ start: interval.start, end: sub.start });
      }

      // Part after subtraction
      if (isAfter(interval.end, sub.end)) {
        newResult.push({ start: sub.end, end: interval.end });
      }
    }

    result = newResult;
  }

  return result;
}

/**
 * Generate slots from an interval
 */
function generateSlotsFromInterval(
  interval: TimeInterval,
  duration: number,
  granularity: number
): { start: Date }[] {
  const slots: { start: Date }[] = [];
  let current = new Date(interval.start);

  // Round up to the next clean granularity boundary. Lead-time clipping can
  // introduce seconds/milliseconds; visible slots must be stable instants.
  const minutes = current.getMinutes();
  const remainder = minutes % granularity;
  const hasSubMinutePrecision = current.getSeconds() !== 0 || current.getMilliseconds() !== 0;

  if (remainder !== 0 || hasSubMinutePrecision) {
    current = addMinutes(
      current,
      remainder === 0 ? granularity : granularity - remainder
    );
  }
  current.setSeconds(0, 0);

  while (
    !isAfter(addMinutes(current, duration), interval.end) &&
    isBefore(current, interval.end)
  ) {
    slots.push({ start: new Date(current) });
    current = addMinutes(current, granularity);
  }

  return slots;
}

/**
 * Sort slots by start time, then by staff name
 */
function sortSlots(slots: AvailableSlot[]): AvailableSlot[] {
  return slots.sort((a, b) => {
    const timeCompare = a.startsAt.getTime() - b.startsAt.getTime();
    if (timeCompare !== 0) return timeCompare;
    return a.staffName.localeCompare(b.staffName);
  });
}
