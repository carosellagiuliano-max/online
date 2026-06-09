-- ============================================
-- ADD LUNCH BREAK FIELDS TO OPENING_HOURS
-- ============================================

-- Add lunch break columns to opening_hours table
ALTER TABLE opening_hours
ADD COLUMN IF NOT EXISTS has_lunch_break BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS lunch_start TIME,
ADD COLUMN IF NOT EXISTS lunch_end TIME;

-- Add constraint to ensure lunch times are valid when lunch break is enabled
ALTER TABLE opening_hours
ADD CONSTRAINT valid_lunch_hours CHECK (
  has_lunch_break = false OR (
    lunch_start IS NOT NULL AND
    lunch_end IS NOT NULL AND
    lunch_end > lunch_start AND
    lunch_start >= open_time AND
    lunch_end <= close_time
  )
);

COMMENT ON COLUMN opening_hours.has_lunch_break IS 'Whether this day has a lunch break';
COMMENT ON COLUMN opening_hours.lunch_start IS 'Start time of lunch break';
COMMENT ON COLUMN opening_hours.lunch_end IS 'End time of lunch break';
