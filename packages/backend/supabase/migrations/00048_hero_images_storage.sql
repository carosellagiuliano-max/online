-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00048_hero_images_storage.sql
-- Description: Hero images storage bucket and policies
-- ============================================

-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================

-- Create the hero-images storage bucket (minimal columns - storage-api adds others on startup)
INSERT INTO storage.buckets (id, name)
VALUES ('hero-images', 'hero-images')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE RLS POLICIES
-- ============================================

-- Drop any existing policies on hero-images bucket (for idempotency)
DROP POLICY IF EXISTS "Hero images public read" ON storage.objects;
DROP POLICY IF EXISTS "Hero images authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Hero images authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Hero images authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Hero images anon upload" ON storage.objects;
DROP POLICY IF EXISTS "Hero images anon update" ON storage.objects;
DROP POLICY IF EXISTS "Hero images anon delete" ON storage.objects;

-- Allow public read access to hero-images bucket
CREATE POLICY "Hero images public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'hero-images');

-- Allow authenticated users to upload to hero-images bucket
CREATE POLICY "Hero images authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'hero-images');

-- Allow authenticated users to update in hero-images bucket
CREATE POLICY "Hero images authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'hero-images');

-- Allow authenticated users to delete from hero-images bucket
CREATE POLICY "Hero images authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'hero-images');

-- Allow anon role to insert (for server-side API routes using service role)
CREATE POLICY "Hero images anon upload"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'hero-images');

-- Allow anon role to update
CREATE POLICY "Hero images anon update"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'hero-images');

-- Allow anon role to delete
CREATE POLICY "Hero images anon delete"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'hero-images');
