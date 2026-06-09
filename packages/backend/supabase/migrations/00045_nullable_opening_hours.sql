-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00045_nullable_opening_hours.sql
-- Description: Make open_time/close_time nullable for closed days
-- ============================================

-- Drop existing constraints
ALTER TABLE opening_hours DROP CONSTRAINT IF EXISTS valid_hours;
ALTER TABLE opening_hours DROP CONSTRAINT IF EXISTS valid_lunch_hours;

-- Make open_time and close_time nullable (for closed days)
ALTER TABLE opening_hours ALTER COLUMN open_time DROP NOT NULL;
ALTER TABLE opening_hours ALTER COLUMN close_time DROP NOT NULL;

-- Add back valid_hours constraint: only require times when is_open = true
ALTER TABLE opening_hours ADD CONSTRAINT valid_hours
  CHECK (is_open = false OR (open_time IS NOT NULL AND close_time IS NOT NULL AND close_time > open_time));

-- Add back valid_lunch_hours constraint: handle nullable times
ALTER TABLE opening_hours ADD CONSTRAINT valid_lunch_hours
  CHECK (
    has_lunch_break = false
    OR (
      is_open = true
      AND lunch_start IS NOT NULL
      AND lunch_end IS NOT NULL
      AND lunch_end > lunch_start
      AND open_time IS NOT NULL
      AND close_time IS NOT NULL
      AND lunch_start >= open_time
      AND lunch_end <= close_time
    )
  );
