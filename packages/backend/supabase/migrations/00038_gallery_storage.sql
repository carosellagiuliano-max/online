-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00038_gallery_storage.sql
-- Description: Gallery storage bucket and policies
-- ============================================

-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================

-- Create the gallery storage bucket (minimal columns - storage-api adds others on startup)
INSERT INTO storage.buckets (id, name)
VALUES ('gallery', 'gallery')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE RLS POLICIES
-- ============================================

-- Enable RLS on storage.objects (required for policies to work)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies on gallery bucket (for idempotency)
DROP POLICY IF EXISTS "Gallery public read" ON storage.objects;
DROP POLICY IF EXISTS "Gallery authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Gallery authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Gallery authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Gallery anon upload" ON storage.objects;
DROP POLICY IF EXISTS "Gallery anon update" ON storage.objects;
DROP POLICY IF EXISTS "Gallery anon delete" ON storage.objects;

-- Allow public read access to gallery bucket
CREATE POLICY "Gallery public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gallery');

-- Allow authenticated users to upload to gallery bucket
CREATE POLICY "Gallery authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'gallery');

-- Allow authenticated users to update in gallery bucket
CREATE POLICY "Gallery authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'gallery');

-- Allow authenticated users to delete from gallery bucket
CREATE POLICY "Gallery authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'gallery');

-- Allow anon role to insert (for server-side API routes using service role)
CREATE POLICY "Gallery anon upload"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'gallery');

-- Allow anon role to update
CREATE POLICY "Gallery anon update"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'gallery');

-- Allow anon role to delete
CREATE POLICY "Gallery anon delete"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'gallery');

-- Grant necessary permissions to roles
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.buckets TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO anon;
