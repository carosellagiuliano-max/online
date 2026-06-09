-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00006_shop.sql
-- Description: Products, categories, inventory
-- ============================================

-- ============================================
-- PRODUCT_CATEGORIES TABLE
-- Groups products for navigation
-- ============================================
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Category Info
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  image_url TEXT,

  -- Parent category for hierarchy
  parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,

  -- Display
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_product_category_slug_per_salon UNIQUE (salon_id, slug)
);

COMMENT ON TABLE product_categories IS 'Product categories for shop';
COMMENT ON COLUMN product_categories.parent_id IS 'Parent category for hierarchical structure';

-- Indexes
CREATE INDEX idx_product_categories_salon ON product_categories(salon_id);
CREATE INDEX idx_product_categories_parent ON product_categories(parent_id);

-- Apply updated_at trigger
CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PRODUCTS TABLE
-- Products available for purchase
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,

  -- Product Info
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  brand TEXT,

  -- SKU for inventory management
  sku TEXT,

  -- Pricing (in CHF cents)
  price_cents INTEGER NOT NULL,
  compare_at_price_cents INTEGER,
  cost_price_cents INTEGER,

  -- Tax
  vat_rate DECIMAL(5,2) DEFAULT 8.1,

  -- Inventory
  track_inventory BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  allow_backorder BOOLEAN DEFAULT false,

  -- Shipping
  weight_grams INTEGER,
  requires_shipping BOOLEAN DEFAULT true,

  -- Display
  sort_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_product_slug_per_salon UNIQUE (salon_id, slug),
  CONSTRAINT unique_product_sku_per_salon UNIQUE (salon_id, sku),
  CONSTRAINT positive_product_price CHECK (price_cents >= 0)
);

COMMENT ON TABLE products IS 'Products available in shop';
COMMENT ON COLUMN products.price_cents IS 'Price in CHF cents';
COMMENT ON COLUMN products.compare_at_price_cents IS 'Original price for sale items';
COMMENT ON COLUMN products.cost_price_cents IS 'Cost price for margin calculation';
COMMENT ON COLUMN products.low_stock_threshold IS 'Alert threshold for low stock';

-- Indexes
CREATE INDEX idx_products_salon ON products(salon_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sku ON products(salon_id, sku);
CREATE INDEX idx_products_active ON products(salon_id, is_active, is_published) WHERE is_active = true AND is_published = true;
CREATE INDEX idx_products_low_stock ON products(salon_id, stock_quantity)
  WHERE track_inventory = true AND stock_quantity <= low_stock_threshold;

-- Apply updated_at trigger
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PRODUCT_IMAGES TABLE
-- Multiple images per product
-- ============================================
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Image Info
  url TEXT NOT NULL,
  alt_text TEXT,

  -- Display
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE product_images IS 'Product images gallery';
COMMENT ON COLUMN product_images.is_primary IS 'Primary image shown in listings';

-- Indexes
CREATE INDEX idx_product_images_product ON product_images(product_id);

-- ============================================
-- PRODUCT_VARIANTS TABLE
-- Product variants (size, color, etc.)
-- ============================================
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Variant Info
  name TEXT NOT NULL,
  sku TEXT,

  -- Pricing overrides
  price_cents INTEGER,
  compare_at_price_cents INTEGER,

  -- Inventory overrides
  stock_quantity INTEGER DEFAULT 0,

  -- Attributes (JSON for flexibility)
  -- Format: { "size": "500ml", "scent": "Lavender" }
  attributes JSONB DEFAULT '{}',

  -- Display
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE product_variants IS 'Product variants (different sizes, etc.)';
COMMENT ON COLUMN product_variants.attributes IS 'Variant attributes as JSON';

-- Indexes
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);

-- Apply updated_at trigger
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STOCK_MOVEMENTS TABLE
-- Track inventory changes
-- ============================================
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,

  -- Movement Info
  movement_type stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,

  -- Reference (order_id, adjustment_id, etc.)
  reference_type TEXT,
  reference_id UUID,

  -- Notes
  notes TEXT,

  -- Who made the change
  created_by UUID REFERENCES profiles(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE stock_movements IS 'Inventory movement audit trail';
COMMENT ON COLUMN stock_movements.reference_type IS 'Type of reference (order, adjustment, etc.)';
COMMENT ON COLUMN stock_movements.reference_id IS 'ID of related record';

-- Indexes
CREATE INDEX idx_stock_movements_salon ON stock_movements(salon_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- ============================================
-- VOUCHERS TABLE
-- Gift vouchers / gift cards
-- ============================================
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Voucher Info
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'gift_card',

  -- Value
  initial_value_cents INTEGER NOT NULL,
  remaining_value_cents INTEGER NOT NULL,

  -- Validity
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_single_use BOOLEAN DEFAULT false,

  -- Purchase info
  purchased_by_customer_id UUID REFERENCES customers(id),
  recipient_email TEXT,
  recipient_name TEXT,
  personal_message TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  redeemed_at TIMESTAMPTZ,
  redeemed_by_customer_id UUID REFERENCES customers(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_voucher_code_per_salon UNIQUE (salon_id, code),
  CONSTRAINT positive_voucher_value CHECK (initial_value_cents > 0),
  CONSTRAINT valid_remaining_value CHECK (remaining_value_cents >= 0)
);

COMMENT ON TABLE vouchers IS 'Gift vouchers and gift cards';
COMMENT ON COLUMN vouchers.code IS 'Unique redemption code';
COMMENT ON COLUMN vouchers.remaining_value_cents IS 'Remaining balance';

-- Indexes
CREATE INDEX idx_vouchers_salon ON vouchers(salon_id);
CREATE INDEX idx_vouchers_code ON vouchers(salon_id, code);
CREATE INDEX idx_vouchers_active ON vouchers(salon_id, is_active) WHERE is_active = true;

-- Apply updated_at trigger
CREATE TRIGGER update_vouchers_updated_at
  BEFORE UPDATE ON vouchers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEW: Published products with category
-- ============================================
CREATE VIEW v_published_products AS
SELECT
  p.*,
  pc.name AS category_name,
  pc.slug AS category_slug,
  (p.price_cents::DECIMAL / 100) AS price_chf,
  CASE
    WHEN p.compare_at_price_cents IS NOT NULL
    THEN (p.compare_at_price_cents::DECIMAL / 100)
    ELSE NULL
  END AS compare_at_price_chf,
  (
    SELECT pi.url
    FROM product_images pi
    WHERE pi.product_id = p.id AND pi.is_primary = true
    LIMIT 1
  ) AS primary_image_url,
  CASE
    WHEN p.track_inventory AND p.stock_quantity <= 0 AND NOT p.allow_backorder
    THEN false
    ELSE true
  END AS is_in_stock
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id
WHERE p.is_active = true AND p.is_published = true;

COMMENT ON VIEW v_published_products IS 'Products visible in shop';

-- ============================================
-- VIEW: Low stock products
-- ============================================
CREATE VIEW v_low_stock_products AS
SELECT
  p.*,
  (p.price_cents::DECIMAL / 100) AS price_chf
FROM products p
WHERE p.is_active = true
  AND p.track_inventory = true
  AND p.stock_quantity <= p.low_stock_threshold;

COMMENT ON VIEW v_low_stock_products IS 'Products below stock threshold';

-- ============================================
-- FUNCTION: Adjust stock
-- ============================================
CREATE OR REPLACE FUNCTION adjust_stock(
  p_product_id UUID,
  p_quantity_change INTEGER,
  p_movement_type stock_movement_type,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_variant_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  product_record RECORD;
  variant_record RECORD;
  previous_qty INTEGER;
  new_qty INTEGER;
  salon_id_val UUID;
BEGIN
  IF p_variant_id IS NOT NULL THEN
    -- Adjust variant stock
    SELECT * INTO variant_record
    FROM product_variants
    WHERE id = p_variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product variant not found';
    END IF;

    previous_qty := COALESCE(variant_record.stock_quantity, 0);
    new_qty := previous_qty + p_quantity_change;

    UPDATE product_variants
    SET stock_quantity = new_qty
    WHERE id = p_variant_id;

    -- Get salon_id from parent product
    SELECT salon_id INTO salon_id_val FROM products WHERE id = variant_record.product_id;
  ELSE
    -- Adjust product stock
    SELECT * INTO product_record
    FROM products
    WHERE id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;

    previous_qty := COALESCE(product_record.stock_quantity, 0);
    new_qty := previous_qty + p_quantity_change;

    UPDATE products
    SET stock_quantity = new_qty
    WHERE id = p_product_id;

    salon_id_val := product_record.salon_id;
  END IF;

  -- Record movement
  INSERT INTO stock_movements (
    salon_id, product_id, variant_id,
    movement_type, quantity, previous_quantity, new_quantity,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    salon_id_val, p_product_id, p_variant_id,
    p_movement_type, p_quantity_change, previous_qty, new_qty,
    p_reference_type, p_reference_id, p_notes, p_created_by
  );

  RETURN new_qty;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Validate voucher
-- ============================================
CREATE OR REPLACE FUNCTION validate_voucher(
  p_salon_id UUID,
  p_code TEXT
)
RETURNS TABLE (
  voucher_id UUID,
  remaining_value_cents INTEGER,
  is_valid BOOLEAN,
  invalid_reason TEXT
) AS $$
DECLARE
  voucher_record RECORD;
BEGIN
  SELECT * INTO voucher_record
  FROM vouchers
  WHERE salon_id = p_salon_id AND code = UPPER(TRIM(p_code));

  IF NOT FOUND THEN
    voucher_id := NULL;
    remaining_value_cents := 0;
    is_valid := false;
    invalid_reason := 'Voucher not found';
    RETURN NEXT;
    RETURN;
  END IF;

  voucher_id := voucher_record.id;
  remaining_value_cents := voucher_record.remaining_value_cents;

  -- Check if active
  IF NOT voucher_record.is_active THEN
    is_valid := false;
    invalid_reason := 'Voucher is not active';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Check validity period
  IF voucher_record.valid_from IS NOT NULL AND NOW() < voucher_record.valid_from THEN
    is_valid := false;
    invalid_reason := 'Voucher is not yet valid';
    RETURN NEXT;
    RETURN;
  END IF;

  IF voucher_record.valid_until IS NOT NULL AND NOW() > voucher_record.valid_until THEN
    is_valid := false;
    invalid_reason := 'Voucher has expired';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Check remaining value
  IF voucher_record.remaining_value_cents <= 0 THEN
    is_valid := false;
    invalid_reason := 'Voucher has no remaining balance';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Check if already redeemed (for single-use)
  IF voucher_record.is_single_use AND voucher_record.redeemed_at IS NOT NULL THEN
    is_valid := false;
    invalid_reason := 'Voucher has already been used';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Voucher is valid
  is_valid := true;
  invalid_reason := NULL;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION: Redeem voucher
-- ============================================
CREATE OR REPLACE FUNCTION redeem_voucher(
  p_voucher_id UUID,
  p_amount_cents INTEGER,
  p_customer_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  voucher_record RECORD;
  new_remaining INTEGER;
BEGIN
  -- Lock voucher for update
  SELECT * INTO voucher_record
  FROM vouchers
  WHERE id = p_voucher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher not found';
  END IF;

  -- Check sufficient balance
  IF p_amount_cents > voucher_record.remaining_value_cents THEN
    RAISE EXCEPTION 'Insufficient voucher balance';
  END IF;

  -- Calculate new remaining value
  new_remaining := voucher_record.remaining_value_cents - p_amount_cents;

  -- Update voucher
  UPDATE vouchers
  SET
    remaining_value_cents = new_remaining,
    redeemed_at = CASE WHEN new_remaining = 0 OR is_single_use THEN NOW() ELSE redeemed_at END,
    redeemed_by_customer_id = COALESCE(redeemed_by_customer_id, p_customer_id)
  WHERE id = p_voucher_id;

  RETURN new_remaining;
END;
$$ LANGUAGE plpgsql;
