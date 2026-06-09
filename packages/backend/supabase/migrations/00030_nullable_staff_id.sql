-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00030_nullable_staff_id.sql
-- Description: Allow appointments without staff assignment
--              (for "Keine Präferenz" bookings where admin assigns later)
-- ============================================

-- Make staff_id nullable in appointments table
ALTER TABLE appointments
ALTER COLUMN staff_id DROP NOT NULL;

-- Update the constraint to allow null (if there's a check constraint)
-- The foreign key already allows null values by default

-- Add a comment explaining the nullable staff_id
COMMENT ON COLUMN appointments.staff_id IS 'Staff member assigned to the appointment. NULL when customer selected "Keine Präferenz" and admin will assign later.';

-- Create an index for unassigned appointments (for admin to easily find them)
CREATE INDEX idx_appointments_unassigned ON appointments(salon_id, start_time)
WHERE staff_id IS NULL AND status IN ('reserved', 'confirmed', 'requested');

COMMENT ON INDEX idx_appointments_unassigned IS 'Index for finding appointments without staff assignment';
