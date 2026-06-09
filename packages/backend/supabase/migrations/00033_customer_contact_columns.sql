-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00033_customer_contact_columns.sql
-- Description: Add email and phone columns to customers table
--              for admin-created customers without profile accounts
-- ============================================

-- Add email column (nullable for customers linked via profile_id)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT;

-- Add phone column
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add unique constraint for email per salon (only when email is set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_customer_email_per_salon
ON customers(salon_id, email)
WHERE email IS NOT NULL;

-- Update view to coalesce email from customers table or profiles
-- Use explicit column list to avoid duplicate 'email' column
DROP VIEW IF EXISTS v_active_customers;
CREATE VIEW v_active_customers AS
SELECT
  c.id,
  c.salon_id,
  c.profile_id,
  c.first_name,
  c.last_name,
  c.birthday,
  c.preferred_contact,
  c.notes,
  c.hair_notes,
  c.accepts_marketing,
  c.is_active,
  c.created_at,
  c.updated_at,
  c.last_visit_at,
  c.first_name || ' ' || c.last_name AS full_name,
  COALESCE(c.email, p.email) AS email,
  COALESCE(c.phone, p.phone) AS phone,
  p.phone AS profile_phone,
  (
    SELECT COUNT(*)
    FROM appointments a
    WHERE a.customer_id = c.id
    AND a.status = 'completed'
  ) AS total_appointments,
  (
    SELECT MAX(a.start_time)
    FROM appointments a
    WHERE a.customer_id = c.id
    AND a.status = 'completed'
  ) AS last_appointment_date
FROM customers c
LEFT JOIN profiles p ON c.profile_id = p.id
WHERE c.is_active = true;

COMMENT ON VIEW v_active_customers IS 'Active customers with computed statistics';
COMMENT ON COLUMN customers.email IS 'Direct email for admin-created customers (no profile)';
COMMENT ON COLUMN customers.phone IS 'Direct phone for admin-created customers (no profile)';
