-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00002_core_tables.sql
-- Description: Core tables (salons, profiles, roles, user_roles)
-- ============================================

-- ============================================
-- SALONS TABLE
-- ============================================
CREATE TABLE salons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,

  -- Contact & Location
  address TEXT,
  zip_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'Schweiz',
  phone TEXT,
  email TEXT,
  website TEXT,

  -- Business Info
  timezone TEXT NOT NULL DEFAULT 'Europe/Zurich',
  currency TEXT NOT NULL DEFAULT 'CHF',
  default_vat_rate DECIMAL(5,2) DEFAULT 8.1,

  -- Configuration (JSON)
  settings_json JSONB DEFAULT '{}',
  theme_config JSONB DEFAULT '{}',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE salons IS 'Physical salon locations';
COMMENT ON COLUMN salons.slug IS 'URL-friendly unique identifier';
COMMENT ON COLUMN salons.settings_json IS 'Salon-specific settings as JSON';
COMMENT ON COLUMN salons.theme_config IS 'Branding/theme configuration';

-- ============================================
-- PROFILES TABLE
-- Links to Supabase auth.users
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,

  -- Personal Info
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,

  -- Preferences
  preferred_language TEXT DEFAULT 'de',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  phone_verified BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'User profiles linked to auth.users';
COMMENT ON COLUMN profiles.id IS 'References auth.users.id';
COMMENT ON COLUMN profiles.display_name IS 'Computed or custom display name';

-- ============================================
-- ROLES TABLE
-- Static role definitions
-- ============================================
CREATE TABLE roles (
  role_name role_name PRIMARY KEY,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'Role definitions with permissions';
COMMENT ON COLUMN roles.permissions IS 'JSON object defining role permissions';

-- Insert default roles
INSERT INTO roles (role_name, description, permissions) VALUES
  ('admin', 'Full salon access - can manage everything', '{"all": true}'),
  ('manager', 'Operational access - can manage daily operations', '{"appointments": true, "customers": true, "orders": true, "staff": true, "inventory": true, "analytics": true}'),
  ('mitarbeiter', 'Staff access - can view calendar and customers', '{"appointments": true, "customers": {"read": true}, "own_calendar": true}'),
  ('kunde', 'Customer access - can view own data', '{"own_profile": true, "own_appointments": true, "own_orders": true}'),
  ('hq', 'Cross-salon access - headquarters view', '{"cross_salon": true, "analytics": true, "read_all": true}');

-- ============================================
-- USER_ROLES TABLE
-- Maps users to roles per salon
-- ============================================
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  role_name role_name NOT NULL,

  -- Metadata
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_user_role_per_salon UNIQUE (profile_id, salon_id, role_name)
);

COMMENT ON TABLE user_roles IS 'User role assignments per salon';
COMMENT ON COLUMN user_roles.salon_id IS 'NULL for global roles like HQ';
COMMENT ON COLUMN user_roles.assigned_by IS 'Who assigned this role';

-- Create index for fast role lookups
CREATE INDEX idx_user_roles_profile ON user_roles(profile_id);
CREATE INDEX idx_user_roles_salon ON user_roles(salon_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_name);

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to salons
CREATE TRIGGER update_salons_updated_at
  BEFORE UPDATE ON salons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TRIGGER: Auto-create profile on auth.users insert
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- HELPER FUNCTION: Get user's salon IDs
-- ============================================
CREATE OR REPLACE FUNCTION get_user_salon_ids(user_id UUID)
RETURNS SETOF UUID AS $$
  SELECT DISTINCT salon_id
  FROM user_roles
  WHERE profile_id = user_id
    AND salon_id IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- HELPER FUNCTION: Check if user has role
-- ============================================
CREATE OR REPLACE FUNCTION has_role(user_id UUID, check_role role_name, check_salon_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE profile_id = user_id
      AND role_name = check_role
      AND (check_salon_id IS NULL OR salon_id = check_salon_id OR salon_id IS NULL)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- HELPER FUNCTION: Check if user is staff (admin/manager/mitarbeiter)
-- ============================================
CREATE OR REPLACE FUNCTION is_staff(user_id UUID, check_salon_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE profile_id = user_id
      AND salon_id = check_salon_id
      AND role_name IN ('admin', 'manager', 'mitarbeiter')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================
CREATE OR REPLACE FUNCTION is_admin(user_id UUID, check_salon_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE profile_id = user_id
      AND salon_id = check_salon_id
      AND role_name = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
