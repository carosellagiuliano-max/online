-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00050_product_images_storage.sql
-- Description: Product images storage bucket and policies
-- ============================================

-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================

-- Create the product-images storage bucket
INSERT INTO storage.buckets (id, name)
VALUES ('product-images', 'product-images')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE RLS POLICIES
-- ============================================

-- Drop any existing policies on product-images bucket (for idempotency)
DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
DROP POLICY IF EXISTS "Product images authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Product images authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Product images authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Product images anon upload" ON storage.objects;
DROP POLICY IF EXISTS "Product images anon update" ON storage.objects;
DROP POLICY IF EXISTS "Product images anon delete" ON storage.objects;

-- Allow public read access to product-images bucket
CREATE POLICY "Product images public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Allow authenticated users to upload to product-images bucket
CREATE POLICY "Product images authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow authenticated users to update in product-images bucket
CREATE POLICY "Product images authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- Allow authenticated users to delete from product-images bucket
CREATE POLICY "Product images authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Allow anon role to insert (for server-side API routes using service role)
CREATE POLICY "Product images anon upload"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'product-images');

-- Allow anon role to update
CREATE POLICY "Product images anon update"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'product-images');

-- Allow anon role to delete
CREATE POLICY "Product images anon delete"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'product-images');
