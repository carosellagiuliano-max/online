-- ============================================
-- Migration: 00044_salon_extended_config.sql
-- Description: Extend salons table with branding, SEO, and social fields
-- ============================================

-- Add branding and business info columns
ALTER TABLE salons ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'de-CH';

-- Add social media columns
ALTER TABLE salons ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS facebook_url TEXT;

-- Add SEO columns (could be in settings_json, but explicit columns are clearer)
ALTER TABLE salons ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS seo_keywords TEXT[];
ALTER TABLE salons ADD COLUMN IF NOT EXISTS og_image_url TEXT;

-- Comments
COMMENT ON COLUMN salons.tagline IS 'Short tagline/slogan for the salon';
COMMENT ON COLUMN salons.owner_name IS 'Name of the salon owner';
COMMENT ON COLUMN salons.logo_url IS 'URL to salon logo in storage';
COMMENT ON COLUMN salons.locale IS 'Locale for formatting (e.g., de-CH, en-US)';
COMMENT ON COLUMN salons.instagram_url IS 'Instagram profile URL';
COMMENT ON COLUMN salons.facebook_url IS 'Facebook page URL';
COMMENT ON COLUMN salons.seo_title IS 'SEO meta title';
COMMENT ON COLUMN salons.seo_description IS 'SEO meta description';
COMMENT ON COLUMN salons.seo_keywords IS 'SEO keywords array';
COMMENT ON COLUMN salons.og_image_url IS 'Open Graph image URL';
