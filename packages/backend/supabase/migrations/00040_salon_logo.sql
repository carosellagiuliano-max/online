-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00040_salon_logo.sql
-- Description: Add logo_url and homepage settings to salons table
-- ============================================

-- Add logo_url column to salons table
ALTER TABLE salons ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add homepage hero settings columns
ALTER TABLE salons ADD COLUMN IF NOT EXISTS hero_tagline TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS hero_headline TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS hero_headline_accent TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS hero_description TEXT;

-- Add comments for documentation
COMMENT ON COLUMN salons.logo_url IS 'URL to the salon logo image stored in Supabase Storage';
COMMENT ON COLUMN salons.hero_tagline IS 'Hero section tagline (e.g., "Premium Friseursalon St. Gallen")';
COMMENT ON COLUMN salons.hero_headline IS 'Hero section main headline (e.g., "Your Style.")';
COMMENT ON COLUMN salons.hero_headline_accent IS 'Hero section highlighted text (e.g., "Your Statement.")';
COMMENT ON COLUMN salons.hero_description IS 'Hero section description text';

-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================

-- Create the salon-logos storage bucket (minimal columns - storage-api adds others on startup)
INSERT INTO storage.buckets (id, name)
VALUES ('salon-logos', 'salon-logos')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE RLS POLICIES
-- ============================================

-- Drop any existing policies on salon-logos bucket (for idempotency)
DROP POLICY IF EXISTS "Salon logos public read" ON storage.objects;
DROP POLICY IF EXISTS "Salon logos authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Salon logos authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Salon logos authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Salon logos anon upload" ON storage.objects;
DROP POLICY IF EXISTS "Salon logos anon update" ON storage.objects;
DROP POLICY IF EXISTS "Salon logos anon delete" ON storage.objects;

-- Allow public read access to salon-logos bucket
CREATE POLICY "Salon logos public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'salon-logos');

-- Allow authenticated users to upload to salon-logos bucket
CREATE POLICY "Salon logos authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'salon-logos');

-- Allow authenticated users to update in salon-logos bucket
CREATE POLICY "Salon logos authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'salon-logos');

-- Allow authenticated users to delete from salon-logos bucket
CREATE POLICY "Salon logos authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'salon-logos');

-- Allow anon role to insert (for server-side API routes using service role)
CREATE POLICY "Salon logos anon upload"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'salon-logos');

-- Allow anon role to update
CREATE POLICY "Salon logos anon update"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'salon-logos');

-- Allow anon role to delete
CREATE POLICY "Salon logos anon delete"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'salon-logos');
