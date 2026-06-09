-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00029_approval_and_payment_tracking.sql
-- Description: Add approval workflow and payment tracking for appointments
-- ============================================

-- ============================================
-- ADD APPROVAL COLUMNS TO APPOINTMENTS
-- ============================================

-- Add approval tracking columns
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);

COMMENT ON COLUMN appointments.is_approved IS 'Whether the appointment has been approved by admin/staff';
COMMENT ON COLUMN appointments.approved_at IS 'When the appointment was approved';
COMMENT ON COLUMN appointments.approved_by IS 'Who approved the appointment';

-- ============================================
-- ADD PAYMENT TRACKING COLUMNS TO APPOINTMENTS
-- ============================================

-- Add payment tracking columns for in-person payments
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS paid_amount_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

COMMENT ON COLUMN appointments.paid_amount_cents IS 'Amount actually paid by customer (for in-person payments)';
COMMENT ON COLUMN appointments.paid_at IS 'When payment was recorded';
COMMENT ON COLUMN appointments.paid_by IS 'Staff member who recorded the payment';
COMMENT ON COLUMN appointments.payment_notes IS 'Notes about the payment (e.g., payment method)';

-- ============================================
-- ADD BOOKING RULES FOR APPROVAL WORKFLOW
-- ============================================

-- Check if booking_rules table exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_rules') THEN
    CREATE TABLE booking_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      min_notice_hours INTEGER DEFAULT 24,
      max_advance_days INTEGER DEFAULT 90,
      buffer_minutes INTEGER DEFAULT 15,
      allow_same_day_booking BOOLEAN DEFAULT false,
      require_phone_for_booking BOOLEAN DEFAULT true,
      require_appointment_approval BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(salon_id)
    );

    COMMENT ON TABLE booking_rules IS 'Booking configuration rules per salon';
  ELSE
    -- Add require_appointment_approval column if table exists
    ALTER TABLE booking_rules
    ADD COLUMN IF NOT EXISTS require_appointment_approval BOOLEAN DEFAULT false;
  END IF;
END$$;

COMMENT ON COLUMN booking_rules.require_appointment_approval IS 'Whether appointments require admin approval before confirmation';

-- ============================================
-- INDEX FOR PAYMENT QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_appointments_paid ON appointments(salon_id, paid_at)
WHERE paid_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_approved ON appointments(salon_id, is_approved)
WHERE is_approved = true;

-- ============================================
-- FUNCTION: Approve appointment
-- ============================================
CREATE OR REPLACE FUNCTION approve_appointment(
  p_appointment_id UUID,
  p_approved_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  appt_record RECORD;
BEGIN
  -- Get and lock appointment
  SELECT * INTO appt_record
  FROM appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF appt_record.is_approved THEN
    RETURN true; -- Already approved
  END IF;

  -- Update to approved
  UPDATE appointments
  SET
    is_approved = true,
    approved_at = NOW(),
    approved_by = p_approved_by
  WHERE id = p_appointment_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Record payment for appointment
-- ============================================
CREATE OR REPLACE FUNCTION record_appointment_payment(
  p_appointment_id UUID,
  p_amount_cents INTEGER,
  p_payment_method TEXT DEFAULT 'cash',
  p_payment_notes TEXT DEFAULT NULL,
  p_paid_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  appt_record RECORD;
BEGIN
  -- Get and lock appointment
  SELECT * INTO appt_record
  FROM appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  -- Update payment info
  UPDATE appointments
  SET
    paid_amount_cents = p_amount_cents,
    payment_method = p_payment_method,
    payment_notes = p_payment_notes,
    paid_at = NOW(),
    paid_by = p_paid_by
  WHERE id = p_appointment_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;
