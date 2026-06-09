-- ============================================
-- SOCIAL LINKS TABLE
-- ============================================
-- Stores social media links for salons with enable/disable functionality

-- Create social_links table
CREATE TABLE IF NOT EXISTS social_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'instagram', 'facebook', 'tiktok', 'youtube', etc.
    url TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique platform per salon
    UNIQUE(salon_id, platform)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_social_links_salon_id ON social_links(salon_id);
CREATE INDEX IF NOT EXISTS idx_social_links_enabled ON social_links(salon_id, is_enabled) WHERE is_enabled = true;

-- Enable RLS
ALTER TABLE social_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read enabled social links (public website)
CREATE POLICY "Public can view enabled social links"
    ON social_links
    FOR SELECT
    USING (is_enabled = true);

-- Authenticated users can view all social links (admin)
CREATE POLICY "Authenticated users can view all social links"
    ON social_links
    FOR SELECT
    TO authenticated
    USING (true);

-- Service role can do everything
CREATE POLICY "Service role has full access to social links"
    ON social_links
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Updated at trigger
CREATE TRIGGER update_social_links_updated_at
    BEFORE UPDATE ON social_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default social links for existing salons
INSERT INTO social_links (salon_id, platform, url, is_enabled, sort_order)
SELECT
    id,
    'instagram',
    'https://instagram.com',
    true,
    1
FROM salons
WHERE NOT EXISTS (
    SELECT 1 FROM social_links WHERE social_links.salon_id = salons.id AND platform = 'instagram'
);

INSERT INTO social_links (salon_id, platform, url, is_enabled, sort_order)
SELECT
    id,
    'facebook',
    'https://facebook.com',
    true,
    2
FROM salons
WHERE NOT EXISTS (
    SELECT 1 FROM social_links WHERE social_links.salon_id = salons.id AND platform = 'facebook'
);

-- Grant permissions
GRANT SELECT ON social_links TO anon;
GRANT SELECT ON social_links TO authenticated;
GRANT ALL ON social_links TO service_role;
