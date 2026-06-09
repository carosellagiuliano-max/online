-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00007_orders.sql
-- Description: Orders, order items, shipping
-- ============================================

-- ============================================
-- ORDERS TABLE
-- Customer orders (shop purchases, vouchers, etc.)
-- ============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Order number (human-readable)
  order_number TEXT NOT NULL,

  -- Status
  status order_status NOT NULL DEFAULT 'pending',

  -- Pricing (in CHF cents)
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER DEFAULT 0,
  shipping_cents INTEGER DEFAULT 0,
  tax_cents INTEGER DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,

  -- Tax breakdown
  tax_rate DECIMAL(5,2),

  -- Voucher applied
  voucher_id UUID REFERENCES vouchers(id),
  voucher_discount_cents INTEGER DEFAULT 0,

  -- Shipping info
  shipping_method shipping_method_type,
  shipping_address JSONB,
  -- Format: { "name": "...", "street": "...", "zip": "...", "city": "...", "country": "..." }

  -- Pickup info (if pickup)
  pickup_date DATE,
  pickup_time TIME,

  -- Tracking
  tracking_number TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Customer info snapshot
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,

  -- Notes
  customer_notes TEXT,
  internal_notes TEXT,

  -- Source tracking
  source TEXT DEFAULT 'online',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT unique_order_number_per_salon UNIQUE (salon_id, order_number)
);

COMMENT ON TABLE orders IS 'Customer shop orders';
COMMENT ON COLUMN orders.order_number IS 'Human-readable order number (e.g., SW-2024-00001)';
COMMENT ON COLUMN orders.shipping_address IS 'Shipping address as JSON';
COMMENT ON COLUMN orders.source IS 'Where order was placed (online, in_person, phone)';

-- Indexes
CREATE INDEX idx_orders_salon ON orders(salon_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(salon_id, status);
CREATE INDEX idx_orders_number ON orders(salon_id, order_number);
CREATE INDEX idx_orders_date ON orders(salon_id, created_at);

-- Apply updated_at trigger
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ORDER_ITEMS TABLE
-- Individual items within an order
-- ============================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Item type (product, voucher, service)
  item_type TEXT NOT NULL DEFAULT 'product',

  -- Product reference
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,

  -- Item details (snapshot at order time)
  item_name TEXT NOT NULL,
  item_sku TEXT,
  item_description TEXT,

  -- Quantity and pricing
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  discount_cents INTEGER DEFAULT 0,
  total_cents INTEGER NOT NULL,

  -- Tax
  tax_rate DECIMAL(5,2),
  tax_cents INTEGER DEFAULT 0,

  -- Voucher specific (if item_type = 'voucher')
  voucher_id UUID REFERENCES vouchers(id),
  voucher_recipient_email TEXT,
  voucher_recipient_name TEXT,
  voucher_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_unit_price CHECK (unit_price_cents >= 0)
);

COMMENT ON TABLE order_items IS 'Individual items in an order';
COMMENT ON COLUMN order_items.item_type IS 'Type: product, voucher, service';
COMMENT ON COLUMN order_items.item_name IS 'Snapshot of item name at order time';

-- Indexes
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ============================================
-- ORDER_STATUS_HISTORY TABLE
-- Track status changes
-- ============================================
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Status change
  previous_status order_status,
  new_status order_status NOT NULL,

  -- Who made the change
  changed_by UUID REFERENCES profiles(id),

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE order_status_history IS 'Order status change audit trail';

-- Indexes
CREATE INDEX idx_order_history_order ON order_status_history(order_id);

-- ============================================
-- FUNCTION: Generate order number
-- ============================================
CREATE OR REPLACE FUNCTION generate_order_number(p_salon_id UUID)
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  new_order_number TEXT;
  prefix TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');

  -- Get salon prefix (first 2 chars of slug or 'SW')
  SELECT UPPER(LEFT(slug, 2)) INTO prefix
  FROM salons WHERE id = p_salon_id;
  prefix := COALESCE(prefix, 'SW');

  -- Get next sequence number for this salon/year
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(order_number, '-', 3) AS INTEGER)
  ), 0) + 1 INTO sequence_num
  FROM orders
  WHERE salon_id = p_salon_id
    AND order_number LIKE prefix || '-' || year_part || '-%';

  -- Format: SW-2024-00001
  new_order_number := prefix || '-' || year_part || '-' || LPAD(sequence_num::TEXT, 5, '0');

  RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Create order
-- ============================================
CREATE OR REPLACE FUNCTION create_order(
  p_salon_id UUID,
  p_customer_id UUID,
  p_customer_email TEXT,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_shipping_method shipping_method_type DEFAULT NULL,
  p_shipping_address JSONB DEFAULT NULL,
  p_customer_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_order_id UUID;
  new_order_number TEXT;
BEGIN
  -- Generate order number
  new_order_number := generate_order_number(p_salon_id);

  -- Create order
  INSERT INTO orders (
    salon_id, customer_id, order_number,
    customer_email, customer_name, customer_phone,
    shipping_method, shipping_address, customer_notes
  ) VALUES (
    p_salon_id, p_customer_id, new_order_number,
    p_customer_email, p_customer_name, p_customer_phone,
    p_shipping_method, p_shipping_address, p_customer_notes
  )
  RETURNING id INTO new_order_id;

  -- Record initial status
  INSERT INTO order_status_history (order_id, new_status, notes)
  VALUES (new_order_id, 'pending', 'Order created');

  RETURN new_order_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Add item to order
-- ============================================
CREATE OR REPLACE FUNCTION add_order_item(
  p_order_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_variant_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_item_id UUID;
  product_record RECORD;
  variant_record RECORD;
  item_price INTEGER;
  item_name TEXT;
  item_sku TEXT;
  tax_rate_val DECIMAL(5,2);
  tax_amount INTEGER;
  item_total INTEGER;
BEGIN
  -- Get product
  SELECT * INTO product_record
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- Get variant if specified
  IF p_variant_id IS NOT NULL THEN
    SELECT * INTO variant_record
    FROM product_variants
    WHERE id = p_variant_id;

    IF FOUND THEN
      item_price := COALESCE(variant_record.price_cents, product_record.price_cents);
      item_sku := COALESCE(variant_record.sku, product_record.sku);
      item_name := product_record.name || ' - ' || variant_record.name;
    ELSE
      item_price := product_record.price_cents;
      item_sku := product_record.sku;
      item_name := product_record.name;
    END IF;
  ELSE
    item_price := product_record.price_cents;
    item_sku := product_record.sku;
    item_name := product_record.name;
  END IF;

  -- Calculate tax
  tax_rate_val := COALESCE(product_record.vat_rate, 8.1);
  item_total := item_price * p_quantity;
  tax_amount := ROUND(item_total * (tax_rate_val / (100 + tax_rate_val)));

  -- Insert item
  INSERT INTO order_items (
    order_id, item_type, product_id, variant_id,
    item_name, item_sku, quantity,
    unit_price_cents, total_cents,
    tax_rate, tax_cents
  ) VALUES (
    p_order_id, 'product', p_product_id, p_variant_id,
    item_name, item_sku, p_quantity,
    item_price, item_total,
    tax_rate_val, tax_amount
  )
  RETURNING id INTO new_item_id;

  -- Update order totals
  PERFORM recalculate_order_totals(p_order_id);

  RETURN new_item_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Add voucher to order
-- ============================================
CREATE OR REPLACE FUNCTION add_voucher_to_order(
  p_order_id UUID,
  p_value_cents INTEGER,
  p_recipient_email TEXT,
  p_recipient_name TEXT DEFAULT NULL,
  p_personal_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_item_id UUID;
  item_total INTEGER;
BEGIN
  item_total := p_value_cents;

  -- Insert voucher item (no tax on vouchers typically)
  INSERT INTO order_items (
    order_id, item_type, item_name, quantity,
    unit_price_cents, total_cents,
    voucher_recipient_email, voucher_recipient_name, voucher_message
  ) VALUES (
    p_order_id, 'voucher', 'Geschenkgutschein ' || (p_value_cents / 100) || ' CHF', 1,
    p_value_cents, item_total,
    p_recipient_email, p_recipient_name, p_personal_message
  )
  RETURNING id INTO new_item_id;

  -- Update order totals
  PERFORM recalculate_order_totals(p_order_id);

  RETURN new_item_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Recalculate order totals
-- ============================================
CREATE OR REPLACE FUNCTION recalculate_order_totals(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  order_record RECORD;
  totals RECORD;
BEGIN
  -- Get order
  SELECT * INTO order_record FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Calculate totals from items
  SELECT
    COALESCE(SUM(total_cents), 0) AS subtotal,
    COALESCE(SUM(discount_cents), 0) AS discount,
    COALESCE(SUM(tax_cents), 0) AS tax
  INTO totals
  FROM order_items
  WHERE order_id = p_order_id;

  -- Update order
  UPDATE orders
  SET
    subtotal_cents = totals.subtotal,
    discount_cents = order_record.discount_cents + totals.discount,
    tax_cents = totals.tax,
    total_cents = totals.subtotal - order_record.discount_cents - totals.discount
                  - COALESCE(order_record.voucher_discount_cents, 0)
                  + COALESCE(order_record.shipping_cents, 0)
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Apply voucher to order
-- ============================================
CREATE OR REPLACE FUNCTION apply_voucher_to_order(
  p_order_id UUID,
  p_voucher_code TEXT
)
RETURNS INTEGER AS $$
DECLARE
  order_record RECORD;
  voucher_result RECORD;
  discount_amount INTEGER;
BEGIN
  -- Get order
  SELECT * INTO order_record FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF order_record.status != 'pending' THEN
    RAISE EXCEPTION 'Cannot apply voucher to non-pending order';
  END IF;

  -- Validate voucher
  SELECT * INTO voucher_result
  FROM validate_voucher(order_record.salon_id, p_voucher_code);

  IF NOT voucher_result.is_valid THEN
    RAISE EXCEPTION 'Invalid voucher: %', voucher_result.invalid_reason;
  END IF;

  -- Calculate discount (max of voucher value or order total)
  discount_amount := LEAST(
    voucher_result.remaining_value_cents,
    order_record.total_cents + COALESCE(order_record.voucher_discount_cents, 0)
  );

  -- Update order
  UPDATE orders
  SET
    voucher_id = voucher_result.voucher_id,
    voucher_discount_cents = discount_amount,
    total_cents = total_cents - discount_amount + COALESCE(voucher_discount_cents, 0)
  WHERE id = p_order_id;

  RETURN discount_amount;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Update order status
-- ============================================
CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id UUID,
  p_new_status order_status,
  p_changed_by UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
BEGIN
  -- Get and lock order
  SELECT * INTO order_record
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Record history
  INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, notes)
  VALUES (p_order_id, order_record.status, p_new_status, p_changed_by, p_notes);

  -- Update order
  UPDATE orders
  SET
    status = p_new_status,
    completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
    cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN NOW() ELSE cancelled_at END,
    shipped_at = CASE WHEN p_new_status = 'shipped' THEN NOW() ELSE shipped_at END
  WHERE id = p_order_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Orders with customer info
-- ============================================
CREATE VIEW v_orders_with_details AS
SELECT
  o.*,
  c.first_name || ' ' || c.last_name AS customer_full_name,
  (o.subtotal_cents::DECIMAL / 100) AS subtotal_chf,
  (o.total_cents::DECIMAL / 100) AS total_chf,
  (o.shipping_cents::DECIMAL / 100) AS shipping_chf,
  (
    SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id
  ) AS item_count
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id;

COMMENT ON VIEW v_orders_with_details IS 'Orders with computed fields';

-- ============================================
-- VIEW: Recent orders
-- ============================================
CREATE VIEW v_recent_orders AS
SELECT *
FROM v_orders_with_details
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

COMMENT ON VIEW v_recent_orders IS 'Orders from last 30 days';
