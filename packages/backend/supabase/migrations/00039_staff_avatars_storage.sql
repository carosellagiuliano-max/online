-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00039_staff_avatars_storage.sql
-- Description: Staff avatars storage bucket and policies
-- ============================================

-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================

-- Create the staff-avatars storage bucket (minimal columns - storage-api adds others on startup)
INSERT INTO storage.buckets (id, name)
VALUES ('staff-avatars', 'staff-avatars')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE RLS POLICIES
-- ============================================

-- Drop any existing policies on staff-avatars bucket (for idempotency)
DROP POLICY IF EXISTS "Staff avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "Staff avatars authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Staff avatars authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Staff avatars authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Staff avatars anon upload" ON storage.objects;
DROP POLICY IF EXISTS "Staff avatars anon update" ON storage.objects;
DROP POLICY IF EXISTS "Staff avatars anon delete" ON storage.objects;

-- Allow public read access to staff-avatars bucket
CREATE POLICY "Staff avatars public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'staff-avatars');

-- Allow authenticated users to upload to staff-avatars bucket
CREATE POLICY "Staff avatars authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'staff-avatars');

-- Allow authenticated users to update in staff-avatars bucket
CREATE POLICY "Staff avatars authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'staff-avatars');

-- Allow authenticated users to delete from staff-avatars bucket
CREATE POLICY "Staff avatars authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'staff-avatars');

-- Allow anon role to insert (for server-side API routes using service role)
CREATE POLICY "Staff avatars anon upload"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'staff-avatars');

-- Allow anon role to update
CREATE POLICY "Staff avatars anon update"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'staff-avatars');

-- Allow anon role to delete
CREATE POLICY "Staff avatars anon delete"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'staff-avatars');
