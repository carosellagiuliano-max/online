-- ============================================
-- Migration: 00054_fix_product_images_bucket_public.sql
-- Description: Ensure product-images bucket is public
-- ============================================

-- No-op: bucket visibility is managed by storage-api and RLS policies
-- The storage.buckets table in this Supabase version does not have a 'public' column
SELECT 1;
