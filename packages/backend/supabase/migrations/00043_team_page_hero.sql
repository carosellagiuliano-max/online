-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00043_team_page_hero.sql
-- Description: Add configurable hero section for team page (Join Us section)
-- ============================================

-- Add team page hero columns to salons table
ALTER TABLE salons ADD COLUMN IF NOT EXISTS team_hero_headline TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS team_hero_description TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS team_hero_benefits TEXT[]; -- Array of benefit strings
ALTER TABLE salons ADD COLUMN IF NOT EXISTS team_hero_image_url TEXT;

COMMENT ON COLUMN salons.team_hero_headline IS 'Headline for the "Join Us" section on team page';
COMMENT ON COLUMN salons.team_hero_description IS 'Description text for the "Join Us" section';
COMMENT ON COLUMN salons.team_hero_benefits IS 'Array of benefit bullet points';
COMMENT ON COLUMN salons.team_hero_image_url IS 'Image URL for the "Join Us" section';

-- Create the team-images storage bucket (minimal columns - storage-api adds others on startup)
INSERT INTO storage.buckets (id, name)
VALUES ('team-images', 'team-images')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE RLS POLICIES
-- ============================================

-- Drop any existing policies on team-images bucket (for idempotency)
DROP POLICY IF EXISTS "Team images public read" ON storage.objects;
DROP POLICY IF EXISTS "Team images authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Team images authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Team images authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Team images anon upload" ON storage.objects;
DROP POLICY IF EXISTS "Team images anon update" ON storage.objects;
DROP POLICY IF EXISTS "Team images anon delete" ON storage.objects;

-- Allow public read access to team-images bucket
CREATE POLICY "Team images public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'team-images');

-- Allow authenticated users to upload to team-images bucket
CREATE POLICY "Team images authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'team-images');

-- Allow authenticated users to update in team-images bucket
CREATE POLICY "Team images authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'team-images');

-- Allow authenticated users to delete from team-images bucket
CREATE POLICY "Team images authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'team-images');

-- Allow anon role to insert (for server-side API routes using service role)
CREATE POLICY "Team images anon upload"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'team-images');

-- Allow anon role to update
CREATE POLICY "Team images anon update"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'team-images');

-- Allow anon role to delete
CREATE POLICY "Team images anon delete"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'team-images');
