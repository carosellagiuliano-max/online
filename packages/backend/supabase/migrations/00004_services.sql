-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00004_services.sql
-- Description: Service categories, services, and staff skills
-- ============================================

-- ============================================
-- SERVICE_CATEGORIES TABLE
-- Groups services for easier navigation
-- ============================================
CREATE TABLE service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Category Info
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,

  -- Display
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_category_slug_per_salon UNIQUE (salon_id, slug)
);

COMMENT ON TABLE service_categories IS 'Service categories for grouping';
COMMENT ON COLUMN service_categories.slug IS 'URL-friendly unique identifier within salon';
COMMENT ON COLUMN service_categories.icon IS 'Icon identifier or emoji';

-- Indexes
CREATE INDEX idx_service_categories_salon ON service_categories(salon_id);

-- Apply updated_at trigger
CREATE TRIGGER update_service_categories_updated_at
  BEFORE UPDATE ON service_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SERVICES TABLE
-- Bookable services offered by the salon
-- ============================================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL,

  -- Service Info
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  short_description TEXT,

  -- Duration (in minutes)
  duration_minutes INTEGER NOT NULL,
  buffer_before_minutes INTEGER DEFAULT 0,
  buffer_after_minutes INTEGER DEFAULT 0,

  -- Pricing (in CHF cents for precision)
  price_cents INTEGER NOT NULL,
  price_from BOOLEAN DEFAULT false,

  -- For variable pricing based on hair length
  -- NULL means fixed price, otherwise links to length variants
  has_length_variants BOOLEAN DEFAULT false,

  -- Booking settings
  is_bookable_online BOOLEAN DEFAULT true,
  requires_deposit BOOLEAN DEFAULT false,
  deposit_amount_cents INTEGER,

  -- Display
  sort_order INTEGER DEFAULT 0,
  image_url TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_service_slug_per_salon UNIQUE (salon_id, slug),
  CONSTRAINT positive_duration CHECK (duration_minutes > 0),
  CONSTRAINT positive_price CHECK (price_cents >= 0)
);

COMMENT ON TABLE services IS 'Bookable salon services';
COMMENT ON COLUMN services.duration_minutes IS 'Total service duration';
COMMENT ON COLUMN services.buffer_before_minutes IS 'Preparation time before service';
COMMENT ON COLUMN services.buffer_after_minutes IS 'Cleanup time after service';
COMMENT ON COLUMN services.price_cents IS 'Price in CHF cents (e.g., 4500 = 45.00 CHF)';
COMMENT ON COLUMN services.price_from IS 'If true, price displayed as "ab X CHF"';
COMMENT ON COLUMN services.has_length_variants IS 'If true, service has different prices per hair length';

-- Indexes
CREATE INDEX idx_services_salon ON services(salon_id);
CREATE INDEX idx_services_category ON services(category_id);
CREATE INDEX idx_services_bookable ON services(salon_id, is_bookable_online) WHERE is_active = true;

-- Apply updated_at trigger
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SERVICE_LENGTH_VARIANTS TABLE
-- Different prices based on hair length
-- ============================================
CREATE TABLE service_length_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

  -- Length Info
  name TEXT NOT NULL,
  description TEXT,

  -- Overrides
  duration_minutes INTEGER,
  price_cents INTEGER NOT NULL,

  -- Display
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_variant_price CHECK (price_cents >= 0)
);

COMMENT ON TABLE service_length_variants IS 'Hair length variants for services';
COMMENT ON COLUMN service_length_variants.name IS 'E.g., "Kurz", "Mittel", "Lang"';
COMMENT ON COLUMN service_length_variants.duration_minutes IS 'Override duration, NULL uses service default';

-- Indexes
CREATE INDEX idx_service_variants_service ON service_length_variants(service_id);

-- ============================================
-- STAFF_SERVICE_SKILLS TABLE
-- Maps which staff can perform which services
-- ============================================
CREATE TABLE staff_service_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

  -- Skill level (optional, for future use)
  skill_level INTEGER DEFAULT 3 CHECK (skill_level BETWEEN 1 AND 5),

  -- Custom pricing (NULL = use service default)
  custom_price_cents INTEGER,
  custom_duration_minutes INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_staff_service UNIQUE (staff_id, service_id)
);

COMMENT ON TABLE staff_service_skills IS 'Staff skills and service assignments';
COMMENT ON COLUMN staff_service_skills.skill_level IS 'Skill level 1-5 (5 = expert)';
COMMENT ON COLUMN staff_service_skills.custom_price_cents IS 'Staff-specific price override';

-- Indexes
CREATE INDEX idx_staff_skills_staff ON staff_service_skills(staff_id);
CREATE INDEX idx_staff_skills_service ON staff_service_skills(service_id);

-- ============================================
-- ADDON_SERVICES TABLE
-- Optional add-on services that can be booked with main service
-- ============================================
CREATE TABLE addon_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Addon Info
  name TEXT NOT NULL,
  description TEXT,

  -- Duration & Price
  duration_minutes INTEGER DEFAULT 0,
  price_cents INTEGER NOT NULL,

  -- Display
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_addon_price CHECK (price_cents >= 0)
);

COMMENT ON TABLE addon_services IS 'Add-on services (treatments, etc.)';
COMMENT ON COLUMN addon_services.duration_minutes IS 'Additional time needed, 0 if concurrent';

-- Indexes
CREATE INDEX idx_addon_services_salon ON addon_services(salon_id);

-- Apply updated_at trigger
CREATE TRIGGER update_addon_services_updated_at
  BEFORE UPDATE ON addon_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SERVICE_ADDON_COMPATIBILITY TABLE
-- Defines which addons can be used with which services
-- ============================================
CREATE TABLE service_addon_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  addon_service_id UUID NOT NULL REFERENCES addon_services(id) ON DELETE CASCADE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_service_addon UNIQUE (service_id, addon_service_id)
);

COMMENT ON TABLE service_addon_compatibility IS 'Maps which addons work with which services';

-- Indexes
CREATE INDEX idx_addon_compat_service ON service_addon_compatibility(service_id);
CREATE INDEX idx_addon_compat_addon ON service_addon_compatibility(addon_service_id);

-- ============================================
-- VIEW: Services with category info
-- ============================================
CREATE VIEW v_services_with_category AS
SELECT
  s.*,
  sc.name AS category_name,
  sc.slug AS category_slug,
  sc.icon AS category_icon,
  (s.price_cents::DECIMAL / 100) AS price_chf,
  s.duration_minutes + COALESCE(s.buffer_before_minutes, 0) + COALESCE(s.buffer_after_minutes, 0) AS total_duration_minutes
FROM services s
LEFT JOIN service_categories sc ON s.category_id = sc.id
WHERE s.is_active = true;

COMMENT ON VIEW v_services_with_category IS 'Active services with category information';

-- ============================================
-- VIEW: Staff with their services
-- ============================================
CREATE VIEW v_staff_services AS
SELECT
  s.id AS staff_id,
  s.salon_id,
  s.display_name AS staff_name,
  sv.id AS service_id,
  sv.name AS service_name,
  COALESCE(ssk.custom_price_cents, sv.price_cents) AS effective_price_cents,
  COALESCE(ssk.custom_duration_minutes, sv.duration_minutes) AS effective_duration_minutes,
  ssk.skill_level
FROM staff s
JOIN staff_service_skills ssk ON s.id = ssk.staff_id
JOIN services sv ON ssk.service_id = sv.id
WHERE s.is_active = true AND sv.is_active = true;

COMMENT ON VIEW v_staff_services IS 'Staff members with their assignable services';

-- ============================================
-- HELPER FUNCTION: Get service total duration
-- ============================================
CREATE OR REPLACE FUNCTION get_service_total_duration(service_id_param UUID)
RETURNS INTEGER AS $$
  SELECT duration_minutes + COALESCE(buffer_before_minutes, 0) + COALESCE(buffer_after_minutes, 0)
  FROM services
  WHERE id = service_id_param;
$$ LANGUAGE sql STABLE;

-- ============================================
-- HELPER FUNCTION: Get service price in CHF
-- ============================================
CREATE OR REPLACE FUNCTION get_service_price_chf(service_id_param UUID)
RETURNS DECIMAL(10,2) AS $$
  SELECT (price_cents::DECIMAL / 100)
  FROM services
  WHERE id = service_id_param;
$$ LANGUAGE sql STABLE;

-- ============================================
-- HELPER FUNCTION: Can staff perform service?
-- ============================================
CREATE OR REPLACE FUNCTION can_staff_perform_service(staff_id_param UUID, service_id_param UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff_service_skills
    WHERE staff_id = staff_id_param AND service_id = service_id_param
  );
$$ LANGUAGE sql STABLE;

-- ============================================
-- HELPER FUNCTION: Get staff who can perform service
-- ============================================
CREATE OR REPLACE FUNCTION get_staff_for_service(service_id_param UUID)
RETURNS TABLE (
  staff_id UUID,
  display_name TEXT,
  effective_price_cents INTEGER,
  effective_duration_minutes INTEGER
) AS $$
  SELECT
    s.id AS staff_id,
    s.display_name,
    COALESCE(ssk.custom_price_cents, sv.price_cents) AS effective_price_cents,
    COALESCE(ssk.custom_duration_minutes, sv.duration_minutes) AS effective_duration_minutes
  FROM staff s
  JOIN staff_service_skills ssk ON s.id = ssk.staff_id
  JOIN services sv ON ssk.service_id = sv.id
  WHERE sv.id = service_id_param
    AND s.is_active = true
    AND s.is_bookable = true
    AND sv.is_active = true;
$$ LANGUAGE sql STABLE;
