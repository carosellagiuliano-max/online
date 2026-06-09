-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00058_customer_soft_delete.sql
-- Description: Preserve customer history by archiving customers instead of deleting rows
-- ============================================

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN customers.deleted_at IS 'When a customer was archived from admin CRM';

CREATE INDEX IF NOT EXISTS idx_customers_not_deleted
ON customers(salon_id, is_active)
WHERE deleted_at IS NULL;

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
WHERE c.is_active = true
  AND c.deleted_at IS NULL;

COMMENT ON VIEW v_active_customers IS 'Active, non-archived customers with computed statistics';
