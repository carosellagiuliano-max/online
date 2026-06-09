-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00034_nullable_customer_profile.sql
-- Description: Make profile_id nullable for admin-created customers
-- ============================================

-- Make profile_id nullable to allow admin-created customers without user accounts
ALTER TABLE customers ALTER COLUMN profile_id DROP NOT NULL;

-- Update the unique constraint to handle null profile_id
-- Drop old constraint first
ALTER TABLE customers DROP CONSTRAINT IF EXISTS unique_customer_per_salon;

-- Create new partial unique constraint that allows multiple null profile_id entries
-- but prevents duplicate profile_id per salon when profile_id is set
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_customer_profile_per_salon
ON customers(salon_id, profile_id)
WHERE profile_id IS NOT NULL;
