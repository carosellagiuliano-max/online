// ============================================
// BOOKING DOMAIN TYPES
// ============================================

/**
 * Time interval representation
 */
export interface TimeInterval {
  start: Date;
  end: Date;
}

/**
 * Input for the slot engine
 */
export interface SlotEngineInput {
  salonId: string;
  dateRangeStart: Date;
  dateRangeEnd: Date;
  serviceIds: string[];
  preferredStaffId?: string;
  timeZone?: string;
}

/**
 * Service information in a slot
 */
export interface ServiceSlotInfo {
  serviceId: string;
  name: string;
  duration: number;
  price: number;
}

/**
 * Available slot returned by the engine
 */
export interface AvailableSlot {
  staffId: string;
  staffName: string;
  startsAt: Date;
  endsAt: Date;
  totalDuration: number;
  services: ServiceSlotInfo[];
}

/**
 * Grouped slots by date
 */
export interface SlotsByDate {
  date: string; // ISO date string (YYYY-MM-DD)
  displayDate: string; // e.g., "Heute", "Morgen", "Di, 15. Nov"
  slots: AvailableSlot[];
}

/**
 * Opening hours for a day
 */
export interface DayOpeningHours {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  openTime: string; // HH:mm format
  closeTime: string; // HH:mm format
  isClosed: boolean;
  hasLunchBreak?: boolean;
  lunchStart?: string | null; // HH:mm format
  lunchEnd?: string | null; // HH:mm format
}

/**
 * Staff working hours
 */
export interface StaffWorkingHours {
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/**
 * Staff absence (vacation, sick leave, etc.)
 */
export interface StaffAbsence {
  staffId: string;
  startsAt: Date;
  endsAt: Date;
  reason?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

/**
 * Blocked time slot
 * staffId can be null for salon-wide blocks that apply to all staff
 */
export interface BlockedTime {
  staffId: string | null;
  startsAt: Date;
  endsAt: Date;
  reason?: string;
}

/**
 * Existing appointment
 */
export interface ExistingAppointment {
  id: string;
  staffId: string | null; // null for unassigned appointments (Keine Präferenz)
  startsAt: Date;
  endsAt: Date;
  status: string;
}

/**
 * Booking rules configuration
 */
export interface BookingRules {
  slotGranularityMinutes: number; // e.g., 15, 30
  leadTimeMinutes: number; // minimum time before booking
  horizonDays: number; // max days in advance
  bufferBetweenMinutes: number; // buffer between appointments
  allowMultipleServices: boolean;
  allowSameDayBooking?: boolean; // whether same-day bookings are allowed
  requireDeposit: boolean;
  depositAmountCents?: number;
  cancellationDeadlineHours: number;
  requireAppointmentApproval?: boolean; // whether appointments need admin approval
  requirePhoneForBooking?: boolean; // whether customers must provide a phone number
  allowCustomerCancellation?: boolean; // whether customers can cancel online
}

/**
 * Service variant (e.g., short, medium, long hair)
 */
export interface ServiceVariant {
  id: string;
  name: string;
  description?: string;
  durationMinutes?: number;
  priceCents: number;
}

/**
 * Service with pricing
 */
export interface BookableService {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  currentPrice: number; // in cents
  categoryId?: string;
  categoryName?: string;
  isActive: boolean;
  hasVariants?: boolean;
  variants?: ServiceVariant[];
  selectedVariantId?: string; // for tracking which variant was selected
}

/**
 * Service selection submitted by the booking UI.
 */
export interface BookingServiceSelection {
  serviceId: string;
  lengthVariantId?: string | null;
}

/**
 * Staff member
 */
export interface BookableStaff {
  id: string;
  name: string;
  imageUrl?: string;
  serviceIds: string[]; // services they can perform
  isBookable: boolean;
}

/**
 * Reservation (temporary hold on a slot)
 */
export interface SlotReservation {
  id: string;
  slotKey: string; // unique key for the slot
  staffId: string;
  startsAt: Date;
  endsAt: Date;
  customerId?: string;
  sessionId: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Booking request (from customer)
 */
export interface BookingRequest {
  salonId: string;
  serviceIds: string[];
  serviceSelections?: BookingServiceSelection[];
  staffId: string | null; // null when "Keine Präferenz" - admin will assign later
  startsAt: Date;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string;
  paymentMethod: 'online' | 'at_venue';
}

/**
 * Booking confirmation
 */
export interface BookingConfirmation {
  appointmentId: string;
  bookingNumber: string;
  status: 'confirmed' | 'requested' | 'pending_payment';
  requiresApproval?: boolean; // True if admin approval is pending
  startsAt: Date;
  endsAt: Date;
  staffName: string;
  services: ServiceSlotInfo[];
  totalPrice: number;
  depositPaid?: number;
  paymentDueAt?: Date;
}

/**
 * Slot engine error codes
 */
export type SlotEngineErrorCode =
  | 'SLOT_ALREADY_TAKEN'
  | 'RESERVATION_EXPIRED'
  | 'INVALID_SERVICE'
  | 'STAFF_UNAVAILABLE'
  | 'OUTSIDE_BOOKING_WINDOW'
  | 'SALON_CLOSED'
  | 'VALIDATION_ERROR';

/**
 * Slot engine error
 */
export class SlotEngineError extends Error {
  constructor(
    public code: SlotEngineErrorCode,
    message: string,
    public fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'SlotEngineError';
  }
}
