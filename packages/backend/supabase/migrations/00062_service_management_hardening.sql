-- ============================================
-- 00062: Service management hardening
-- Keep service/category/skill relationships tenant-safe at database level.
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_duration_professional_range'
  ) THEN
    ALTER TABLE services
      ADD CONSTRAINT services_duration_professional_range
      CHECK (duration_minutes BETWEEN 5 AND 480);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_length_variants_duration_professional_range'
  ) THEN
    ALTER TABLE service_length_variants
      ADD CONSTRAINT service_length_variants_duration_professional_range
      CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 5 AND 480);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_service_skills_custom_price_non_negative'
  ) THEN
    ALTER TABLE staff_service_skills
      ADD CONSTRAINT staff_service_skills_custom_price_non_negative
      CHECK (custom_price_cents IS NULL OR custom_price_cents >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_service_skills_custom_duration_professional_range'
  ) THEN
    ALTER TABLE staff_service_skills
      ADD CONSTRAINT staff_service_skills_custom_duration_professional_range
      CHECK (custom_duration_minutes IS NULL OR custom_duration_minutes BETWEEN 5 AND 480);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION ensure_service_category_same_salon()
RETURNS TRIGGER AS $$
DECLARE
  category_salon_id UUID;
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT salon_id INTO category_salon_id
  FROM service_categories
  WHERE id = NEW.category_id;

  IF category_salon_id IS NULL THEN
    RAISE EXCEPTION 'Service category % does not exist', NEW.category_id;
  END IF;

  IF category_salon_id <> NEW.salon_id THEN
    RAISE EXCEPTION 'Service category belongs to another salon';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_service_category_same_salon_trigger ON services;
CREATE TRIGGER ensure_service_category_same_salon_trigger
  BEFORE INSERT OR UPDATE OF salon_id, category_id ON services
  FOR EACH ROW
  EXECUTE FUNCTION ensure_service_category_same_salon();

CREATE OR REPLACE FUNCTION ensure_staff_service_skill_same_salon()
RETURNS TRIGGER AS $$
DECLARE
  staff_salon_id UUID;
  service_salon_id UUID;
BEGIN
  SELECT salon_id INTO staff_salon_id
  FROM staff
  WHERE id = NEW.staff_id;

  SELECT salon_id INTO service_salon_id
  FROM services
  WHERE id = NEW.service_id;

  IF staff_salon_id IS NULL THEN
    RAISE EXCEPTION 'Staff member % does not exist', NEW.staff_id;
  END IF;

  IF service_salon_id IS NULL THEN
    RAISE EXCEPTION 'Service % does not exist', NEW.service_id;
  END IF;

  IF staff_salon_id <> service_salon_id THEN
    RAISE EXCEPTION 'Staff member and service belong to different salons';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_staff_service_skill_same_salon_trigger ON staff_service_skills;
CREATE TRIGGER ensure_staff_service_skill_same_salon_trigger
  BEFORE INSERT OR UPDATE OF staff_id, service_id ON staff_service_skills
  FOR EACH ROW
  EXECUTE FUNCTION ensure_staff_service_skill_same_salon();

CREATE OR REPLACE FUNCTION ensure_service_addon_same_salon()
RETURNS TRIGGER AS $$
DECLARE
  service_salon_id UUID;
  addon_salon_id UUID;
BEGIN
  SELECT salon_id INTO service_salon_id
  FROM services
  WHERE id = NEW.service_id;

  SELECT salon_id INTO addon_salon_id
  FROM addon_services
  WHERE id = NEW.addon_service_id;

  IF service_salon_id IS NULL THEN
    RAISE EXCEPTION 'Service % does not exist', NEW.service_id;
  END IF;

  IF addon_salon_id IS NULL THEN
    RAISE EXCEPTION 'Add-on service % does not exist', NEW.addon_service_id;
  END IF;

  IF service_salon_id <> addon_salon_id THEN
    RAISE EXCEPTION 'Service and add-on service belong to different salons';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_service_addon_same_salon_trigger ON service_addon_compatibility;
CREATE TRIGGER ensure_service_addon_same_salon_trigger
  BEFORE INSERT OR UPDATE OF service_id, addon_service_id ON service_addon_compatibility
  FOR EACH ROW
  EXECUTE FUNCTION ensure_service_addon_same_salon();

NOTIFY pgrst, 'reload schema';
