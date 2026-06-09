-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00053_profile_soft_delete.sql
-- Description: Add soft delete columns to profiles table
-- ============================================

-- Add soft delete columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.is_deleted IS 'Whether the user has deleted their account';
COMMENT ON COLUMN profiles.deleted_at IS 'When the user deleted their account';

-- Create index for filtering active users
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_deleted) WHERE is_deleted = false;
