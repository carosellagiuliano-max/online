-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00042_about_page_sections.sql
-- Description: Add configurable sections for about page (values, milestones)
-- ============================================

-- Add visibility toggles to salons table
ALTER TABLE salons ADD COLUMN IF NOT EXISTS show_values_section BOOLEAN DEFAULT true;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS show_milestones_section BOOLEAN DEFAULT true;

COMMENT ON COLUMN salons.show_values_section IS 'Whether to show the "Unsere Werte" section on the about page';
COMMENT ON COLUMN salons.show_milestones_section IS 'Whether to show the "Meilensteine" section on the about page';

-- ============================================
-- VALUES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS about_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'sparkles', -- lucide icon name: award, heart, sparkles, star, etc.
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_about_values_salon ON about_values(salon_id);
CREATE INDEX IF NOT EXISTS idx_about_values_sort ON about_values(salon_id, sort_order);

-- Add RLS
ALTER TABLE about_values ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "About values public read"
  ON about_values FOR SELECT
  TO public
  USING (is_active = true);

-- Allow authenticated users full access
CREATE POLICY "About values authenticated full access"
  ON about_values FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER set_about_values_updated_at
  BEFORE UPDATE ON about_values
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE about_values IS 'Configurable values/principles shown on the about page';

-- ============================================
-- MILESTONES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS about_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_about_milestones_salon ON about_milestones(salon_id);
CREATE INDEX IF NOT EXISTS idx_about_milestones_sort ON about_milestones(salon_id, sort_order);

-- Add RLS
ALTER TABLE about_milestones ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "About milestones public read"
  ON about_milestones FOR SELECT
  TO public
  USING (is_active = true);

-- Allow authenticated users full access
CREATE POLICY "About milestones authenticated full access"
  ON about_milestones FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER set_about_milestones_updated_at
  BEFORE UPDATE ON about_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE about_milestones IS 'Configurable milestones/timeline shown on the about page';

-- NOTE: Seed data for about_values and about_milestones is in seed.sql
-- because it depends on the salon existing first.
