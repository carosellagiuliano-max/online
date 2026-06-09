-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00008_payments.sql
-- Description: Payments, refunds, Stripe integration
-- ============================================

-- ============================================
-- PAYMENTS TABLE
-- All payment transactions
-- ============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Reference to what was paid for
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  -- reference_type: 'order', 'appointment', 'deposit'
  -- reference_id: orders.id, appointments.id, etc.

  -- Payment details
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CHF',

  -- Payment method
  payment_method payment_method NOT NULL,

  -- Status
  status payment_status NOT NULL DEFAULT 'pending',

  -- Stripe integration
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_customer_id TEXT,

  -- Payment method details (card info snapshot)
  payment_method_details JSONB,
  -- Format: { "type": "card", "brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2025 }

  -- Error tracking
  error_code TEXT,
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT positive_payment_amount CHECK (amount_cents > 0)
);

COMMENT ON TABLE payments IS 'Payment transactions';
COMMENT ON COLUMN payments.reference_type IS 'Type of entity being paid for';
COMMENT ON COLUMN payments.reference_id IS 'ID of the entity being paid for';
COMMENT ON COLUMN payments.stripe_payment_intent_id IS 'Stripe PaymentIntent ID';
COMMENT ON COLUMN payments.payment_method_details IS 'Payment method details snapshot';

-- Indexes
CREATE INDEX idx_payments_salon ON payments(salon_id);
CREATE INDEX idx_payments_reference ON payments(reference_type, reference_id);
CREATE INDEX idx_payments_status ON payments(salon_id, status);
CREATE INDEX idx_payments_stripe_pi ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_date ON payments(salon_id, created_at);

-- Apply updated_at trigger
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- REFUNDS TABLE
-- Track refunds for payments
-- ============================================
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Refund amount
  amount_cents INTEGER NOT NULL,

  -- Status
  status payment_status NOT NULL DEFAULT 'pending',

  -- Reason
  reason TEXT,

  -- Stripe integration
  stripe_refund_id TEXT,

  -- Who initiated
  initiated_by UUID REFERENCES profiles(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT positive_refund_amount CHECK (amount_cents > 0)
);

COMMENT ON TABLE refunds IS 'Payment refund records';

-- Indexes
CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_salon ON refunds(salon_id);
CREATE INDEX idx_refunds_stripe ON refunds(stripe_refund_id);

-- ============================================
-- STRIPE_WEBHOOKS_LOG TABLE
-- Log all Stripe webhook events
-- ============================================
CREATE TABLE stripe_webhooks_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event info
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,

  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,

  -- Raw payload
  payload JSONB NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE stripe_webhooks_log IS 'Stripe webhook event log';
COMMENT ON COLUMN stripe_webhooks_log.stripe_event_id IS 'Stripe event ID for idempotency';

-- Indexes
CREATE INDEX idx_stripe_webhooks_event_id ON stripe_webhooks_log(stripe_event_id);
CREATE INDEX idx_stripe_webhooks_type ON stripe_webhooks_log(event_type);
CREATE INDEX idx_stripe_webhooks_processed ON stripe_webhooks_log(processed) WHERE processed = false;

-- ============================================
-- DAILY_SALES TABLE
-- Aggregated daily sales for reporting
-- ============================================
CREATE TABLE daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Date
  date DATE NOT NULL,

  -- Totals
  total_revenue_cents INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_appointments INTEGER DEFAULT 0,

  -- Breakdown by payment method
  cash_cents INTEGER DEFAULT 0,
  card_cents INTEGER DEFAULT 0,
  twint_cents INTEGER DEFAULT 0,
  voucher_cents INTEGER DEFAULT 0,

  -- Refunds
  refunds_cents INTEGER DEFAULT 0,
  refunds_count INTEGER DEFAULT 0,

  -- Net
  net_revenue_cents INTEGER DEFAULT 0,

  -- Tax collected
  tax_collected_cents INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_daily_sales_per_salon UNIQUE (salon_id, date)
);

COMMENT ON TABLE daily_sales IS 'Aggregated daily sales for reporting';

-- Indexes
CREATE INDEX idx_daily_sales_salon ON daily_sales(salon_id);
CREATE INDEX idx_daily_sales_date ON daily_sales(salon_id, date);

-- Apply updated_at trigger
CREATE TRIGGER update_daily_sales_updated_at
  BEFORE UPDATE ON daily_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Record payment
-- ============================================
CREATE OR REPLACE FUNCTION record_payment(
  p_salon_id UUID,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_amount_cents INTEGER,
  p_payment_method payment_method,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  new_payment_id UUID;
BEGIN
  INSERT INTO payments (
    salon_id, reference_type, reference_id,
    amount_cents, payment_method, stripe_payment_intent_id, metadata
  ) VALUES (
    p_salon_id, p_reference_type, p_reference_id,
    p_amount_cents, p_payment_method, p_stripe_payment_intent_id, p_metadata
  )
  RETURNING id INTO new_payment_id;

  RETURN new_payment_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Confirm payment success
-- ============================================
CREATE OR REPLACE FUNCTION confirm_payment_success(
  p_payment_id UUID,
  p_stripe_charge_id TEXT DEFAULT NULL,
  p_payment_method_details JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  payment_record RECORD;
BEGIN
  -- Get and lock payment
  SELECT * INTO payment_record
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF payment_record.status = 'succeeded' THEN
    -- Already succeeded, idempotent return
    RETURN true;
  END IF;

  -- Update payment
  UPDATE payments
  SET
    status = 'succeeded',
    stripe_charge_id = COALESCE(p_stripe_charge_id, stripe_charge_id),
    payment_method_details = COALESCE(p_payment_method_details, payment_method_details),
    succeeded_at = NOW()
  WHERE id = p_payment_id;

  -- Update related entity based on reference_type
  IF payment_record.reference_type = 'order' THEN
    PERFORM update_order_status(payment_record.reference_id, 'paid', NULL, 'Payment confirmed');
  ELSIF payment_record.reference_type = 'appointment' THEN
    PERFORM confirm_appointment(payment_record.reference_id, NULL);
  END IF;

  -- Update daily sales
  PERFORM update_daily_sales(payment_record.salon_id, CURRENT_DATE);

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Record payment failure
-- ============================================
CREATE OR REPLACE FUNCTION record_payment_failure(
  p_payment_id UUID,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE payments
  SET
    status = 'failed',
    error_code = p_error_code,
    error_message = p_error_message,
    failed_at = NOW()
  WHERE id = p_payment_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Process refund
-- ============================================
CREATE OR REPLACE FUNCTION process_refund(
  p_payment_id UUID,
  p_amount_cents INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_initiated_by UUID DEFAULT NULL,
  p_stripe_refund_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  payment_record RECORD;
  new_refund_id UUID;
  total_refunded INTEGER;
BEGIN
  -- Get payment
  SELECT * INTO payment_record
  FROM payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF payment_record.status != 'succeeded' THEN
    RAISE EXCEPTION 'Can only refund successful payments';
  END IF;

  -- Check total refunds don't exceed payment
  SELECT COALESCE(SUM(amount_cents), 0) INTO total_refunded
  FROM refunds
  WHERE payment_id = p_payment_id AND status = 'succeeded';

  IF total_refunded + p_amount_cents > payment_record.amount_cents THEN
    RAISE EXCEPTION 'Refund amount exceeds remaining payment value';
  END IF;

  -- Create refund record
  INSERT INTO refunds (
    payment_id, salon_id, amount_cents, reason, initiated_by, stripe_refund_id
  ) VALUES (
    p_payment_id, payment_record.salon_id, p_amount_cents, p_reason, p_initiated_by, p_stripe_refund_id
  )
  RETURNING id INTO new_refund_id;

  RETURN new_refund_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Confirm refund success
-- ============================================
CREATE OR REPLACE FUNCTION confirm_refund_success(p_refund_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  refund_record RECORD;
  payment_record RECORD;
  total_refunded INTEGER;
BEGIN
  -- Get refund
  SELECT * INTO refund_record FROM refunds WHERE id = p_refund_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund not found';
  END IF;

  -- Update refund status
  UPDATE refunds
  SET status = 'succeeded', succeeded_at = NOW()
  WHERE id = p_refund_id;

  -- Check if fully refunded
  SELECT * INTO payment_record FROM payments WHERE id = refund_record.payment_id;

  SELECT COALESCE(SUM(amount_cents), 0) INTO total_refunded
  FROM refunds
  WHERE payment_id = refund_record.payment_id AND status = 'succeeded';

  IF total_refunded >= payment_record.amount_cents THEN
    UPDATE payments SET status = 'refunded' WHERE id = refund_record.payment_id;
  ELSIF total_refunded > 0 THEN
    UPDATE payments SET status = 'partially_refunded' WHERE id = refund_record.payment_id;
  END IF;

  -- Update daily sales
  PERFORM update_daily_sales(refund_record.salon_id, CURRENT_DATE);

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Update daily sales aggregation
-- ============================================
CREATE OR REPLACE FUNCTION update_daily_sales(p_salon_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
  revenue_data RECORD;
  refund_data RECORD;
BEGIN
  -- Calculate revenue from payments
  SELECT
    COALESCE(SUM(amount_cents), 0) AS total,
    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount_cents ELSE 0 END), 0) AS cash,
    COALESCE(SUM(CASE WHEN payment_method IN ('stripe_card', 'terminal') THEN amount_cents ELSE 0 END), 0) AS card,
    COALESCE(SUM(CASE WHEN payment_method = 'stripe_twint' THEN amount_cents ELSE 0 END), 0) AS twint,
    COALESCE(SUM(CASE WHEN payment_method = 'voucher' THEN amount_cents ELSE 0 END), 0) AS voucher,
    COUNT(*) AS payment_count
  INTO revenue_data
  FROM payments
  WHERE salon_id = p_salon_id
    AND DATE(succeeded_at AT TIME ZONE 'Europe/Zurich') = p_date
    AND status = 'succeeded';

  -- Calculate refunds
  SELECT
    COALESCE(SUM(amount_cents), 0) AS total,
    COUNT(*) AS refund_count
  INTO refund_data
  FROM refunds
  WHERE salon_id = p_salon_id
    AND DATE(succeeded_at AT TIME ZONE 'Europe/Zurich') = p_date
    AND status = 'succeeded';

  -- Upsert daily sales
  INSERT INTO daily_sales (
    salon_id, date,
    total_revenue_cents, cash_cents, card_cents, twint_cents, voucher_cents,
    refunds_cents, refunds_count, net_revenue_cents
  ) VALUES (
    p_salon_id, p_date,
    revenue_data.total, revenue_data.cash, revenue_data.card, revenue_data.twint, revenue_data.voucher,
    refund_data.total, refund_data.refund_count,
    revenue_data.total - refund_data.total
  )
  ON CONFLICT (salon_id, date) DO UPDATE SET
    total_revenue_cents = EXCLUDED.total_revenue_cents,
    cash_cents = EXCLUDED.cash_cents,
    card_cents = EXCLUDED.card_cents,
    twint_cents = EXCLUDED.twint_cents,
    voucher_cents = EXCLUDED.voucher_cents,
    refunds_cents = EXCLUDED.refunds_cents,
    refunds_count = EXCLUDED.refunds_count,
    net_revenue_cents = EXCLUDED.net_revenue_cents,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Payment summary
-- ============================================
CREATE VIEW v_payment_summary AS
SELECT
  p.*,
  (p.amount_cents::DECIMAL / 100) AS amount_chf,
  o.order_number,
  c.first_name || ' ' || c.last_name AS customer_name
FROM payments p
LEFT JOIN orders o ON p.reference_type = 'order' AND p.reference_id = o.id
LEFT JOIN customers c ON o.customer_id = c.id;

COMMENT ON VIEW v_payment_summary IS 'Payments with related order info';

-- ============================================
-- VIEW: Monthly revenue
-- ============================================
CREATE VIEW v_monthly_revenue AS
SELECT
  salon_id,
  DATE_TRUNC('month', date) AS month,
  SUM(total_revenue_cents) AS total_revenue_cents,
  SUM(net_revenue_cents) AS net_revenue_cents,
  SUM(refunds_cents) AS total_refunds_cents,
  SUM(total_orders) AS total_orders,
  SUM(total_appointments) AS total_appointments,
  (SUM(total_revenue_cents)::DECIMAL / 100) AS total_revenue_chf,
  (SUM(net_revenue_cents)::DECIMAL / 100) AS net_revenue_chf
FROM daily_sales
GROUP BY salon_id, DATE_TRUNC('month', date);

COMMENT ON VIEW v_monthly_revenue IS 'Monthly aggregated revenue';
