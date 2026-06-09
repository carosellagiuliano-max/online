-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00052_customer_cancellation_setting.sql
-- Description: Add allow_customer_cancellation column to booking_rules
-- ============================================

-- Add allow_customer_cancellation column to booking_rules
ALTER TABLE booking_rules
ADD COLUMN IF NOT EXISTS allow_customer_cancellation BOOLEAN DEFAULT true;

COMMENT ON COLUMN booking_rules.allow_customer_cancellation IS 'Whether customers can cancel appointments themselves via their account';
