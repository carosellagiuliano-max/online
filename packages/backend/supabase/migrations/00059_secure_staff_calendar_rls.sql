-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00059_secure_staff_calendar_rls.sql
-- Description: Replace permissive development staff/calendar policies
-- ============================================

DROP POLICY IF EXISTS "staff_manage_authenticated" ON staff;
DROP POLICY IF EXISTS staff_manage_admin ON staff;
DROP POLICY IF EXISTS "staff_manage_admin" ON staff;
DROP POLICY IF EXISTS "staff_select_same_salon" ON staff;
DROP POLICY IF EXISTS "Staff can view their own blocks" ON staff_blocks;
DROP POLICY IF EXISTS "Managers can manage blocks" ON staff_blocks;
DROP POLICY IF EXISTS "Managers can manage working hours" ON staff_working_hours;
DROP POLICY IF EXISTS "Staff can view their own absences" ON staff_absences;
DROP POLICY IF EXISTS "Managers can manage absences" ON staff_absences;
DROP POLICY IF EXISTS "Managers can manage staff skills" ON staff_service_skills;

CREATE OR REPLACE FUNCTION current_staff_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  FROM staff
  WHERE profile_id = auth.uid()
    AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION is_active_staff_for_salon(check_salon_id uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff
    WHERE profile_id = auth.uid()
      AND is_active = true
      AND salon_id = check_salon_id
      AND role = ANY(allowed_roles)
  );
$$;

CREATE OR REPLACE FUNCTION can_manage_staff_member(check_staff_id uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff target
    JOIN staff actor ON actor.salon_id = target.salon_id
    WHERE target.id = check_staff_id
      AND actor.profile_id = auth.uid()
      AND actor.is_active = true
      AND actor.role = ANY(allowed_roles)
  );
$$;

CREATE POLICY "staff_select_same_salon"
  ON staff FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR is_active_staff_for_salon(staff.salon_id, ARRAY['admin', 'manager', 'staff', 'hq'])
  );

CREATE POLICY "staff_manage_admin"
  ON staff FOR ALL
  TO authenticated
  USING (
    is_active_staff_for_salon(staff.salon_id, ARRAY['admin', 'manager', 'hq'])
  )
  WITH CHECK (
    is_active_staff_for_salon(staff.salon_id, ARRAY['admin', 'manager', 'hq'])
  );

CREATE POLICY "Staff can view their own blocks"
  ON staff_blocks FOR SELECT
  TO authenticated
  USING (
    staff_id = ANY(current_staff_ids())
    OR is_active_staff_for_salon(staff_blocks.salon_id, ARRAY['admin', 'manager', 'staff', 'hq'])
  );

CREATE POLICY "Managers can manage blocks"
  ON staff_blocks FOR ALL
  TO authenticated
  USING (
    is_active_staff_for_salon(staff_blocks.salon_id, ARRAY['admin', 'manager', 'hq'])
  )
  WITH CHECK (
    is_active_staff_for_salon(staff_blocks.salon_id, ARRAY['admin', 'manager', 'hq'])
  );

CREATE POLICY "Managers can manage working hours"
  ON staff_working_hours FOR ALL
  TO authenticated
  USING (
    can_manage_staff_member(staff_working_hours.staff_id, ARRAY['admin', 'manager', 'hq'])
  )
  WITH CHECK (
    can_manage_staff_member(staff_working_hours.staff_id, ARRAY['admin', 'manager', 'hq'])
  );

CREATE POLICY "Staff can view their own absences"
  ON staff_absences FOR SELECT
  TO authenticated
  USING (
    staff_id = ANY(current_staff_ids())
    OR is_active_staff_for_salon(staff_absences.salon_id, ARRAY['admin', 'manager', 'staff', 'hq'])
  );

CREATE POLICY "Managers can manage absences"
  ON staff_absences FOR ALL
  TO authenticated
  USING (
    is_active_staff_for_salon(staff_absences.salon_id, ARRAY['admin', 'manager', 'hq'])
  )
  WITH CHECK (
    is_active_staff_for_salon(staff_absences.salon_id, ARRAY['admin', 'manager', 'hq'])
  );

CREATE POLICY "Managers can manage staff skills"
  ON staff_service_skills FOR ALL
  TO authenticated
  USING (
    can_manage_staff_member(staff_service_skills.staff_id, ARRAY['admin', 'manager', 'hq'])
  )
  WITH CHECK (
    can_manage_staff_member(staff_service_skills.staff_id, ARRAY['admin', 'manager', 'hq'])
  );
