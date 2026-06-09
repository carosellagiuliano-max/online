-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00016_booking_enhancements.sql
-- Description: Add columns for booking flow and customer portal
-- ============================================

-- ============================================
-- ADD COLUMNS TO APPOINTMENTS
-- ============================================

-- Add booking number for customer reference
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS booking_number TEXT UNIQUE;

-- Add guest customer info (for non-registered bookings)
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Make customer_id nullable for guest bookings
ALTER TABLE appointments
ALTER COLUMN customer_id DROP NOT NULL;

-- Add notes column for customer messages
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add payment method
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('cash', 'card', 'stripe_card', 'twint');
  END IF;
END$$;

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';

COMMENT ON COLUMN appointments.booking_number IS 'Human-readable booking reference (e.g., SW-ABC123)';
COMMENT ON COLUMN appointments.customer_name IS 'Guest customer name (when not registered)';
COMMENT ON COLUMN appointments.customer_email IS 'Guest customer email (when not registered)';
COMMENT ON COLUMN appointments.customer_phone IS 'Guest customer phone (when not registered)';

-- Create index for booking number
CREATE INDEX IF NOT EXISTS idx_appointments_booking_number ON appointments(booking_number)
WHERE booking_number IS NOT NULL;

-- Create index for guest email lookup
CREATE INDEX IF NOT EXISTS idx_appointments_customer_email ON appointments(customer_email)
WHERE customer_email IS NOT NULL;

-- ============================================
-- RLS POLICIES FOR CUSTOMER ACCESS
-- ============================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Customers can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Customers can cancel own appointments" ON appointments;
DROP POLICY IF EXISTS "Service role full access appointments" ON appointments;

-- Enable RLS on appointments if not already enabled
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Customers can view their own appointments (via customer_id or email)
CREATE POLICY "Customers can view own appointments"
ON appointments FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Via customer_id linkage
    customer_id IN (
      SELECT c.id FROM customers c
      JOIN profiles p ON c.profile_id = p.id
      WHERE p.id = auth.uid()
    )
    -- Or via direct email match (guest bookings)
    OR customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);

-- Customers can update (cancel) their own appointments
CREATE POLICY "Customers can cancel own appointments"
ON appointments FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    customer_id IN (
      SELECT c.id FROM customers c
      JOIN profiles p ON c.profile_id = p.id
      WHERE p.id = auth.uid()
    )
    OR customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);

-- Service role (server actions) has full access
CREATE POLICY "Service role full access appointments"
ON appointments FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Staff can view and manage salon appointments
CREATE POLICY "Staff can view salon appointments"
ON appointments FOR SELECT
USING (
  salon_id IN (
    SELECT ur.salon_id FROM user_roles ur
    WHERE ur.profile_id = auth.uid()
    AND ur.role_name IN ('admin', 'manager', 'mitarbeiter')
  )
);

CREATE POLICY "Staff can manage salon appointments"
ON appointments FOR ALL
USING (
  salon_id IN (
    SELECT ur.salon_id FROM user_roles ur
    WHERE ur.profile_id = auth.uid()
    AND ur.role_name IN ('admin', 'manager', 'mitarbeiter')
  )
);

-- ============================================
-- RLS POLICIES FOR APPOINTMENT_SERVICES
-- ============================================

DROP POLICY IF EXISTS "Customers can view appointment services" ON appointment_services;
DROP POLICY IF EXISTS "Service role full access appointment_services" ON appointment_services;

ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;

-- Anyone can read appointment services for their appointments
CREATE POLICY "Customers can view appointment services"
ON appointment_services FOR SELECT
USING (
  appointment_id IN (
    SELECT id FROM appointments
    WHERE auth.uid() IS NOT NULL AND (
      customer_id IN (
        SELECT c.id FROM customers c
        JOIN profiles p ON c.profile_id = p.id
        WHERE p.id = auth.uid()
      )
      OR customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  )
);

-- Service role has full access
CREATE POLICY "Service role full access appointment_services"
ON appointment_services FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Staff can view appointment services
CREATE POLICY "Staff can view appointment services"
ON appointment_services FOR SELECT
USING (
  appointment_id IN (
    SELECT id FROM appointments a
    WHERE a.salon_id IN (
      SELECT ur.salon_id FROM user_roles ur
      WHERE ur.profile_id = auth.uid()
      AND ur.role_name IN ('admin', 'manager', 'mitarbeiter')
    )
  )
);

-- Staff can manage appointment services
CREATE POLICY "Staff can manage appointment services"
ON appointment_services FOR ALL
USING (
  appointment_id IN (
    SELECT id FROM appointments a
    WHERE a.salon_id IN (
      SELECT ur.salon_id FROM user_roles ur
      WHERE ur.profile_id = auth.uid()
      AND ur.role_name IN ('admin', 'manager', 'mitarbeiter')
    )
  )
);
