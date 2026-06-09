-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00041_about_page_hero.sql
-- Description: Add about page hero settings to salons table
-- ============================================

-- Add about page hero columns to salons table
ALTER TABLE salons ADD COLUMN IF NOT EXISTS about_hero_tagline TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS about_hero_headline TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS about_hero_description TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS about_hero_image_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN salons.about_hero_tagline IS 'About page hero section tagline (e.g., "Unsere Geschichte")';
COMMENT ON COLUMN salons.about_hero_headline IS 'About page hero section headline (e.g., "Über BeautifyPRO")';
COMMENT ON COLUMN salons.about_hero_description IS 'About page hero section description text';
COMMENT ON COLUMN salons.about_hero_image_url IS 'URL to the about page hero image stored in Supabase Storage';

-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================

-- Create the about-images storage bucket (minimal columns - storage-api adds others on startup)
INSERT INTO storage.buckets (id, name)
VALUES ('about-images', 'about-images')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE RLS POLICIES
-- ============================================

-- Drop any existing policies on about-images bucket (for idempotency)
DROP POLICY IF EXISTS "About images public read" ON storage.objects;
DROP POLICY IF EXISTS "About images authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "About images authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "About images authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "About images anon upload" ON storage.objects;
DROP POLICY IF EXISTS "About images anon update" ON storage.objects;
DROP POLICY IF EXISTS "About images anon delete" ON storage.objects;

-- Allow public read access to about-images bucket
CREATE POLICY "About images public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'about-images');

-- Allow authenticated users to upload to about-images bucket
CREATE POLICY "About images authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'about-images');

-- Allow authenticated users to update in about-images bucket
CREATE POLICY "About images authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'about-images');

-- Allow authenticated users to delete from about-images bucket
CREATE POLICY "About images authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'about-images');

-- Allow anon role to insert (for server-side API routes using service role)
CREATE POLICY "About images anon upload"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'about-images');

-- Allow anon role to update
CREATE POLICY "About images anon update"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'about-images');

-- Allow anon role to delete
CREATE POLICY "About images anon delete"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'about-images');
