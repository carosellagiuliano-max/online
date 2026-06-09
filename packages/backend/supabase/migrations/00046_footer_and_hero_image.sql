-- Add footer description and homepage hero image fields

-- Footer description (separate from tagline)
ALTER TABLE salons ADD COLUMN IF NOT EXISTS footer_description TEXT;

-- Homepage hero image URL
ALTER TABLE salons ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

-- Comments
COMMENT ON COLUMN salons.footer_description IS 'Short description text shown in the footer';
COMMENT ON COLUMN salons.hero_image_url IS 'URL for the homepage hero section background image';
