-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00037_gallery.sql
-- Description: Gallery categories and images
-- ============================================

-- ============================================
-- GALLERY_CATEGORIES TABLE
-- Flat categories for organizing gallery images
-- ============================================
CREATE TABLE gallery_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Category Info
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,

  -- Display
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_gallery_category_slug_per_salon UNIQUE (salon_id, slug)
);

COMMENT ON TABLE gallery_categories IS 'Gallery categories for organizing images';

-- Indexes
CREATE INDEX idx_gallery_categories_salon ON gallery_categories(salon_id);
CREATE INDEX idx_gallery_categories_active ON gallery_categories(salon_id, is_active) WHERE is_active = true;

-- Apply updated_at trigger
CREATE TRIGGER update_gallery_categories_updated_at
  BEFORE UPDATE ON gallery_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- GALLERY_IMAGES TABLE
-- Images in the gallery
-- ============================================
CREATE TABLE gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  category_id UUID REFERENCES gallery_categories(id) ON DELETE SET NULL,

  -- Image Info
  url TEXT NOT NULL,
  alt_text TEXT,
  title TEXT,

  -- Source tracking (for Supabase Storage uploads)
  storage_path TEXT,

  -- Display
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE gallery_images IS 'Gallery images for salon showcase';
COMMENT ON COLUMN gallery_images.storage_path IS 'Path in Supabase Storage bucket, null for external URLs';

-- Indexes
CREATE INDEX idx_gallery_images_salon ON gallery_images(salon_id);
CREATE INDEX idx_gallery_images_category ON gallery_images(category_id);
CREATE INDEX idx_gallery_images_active ON gallery_images(salon_id, is_active) WHERE is_active = true;

-- Apply updated_at trigger
CREATE TRIGGER update_gallery_images_updated_at
  BEFORE UPDATE ON gallery_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEW: Published gallery with categories
-- ============================================
CREATE VIEW v_published_gallery AS
SELECT
  gi.*,
  gc.name AS category_name,
  gc.slug AS category_slug
FROM gallery_images gi
LEFT JOIN gallery_categories gc ON gi.category_id = gc.id
WHERE gi.is_active = true
  AND (gc.is_active = true OR gc.id IS NULL)
ORDER BY gc.sort_order, gi.sort_order;

COMMENT ON VIEW v_published_gallery IS 'Active gallery images for public display';

-- ============================================
-- RLS POLICIES (disabled for simplicity)
-- ============================================

-- RLS is disabled for gallery tables to allow direct admin access
-- The admin interface handles authentication separately
-- Storage bucket and policies are in 00038_gallery_storage.sql
