-- ============================================
-- Migration: 00057_simplify_order_status.sql
-- Description: Add 'processing' to order_status enum
-- ============================================

-- Add 'processing' value to order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'processing' AFTER 'pending';
