-- ============================================
-- FIX: Infinite recursion in user_roles RLS policy
-- ============================================

-- Drop the problematic policy
DROP POLICY IF EXISTS user_roles_admin ON user_roles;

-- Create a SECURITY DEFINER function to check admin status
-- This bypasses RLS and avoids recursion
CREATE OR REPLACE FUNCTION is_salon_admin(check_salon_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE profile_id = auth.uid()
      AND salon_id = check_salon_id
      AND role_name = 'admin'
  );
$$;

-- Create a function to check if user has any admin role
CREATE OR REPLACE FUNCTION is_any_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE profile_id = auth.uid()
      AND role_name = 'admin'
  );
$$;

-- Recreate the policy using the SECURITY DEFINER function
CREATE POLICY user_roles_admin ON user_roles
  FOR ALL
  USING (is_salon_admin(salon_id));

-- Grant execute on the functions
GRANT EXECUTE ON FUNCTION is_salon_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_any_admin() TO authenticated;
