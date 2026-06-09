-- ============================================
-- Gallery Admin/Public hardening
-- Adds homepage-specific publishing fields and closes unsafe direct storage writes.
-- ============================================

ALTER TABLE gallery_images
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS show_on_homepage BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_gallery_images_homepage
  ON gallery_images(salon_id, show_on_homepage, is_active, sort_order)
  WHERE is_active = true AND show_on_homepage = true;

DROP VIEW IF EXISTS v_published_gallery;
CREATE VIEW v_published_gallery AS
SELECT
  gi.*,
  gc.name AS category_name,
  gc.slug AS category_slug,
  gc.sort_order AS category_sort_order
FROM gallery_images gi
LEFT JOIN gallery_categories gc ON gi.category_id = gc.id
WHERE gi.is_active = true
  AND (gc.is_active = true OR gc.id IS NULL)
ORDER BY gc.sort_order NULLS LAST, gi.sort_order, gi.created_at;

COMMENT ON VIEW v_published_gallery IS 'Active gallery images for public display';

ALTER TABLE gallery_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gallery categories public read active" ON gallery_categories;
DROP POLICY IF EXISTS "Gallery images public read active" ON gallery_images;

CREATE POLICY "Gallery categories public read active"
ON gallery_categories FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Gallery images public read active"
ON gallery_images FOR SELECT
TO public
USING (
  is_active = true
  AND (
    category_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM gallery_categories gc
      WHERE gc.id = gallery_images.category_id
        AND gc.salon_id = gallery_images.salon_id
        AND gc.is_active = true
    )
  )
);

DROP POLICY IF EXISTS "Gallery authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Gallery authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Gallery authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Gallery anon upload" ON storage.objects;
DROP POLICY IF EXISTS "Gallery anon update" ON storage.objects;
DROP POLICY IF EXISTS "Gallery anon delete" ON storage.objects;

DROP POLICY IF EXISTS "Gallery public read" ON storage.objects;
CREATE POLICY "Gallery public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gallery');

NOTIFY pgrst, 'reload schema';
