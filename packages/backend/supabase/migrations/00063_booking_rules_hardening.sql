-- ============================================
-- 00063: Booking rules hardening
-- Add explicit customer cancellation deadline and guard invalid booking values.
-- ============================================

ALTER TABLE booking_rules
ADD COLUMN IF NOT EXISTS cancellation_deadline_hours INTEGER DEFAULT 24;

COMMENT ON COLUMN booking_rules.cancellation_deadline_hours IS
  'How many hours before appointment start customers may cancel online';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_rules_min_notice_range'
  ) THEN
    ALTER TABLE booking_rules
      ADD CONSTRAINT booking_rules_min_notice_range
      CHECK (min_notice_hours BETWEEN 0 AND 720);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_rules_max_advance_range'
  ) THEN
    ALTER TABLE booking_rules
      ADD CONSTRAINT booking_rules_max_advance_range
      CHECK (max_advance_days BETWEEN 1 AND 365);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_rules_buffer_range'
  ) THEN
    ALTER TABLE booking_rules
      ADD CONSTRAINT booking_rules_buffer_range
      CHECK (buffer_minutes BETWEEN 0 AND 240);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_rules_cancellation_deadline_range'
  ) THEN
    ALTER TABLE booking_rules
      ADD CONSTRAINT booking_rules_cancellation_deadline_range
      CHECK (cancellation_deadline_hours BETWEEN 0 AND 720);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
