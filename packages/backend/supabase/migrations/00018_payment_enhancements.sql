-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00018_payment_enhancements.sql
-- Description: Stripe webhook support, payment status
-- ============================================

-- ============================================
-- PAYMENT STATUS ENUM (if not exists)
-- ============================================
DO $$ BEGIN
  CREATE TYPE order_payment_status AS ENUM (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'refunded',
    'partially_refunded'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- ADD PAYMENT COLUMNS TO ORDERS
-- ============================================

-- Payment status tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status order_payment_status DEFAULT 'pending';

-- Stripe integration fields
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;

-- Payment timestamps
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Cancellation details
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Payment error tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_error TEXT;

-- Refund tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_amount_cents INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Dispute tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS has_dispute BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_stripe_pi ON orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(salon_id, payment_status);

COMMENT ON COLUMN orders.payment_status IS 'Current payment status from Stripe';
COMMENT ON COLUMN orders.stripe_session_id IS 'Stripe Checkout Session ID';
COMMENT ON COLUMN orders.stripe_payment_intent_id IS 'Stripe PaymentIntent ID';
COMMENT ON COLUMN orders.stripe_charge_id IS 'Stripe Charge ID';

-- ============================================
-- ENHANCE VOUCHERS TABLE FOR ORDER LINKING
-- ============================================

-- Order reference for purchased vouchers
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL;

-- Expiry (if not already present)
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Status for more control
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Amount tracking (align naming with code)
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS amount_cents INTEGER;

-- Purchaser tracking
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS purchaser_customer_id UUID REFERENCES customers(id);

-- Update existing vouchers to have amount_cents
UPDATE vouchers SET amount_cents = initial_value_cents WHERE amount_cents IS NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_vouchers_order ON vouchers(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(salon_id, status);

COMMENT ON COLUMN vouchers.order_id IS 'Order that purchased this voucher';
COMMENT ON COLUMN vouchers.expires_at IS 'When voucher expires';
COMMENT ON COLUMN vouchers.status IS 'Voucher status: active, used, expired, cancelled';

-- ============================================
-- ADD VOUCHER TYPE TO ORDER ITEMS
-- ============================================
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voucher_type TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS recipient_email TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS personal_message TEXT;

COMMENT ON COLUMN order_items.voucher_type IS 'Type: value or service voucher';
COMMENT ON COLUMN order_items.recipient_email IS 'Voucher recipient email';
COMMENT ON COLUMN order_items.recipient_name IS 'Voucher recipient name';

-- ============================================
-- STRIPE WEBHOOKS LOG ENHANCEMENTS
-- ============================================

-- Add result tracking if not exists
ALTER TABLE stripe_webhooks_log ADD COLUMN IF NOT EXISTS processing_result TEXT;

-- ============================================
-- FUNCTION: Handle successful payment
-- Updates order status when payment succeeds
-- ============================================
CREATE OR REPLACE FUNCTION handle_payment_success(
  p_order_id UUID,
  p_stripe_session_id TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_stripe_charge_id TEXT DEFAULT NULL
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

  -- Already paid - idempotent
  IF order_record.payment_status = 'succeeded' THEN
    RETURN true;
  END IF;

  -- Update order
  UPDATE orders
  SET
    status = 'paid',
    payment_status = 'succeeded',
    stripe_session_id = COALESCE(p_stripe_session_id, stripe_session_id),
    stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
    stripe_charge_id = COALESCE(p_stripe_charge_id, stripe_charge_id),
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Record status change
  INSERT INTO order_status_history (order_id, previous_status, new_status, notes)
  VALUES (p_order_id, order_record.status, 'paid', 'Payment succeeded via Stripe');

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Generate voucher code
-- Generates unique voucher code
-- ============================================
CREATE OR REPLACE FUNCTION generate_voucher_code(p_salon_id UUID)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  prefix TEXT := 'SW-';
  new_code TEXT;
  attempts INTEGER := 0;
BEGIN
  LOOP
    -- Generate code: SW-XXXX-XXXX-XXXX
    new_code := prefix;
    FOR i IN 1..3 LOOP
      FOR j IN 1..4 LOOP
        new_code := new_code || SUBSTRING(chars FROM (FLOOR(RANDOM() * LENGTH(chars)) + 1)::INT FOR 1);
      END LOOP;
      IF i < 3 THEN
        new_code := new_code || '-';
      END IF;
    END LOOP;

    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM vouchers WHERE salon_id = p_salon_id AND code = new_code) THEN
      RETURN new_code;
    END IF;

    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique voucher code';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Create voucher from order
-- Creates voucher when order is paid
-- ============================================
CREATE OR REPLACE FUNCTION create_voucher_from_order(
  p_order_id UUID,
  p_order_item_id UUID,
  p_salon_id UUID,
  p_purchaser_customer_id UUID DEFAULT NULL,
  p_recipient_email TEXT DEFAULT NULL,
  p_recipient_name TEXT DEFAULT NULL,
  p_personal_message TEXT DEFAULT NULL,
  p_amount_cents INTEGER DEFAULT NULL,
  p_voucher_type TEXT DEFAULT 'value'
)
RETURNS UUID AS $$
DECLARE
  new_voucher_id UUID;
  new_code TEXT;
  expires_at_val TIMESTAMPTZ;
BEGIN
  -- Generate unique code
  new_code := generate_voucher_code(p_salon_id);

  -- Calculate expiry (1 year from now)
  expires_at_val := NOW() + INTERVAL '1 year';

  -- Create voucher
  INSERT INTO vouchers (
    salon_id,
    code,
    type,
    initial_value_cents,
    remaining_value_cents,
    amount_cents,
    order_id,
    order_item_id,
    purchaser_customer_id,
    purchased_by_customer_id,
    recipient_email,
    recipient_name,
    personal_message,
    status,
    valid_until,
    expires_at,
    is_active
  ) VALUES (
    p_salon_id,
    new_code,
    p_voucher_type,
    p_amount_cents,
    p_amount_cents,
    p_amount_cents,
    p_order_id,
    p_order_item_id,
    p_purchaser_customer_id,
    p_purchaser_customer_id,
    p_recipient_email,
    p_recipient_name,
    p_personal_message,
    'active',
    expires_at_val,
    expires_at_val,
    true
  )
  RETURNING id INTO new_voucher_id;

  -- Link back to order item
  UPDATE order_items
  SET voucher_id = new_voucher_id
  WHERE id = p_order_item_id;

  RETURN new_voucher_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-update payment status
-- ============================================
CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update payment_status based on status changes
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    NEW.payment_status := 'succeeded';
    NEW.paid_at := COALESCE(NEW.paid_at, NOW());
  ELSIF NEW.status = 'cancelled' AND NEW.payment_status IS DISTINCT FROM 'refunded' THEN
    NEW.payment_status := 'failed';
  ELSIF NEW.status = 'refunded' THEN
    NEW.payment_status := 'refunded';
    NEW.refunded_at := COALESCE(NEW.refunded_at, NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_order_payment_status ON orders;
CREATE TRIGGER trigger_update_order_payment_status
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_payment_status();
