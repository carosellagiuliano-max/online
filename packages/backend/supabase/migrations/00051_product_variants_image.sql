-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00051_product_variants_image.sql
-- Description: Add image_url column to product_variants
-- ============================================

-- Add image_url column to product_variants table
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment
COMMENT ON COLUMN product_variants.image_url IS 'URL to variant-specific product image';
