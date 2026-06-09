// ============================================
// BOOKING DOMAIN EXPORTS
// ============================================

// Types
export type {
  TimeInterval,
  SlotEngineInput,
  ServiceSlotInfo,
  AvailableSlot,
  SlotsByDate,
  DayOpeningHours,
  StaffWorkingHours,
  StaffAbsence,
  BlockedTime,
  ExistingAppointment,
  BookingRules,
  ServiceVariant,
  BookableService,
  BookingServiceSelection,
  BookableStaff,
  SlotReservation,
  BookingRequest,
  BookingConfirmation,
  SlotEngineErrorCode,
} from './types';

export { SlotEngineError } from './types';

export type {
  CancellationDisabledReason,
  CustomerCancellationDecision,
  CustomerCancellationStatus,
} from './rules';

export {
  evaluateCustomerCancellation,
  getCancellationDeadlineText,
} from './rules';

// Slot Engine
export {
  DEFAULT_BOOKING_TIME_ZONE,
  computeAvailableSlots,
  formatDateKeyInTimeZone,
  groupSlotsByDate,
  parseDateKeyBoundaryInTimeZone,
} from './slot-engine';

// Reservation System
export {
  generateSlotKey,
  createReservation,
  isReservationValid,
  hasConflictingReservation,
  validateReservation,
  getRemainingReservationTime,
  formatRemainingTime,
} from './reservation';
