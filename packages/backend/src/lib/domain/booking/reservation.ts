import { addMinutes } from 'date-fns';
import type { SlotReservation } from './types';
import { SlotEngineError } from './types';

// ============================================
// SLOT RESERVATION SYSTEM
// ============================================

/**
 * Reservation configuration
 */
const RESERVATION_CONFIG = {
  timeoutMinutes: 10, // Reservation expires after 10 minutes
  maxReservationsPerSession: 1, // Only one reservation at a time
};

/**
 * Generate a unique slot key
 */
export function generateSlotKey(
  staffId: string,
  startsAt: Date,
  endsAt: Date
): string {
  return `${staffId}:${startsAt.toISOString()}:${endsAt.toISOString()}`;
}

/**
 * Create a slot reservation
 */
export function createReservation(params: {
  staffId: string;
  startsAt: Date;
  endsAt: Date;
  customerId?: string;
  sessionId: string;
}): SlotReservation {
  const now = new Date();
  const slotKey = generateSlotKey(params.staffId, params.startsAt, params.endsAt);

  return {
    id: crypto.randomUUID(),
    slotKey,
    staffId: params.staffId,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    customerId: params.customerId,
    sessionId: params.sessionId,
    expiresAt: addMinutes(now, RESERVATION_CONFIG.timeoutMinutes),
    createdAt: now,
  };
}

/**
 * Check if a reservation is still valid
 */
export function isReservationValid(reservation: SlotReservation): boolean {
  return new Date() < reservation.expiresAt;
}

/**
 * Check if a slot conflicts with existing reservations
 */
export function hasConflictingReservation(
  slotKey: string,
  existingReservations: SlotReservation[],
  currentSessionId: string
): boolean {
  return existingReservations.some(
    (r) =>
      r.slotKey === slotKey &&
      r.sessionId !== currentSessionId &&
      isReservationValid(r)
  );
}

/**
 * Validate a reservation before booking
 */
export function validateReservation(
  reservation: SlotReservation | undefined,
  sessionId: string
): void {
  if (!reservation) {
    throw new SlotEngineError(
      'RESERVATION_EXPIRED',
      'Keine aktive Reservierung gefunden. Bitte wählen Sie erneut einen Termin.'
    );
  }

  if (reservation.sessionId !== sessionId) {
    throw new SlotEngineError(
      'RESERVATION_EXPIRED',
      'Die Reservierung gehört zu einer anderen Sitzung.'
    );
  }

  if (!isReservationValid(reservation)) {
    throw new SlotEngineError(
      'RESERVATION_EXPIRED',
      'Die Reservierung ist abgelaufen. Bitte wählen Sie erneut einen Termin.'
    );
  }
}

/**
 * Calculate remaining time on a reservation in seconds
 */
export function getRemainingReservationTime(
  reservation: SlotReservation
): number {
  const now = new Date();
  const remaining = Math.floor(
    (reservation.expiresAt.getTime() - now.getTime()) / 1000
  );
  return Math.max(0, remaining);
}

/**
 * Format remaining time for display
 */
export function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
