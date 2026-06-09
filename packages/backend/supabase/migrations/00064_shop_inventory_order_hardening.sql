-- ============================================
-- Shop checkout and inventory hardening
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
  SELECT * INTO product_record
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  salon_id_val := product_record.salon_id;

  IF p_variant_id IS NOT NULL THEN
    SELECT * INTO variant_record
    FROM product_variants
    WHERE id = p_variant_id
      AND product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product variant not found';
    END IF;

    previous_qty := COALESCE(variant_record.stock_quantity, 0);
    new_qty := previous_qty + p_quantity_change;

    IF new_qty < 0 AND product_record.allow_backorder IS NOT TRUE THEN
      RAISE EXCEPTION 'Insufficient stock for variant %', variant_record.name;
    END IF;

    UPDATE product_variants
    SET stock_quantity = new_qty
    WHERE id = p_variant_id;
  ELSE
    previous_qty := COALESCE(product_record.stock_quantity, 0);
    new_qty := previous_qty + p_quantity_change;

    IF new_qty < 0 AND product_record.allow_backorder IS NOT TRUE THEN
      RAISE EXCEPTION 'Insufficient stock for product %', product_record.name;
    END IF;

    UPDATE products
    SET stock_quantity = new_qty
    WHERE id = p_product_id;
  END IF;

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

CREATE OR REPLACE FUNCTION reserve_order_inventory(
  p_order_id UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  order_record RECORD;
  item_record RECORD;
  product_record RECORD;
  variant_record RECORD;
  previous_qty INTEGER;
  new_qty INTEGER;
  movement_count INTEGER := 0;
BEGIN
  SELECT id, salon_id, order_number, status
  INTO order_record
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM stock_movements
    WHERE reference_type = 'order'
      AND reference_id = p_order_id
      AND movement_type = 'sale'
  ) THEN
    RETURN 0;
  END IF;

  FOR item_record IN
    SELECT *
    FROM order_items
    WHERE order_id = p_order_id
      AND item_type = 'product'
    ORDER BY created_at, id
  LOOP
    IF item_record.product_id IS NULL THEN
      RAISE EXCEPTION 'Order item % has no product reference', item_record.id;
    END IF;

    SELECT *
    INTO product_record
    FROM products
    WHERE id = item_record.product_id
      AND salon_id = order_record.salon_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found for order item %', item_record.id;
    END IF;

    IF product_record.is_active IS NOT TRUE OR product_record.is_published IS NOT TRUE THEN
      RAISE EXCEPTION 'Product % is not available', product_record.name;
    END IF;

    IF product_record.track_inventory IS NOT TRUE THEN
      CONTINUE;
    END IF;

    IF item_record.variant_id IS NOT NULL THEN
      SELECT *
      INTO variant_record
      FROM product_variants
      WHERE id = item_record.variant_id
        AND product_id = item_record.product_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variant not found for order item %', item_record.id;
      END IF;

      IF variant_record.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Variant % is not available', variant_record.name;
      END IF;

      previous_qty := COALESCE(variant_record.stock_quantity, 0);
      new_qty := previous_qty - item_record.quantity;

      IF new_qty < 0 AND product_record.allow_backorder IS NOT TRUE THEN
        RAISE EXCEPTION 'Insufficient stock for %', item_record.item_name;
      END IF;

      UPDATE product_variants
      SET stock_quantity = new_qty
      WHERE id = item_record.variant_id;
    ELSE
      previous_qty := COALESCE(product_record.stock_quantity, 0);
      new_qty := previous_qty - item_record.quantity;

      IF new_qty < 0 AND product_record.allow_backorder IS NOT TRUE THEN
        RAISE EXCEPTION 'Insufficient stock for %', item_record.item_name;
      END IF;

      UPDATE products
      SET stock_quantity = new_qty
      WHERE id = item_record.product_id;
    END IF;

    INSERT INTO stock_movements (
      salon_id, product_id, variant_id,
      movement_type, quantity, previous_quantity, new_quantity,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      order_record.salon_id,
      item_record.product_id,
      item_record.variant_id,
      'sale',
      -item_record.quantity,
      previous_qty,
      new_qty,
      'order',
      p_order_id,
      'Bestellung ' || order_record.order_number,
      p_created_by
    );

    movement_count := movement_count + 1;
  END LOOP;

  RETURN movement_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_order_inventory(
  p_order_id UUID,
  p_created_by UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  movement_record RECORD;
  product_record RECORD;
  variant_record RECORD;
  previous_qty INTEGER;
  new_qty INTEGER;
  restore_qty INTEGER;
  movement_count INTEGER := 0;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM stock_movements
    WHERE reference_type = 'order_release'
      AND reference_id = p_order_id
      AND movement_type = 'return'
  ) THEN
    RETURN 0;
  END IF;

  FOR movement_record IN
    SELECT *
    FROM stock_movements
    WHERE reference_type = 'order'
      AND reference_id = p_order_id
      AND movement_type = 'sale'
    ORDER BY created_at, id
  LOOP
    restore_qty := ABS(movement_record.quantity);

    SELECT *
    INTO product_record
    FROM products
    WHERE id = movement_record.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF movement_record.variant_id IS NOT NULL THEN
      SELECT *
      INTO variant_record
      FROM product_variants
      WHERE id = movement_record.variant_id
      FOR UPDATE;

      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      previous_qty := COALESCE(variant_record.stock_quantity, 0);
      new_qty := previous_qty + restore_qty;

      UPDATE product_variants
      SET stock_quantity = new_qty
      WHERE id = movement_record.variant_id;
    ELSE
      previous_qty := COALESCE(product_record.stock_quantity, 0);
      new_qty := previous_qty + restore_qty;

      UPDATE products
      SET stock_quantity = new_qty
      WHERE id = movement_record.product_id;
    END IF;

    INSERT INTO stock_movements (
      salon_id, product_id, variant_id,
      movement_type, quantity, previous_quantity, new_quantity,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      movement_record.salon_id,
      movement_record.product_id,
      movement_record.variant_id,
      'return',
      restore_qty,
      previous_qty,
      new_qty,
      'order_release',
      p_order_id,
      COALESCE(p_notes, 'Bestandsfreigabe für stornierte Bestellung'),
      p_created_by
    );

    movement_count := movement_count + 1;
  END LOOP;

  RETURN movement_count;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
