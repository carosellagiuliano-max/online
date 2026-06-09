import { describe, expect, it } from 'vitest';
import {
  evaluateCustomerCancellation,
  getCancellationDeadlineText,
} from '@/lib/domain/booking';

describe('Booking rules', () => {
  describe('evaluateCustomerCancellation', () => {
    const now = new Date('2026-06-07T10:00:00.000Z');

    it('allows customer cancellation before the configured deadline', () => {
      const result = evaluateCustomerCancellation({
        allowCustomerCancellation: true,
        cancellationDeadlineHours: 24,
        startsAt: new Date('2026-06-08T12:00:00.000Z'),
        now,
        status: 'confirmed',
      });

      expect(result.canCancel).toBe(true);
      expect(result.disabledReason).toBeUndefined();
    });

    it('blocks customer cancellation after the configured deadline', () => {
      const result = evaluateCustomerCancellation({
        allowCustomerCancellation: true,
        cancellationDeadlineHours: 24,
        startsAt: new Date('2026-06-08T08:00:00.000Z'),
        now,
        status: 'confirmed',
      });

      expect(result.canCancel).toBe(false);
      expect(result.disabledReason).toBe('deadline');
    });

    it('blocks customer cancellation when self-service cancellation is disabled', () => {
      const result = evaluateCustomerCancellation({
        allowCustomerCancellation: false,
        cancellationDeadlineHours: 24,
        startsAt: new Date('2026-06-09T12:00:00.000Z'),
        now,
        status: 'requested',
      });

      expect(result.canCancel).toBe(false);
      expect(result.disabledReason).toBe('not_allowed');
    });

    it('does not allow cancellation for terminal appointment statuses', () => {
      const result = evaluateCustomerCancellation({
        allowCustomerCancellation: true,
        cancellationDeadlineHours: 0,
        startsAt: new Date('2026-06-09T12:00:00.000Z'),
        now,
        status: 'completed',
      });

      expect(result.canCancel).toBe(false);
      expect(result.disabledReason).toBe('status');
    });
  });

  describe('getCancellationDeadlineText', () => {
    it('formats zero-hour cancellation windows clearly', () => {
      expect(getCancellationDeadlineText(0)).toBe('Stornierung ist bis zum Terminbeginn möglich.');
    });

    it('formats day-based cancellation windows clearly', () => {
      expect(getCancellationDeadlineText(24)).toBe('Stornierung nur bis 1 Tag vor dem Termin möglich.');
      expect(getCancellationDeadlineText(48)).toBe('Stornierung nur bis 2 Tage vor dem Termin möglich.');
    });

    it('formats hour-based cancellation windows clearly', () => {
      expect(getCancellationDeadlineText(12)).toBe('Stornierung nur bis 12 Stunden vor dem Termin möglich.');
    });
  });
});
