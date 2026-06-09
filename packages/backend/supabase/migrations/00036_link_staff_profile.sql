-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00036_link_staff_profile.sql
-- Description: Function to link staff to user profiles by email
-- ============================================

-- Create a function that links staff members to their user profiles based on email
-- This function can be called during seeding or from the application
CREATE OR REPLACE FUNCTION link_staff_to_profiles()
RETURNS INTEGER AS $$
DECLARE
  linked_count INTEGER := 0;
  staff_record RECORD;
BEGIN
  -- Loop through staff members with emails but no profile_id
  FOR staff_record IN
    SELECT s.id, s.email
    FROM staff s
    WHERE s.email IS NOT NULL
      AND s.profile_id IS NULL
  LOOP
    -- Find matching profile by email
    UPDATE staff
    SET profile_id = (
      SELECT p.id
      FROM profiles p
      WHERE LOWER(p.email) = LOWER(staff_record.email)
      LIMIT 1
    )
    WHERE id = staff_record.id
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE LOWER(p.email) = LOWER(staff_record.email)
      );

    IF FOUND THEN
      linked_count := linked_count + 1;
    END IF;
  END LOOP;

  RETURN linked_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION link_staff_to_profiles() IS 'Links staff members to user profiles based on matching email addresses. Returns the number of staff linked.';

-- Run the function immediately to link existing staff
SELECT link_staff_to_profiles();

-- ============================================
-- TRIGGER: Auto-link staff when profile is created
-- ============================================

-- Function to link a single staff member when their profile is created
-- SECURITY DEFINER ensures this runs with the function owner's permissions
-- SET search_path ensures public.staff table is found
CREATE OR REPLACE FUNCTION trigger_link_staff_on_profile_create()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Link any staff member with matching email to this new profile
  UPDATE staff
  SET profile_id = NEW.id
  WHERE LOWER(email) = LOWER(NEW.email)
    AND profile_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_link_staff_on_profile_insert ON profiles;
CREATE TRIGGER trigger_link_staff_on_profile_insert
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_link_staff_on_profile_create();

COMMENT ON FUNCTION trigger_link_staff_on_profile_create() IS 'Automatically links staff to profile when a new profile is created with matching email.';
