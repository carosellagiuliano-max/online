-- ============================================
-- BeautifyPRO Database Schema
-- Migration: 00009_loyalty.sql
-- Description: Loyalty program, points, tiers
-- ============================================

-- ============================================
-- LOYALTY_PROGRAMS TABLE
-- Salon loyalty program configuration
-- ============================================
CREATE TABLE loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Program Info
  name TEXT NOT NULL DEFAULT 'Treuepunkte',
  description TEXT,

  -- Points configuration
  points_per_chf INTEGER DEFAULT 1,
  points_value_cents INTEGER DEFAULT 1,

  -- Earning rules
  earn_on_services BOOLEAN DEFAULT true,
  earn_on_products BOOLEAN DEFAULT true,
  earn_on_vouchers BOOLEAN DEFAULT false,

  -- Redemption rules
  min_points_to_redeem INTEGER DEFAULT 100,
  max_discount_percent INTEGER DEFAULT 100,

  -- Birthday bonus
  birthday_bonus_points INTEGER DEFAULT 0,
  birthday_bonus_days_before INTEGER DEFAULT 7,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_loyalty_program_per_salon UNIQUE (salon_id)
);

COMMENT ON TABLE loyalty_programs IS 'Salon loyalty program settings';
COMMENT ON COLUMN loyalty_programs.points_per_chf IS 'Points earned per CHF spent';
COMMENT ON COLUMN loyalty_programs.points_value_cents IS 'Value of 1 point in cents';
COMMENT ON COLUMN loyalty_programs.birthday_bonus_points IS 'Bonus points on birthday';

-- Indexes
CREATE INDEX idx_loyalty_programs_salon ON loyalty_programs(salon_id);

-- Apply updated_at trigger
CREATE TRIGGER update_loyalty_programs_updated_at
  BEFORE UPDATE ON loyalty_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- LOYALTY_TIERS TABLE
-- Loyalty tier definitions
-- ============================================
CREATE TABLE loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,

  -- Tier Info
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,

  -- Requirements
  min_points INTEGER NOT NULL DEFAULT 0,
  min_annual_spend_cents INTEGER DEFAULT 0,

  -- Benefits
  points_multiplier DECIMAL(3,2) DEFAULT 1.00,
  discount_percent INTEGER DEFAULT 0,
  free_service_after_visits INTEGER,
  priority_booking BOOLEAN DEFAULT false,

  -- Display
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE loyalty_tiers IS 'Loyalty tier levels with benefits';
COMMENT ON COLUMN loyalty_tiers.points_multiplier IS 'Multiplier for earned points (e.g., 1.5x)';
COMMENT ON COLUMN loyalty_tiers.free_service_after_visits IS 'Free service after N visits';

-- Indexes
CREATE INDEX idx_loyalty_tiers_program ON loyalty_tiers(program_id);

-- ============================================
-- CUSTOMER_LOYALTY TABLE
-- Customer loyalty balances
-- ============================================
CREATE TABLE customer_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,

  -- Current balance
  points_balance INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,

  -- Tier
  current_tier_id UUID REFERENCES loyalty_tiers(id),

  -- Annual tracking (for tier qualification)
  annual_spend_cents INTEGER DEFAULT 0,
  annual_visits INTEGER DEFAULT 0,
  annual_period_start DATE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_customer_loyalty UNIQUE (customer_id, program_id),
  CONSTRAINT non_negative_balance CHECK (points_balance >= 0)
);

COMMENT ON TABLE customer_loyalty IS 'Customer loyalty program membership';
COMMENT ON COLUMN customer_loyalty.points_balance IS 'Current redeemable points';
COMMENT ON COLUMN customer_loyalty.lifetime_points IS 'Total points earned all-time';

-- Indexes
CREATE INDEX idx_customer_loyalty_customer ON customer_loyalty(customer_id);
CREATE INDEX idx_customer_loyalty_program ON customer_loyalty(program_id);
CREATE INDEX idx_customer_loyalty_tier ON customer_loyalty(current_tier_id);

-- Apply updated_at trigger
CREATE TRIGGER update_customer_loyalty_updated_at
  BEFORE UPDATE ON customer_loyalty
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- LOYALTY_TRANSACTIONS TABLE
-- Points transactions (earn/redeem)
-- ============================================
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_loyalty_id UUID NOT NULL REFERENCES customer_loyalty(id) ON DELETE CASCADE,

  -- Transaction type
  transaction_type TEXT NOT NULL,
  -- Types: 'earn_purchase', 'earn_bonus', 'earn_birthday', 'redeem', 'adjustment', 'expire'

  -- Points
  points INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,

  -- Reference
  reference_type TEXT,
  reference_id UUID,
  -- e.g., reference_type: 'order', reference_id: orders.id

  -- Description
  description TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Who processed
  processed_by UUID REFERENCES profiles(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Expiry (for earned points)
  expires_at TIMESTAMPTZ
);

COMMENT ON TABLE loyalty_transactions IS 'Points earn/redeem transactions';
COMMENT ON COLUMN loyalty_transactions.points IS 'Positive for earn, negative for redeem';

-- Indexes
CREATE INDEX idx_loyalty_trans_customer ON loyalty_transactions(customer_loyalty_id);
CREATE INDEX idx_loyalty_trans_type ON loyalty_transactions(transaction_type);
CREATE INDEX idx_loyalty_trans_reference ON loyalty_transactions(reference_type, reference_id);
CREATE INDEX idx_loyalty_trans_date ON loyalty_transactions(created_at);
CREATE INDEX idx_loyalty_trans_expiry ON loyalty_transactions(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- FUNCTION: Initialize customer loyalty
-- ============================================
CREATE OR REPLACE FUNCTION initialize_customer_loyalty(
  p_customer_id UUID,
  p_salon_id UUID
)
RETURNS UUID AS $$
DECLARE
  program_record RECORD;
  new_loyalty_id UUID;
  base_tier_id UUID;
BEGIN
  -- Get loyalty program
  SELECT * INTO program_record
  FROM loyalty_programs
  WHERE salon_id = p_salon_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get base tier
  SELECT id INTO base_tier_id
  FROM loyalty_tiers
  WHERE program_id = program_record.id
  ORDER BY min_points ASC
  LIMIT 1;

  -- Create customer loyalty record
  INSERT INTO customer_loyalty (
    customer_id, program_id, current_tier_id,
    annual_period_start
  ) VALUES (
    p_customer_id, program_record.id, base_tier_id,
    DATE_TRUNC('year', NOW())
  )
  ON CONFLICT (customer_id, program_id) DO NOTHING
  RETURNING id INTO new_loyalty_id;

  RETURN new_loyalty_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Earn loyalty points
-- ============================================
CREATE OR REPLACE FUNCTION earn_loyalty_points(
  p_customer_id UUID,
  p_salon_id UUID,
  p_amount_cents INTEGER,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  loyalty_record RECORD;
  program_record RECORD;
  tier_record RECORD;
  points_to_earn INTEGER;
  multiplier DECIMAL(3,2);
BEGIN
  -- Get or create customer loyalty
  SELECT cl.*, lp.points_per_chf
  INTO loyalty_record
  FROM customer_loyalty cl
  JOIN loyalty_programs lp ON cl.program_id = lp.id
  WHERE cl.customer_id = p_customer_id;

  IF NOT FOUND THEN
    PERFORM initialize_customer_loyalty(p_customer_id, p_salon_id);

    SELECT cl.*, lp.points_per_chf
    INTO loyalty_record
    FROM customer_loyalty cl
    JOIN loyalty_programs lp ON cl.program_id = lp.id
    WHERE cl.customer_id = p_customer_id;

    IF NOT FOUND THEN
      RETURN 0;
    END IF;
  END IF;

  -- Get tier multiplier
  IF loyalty_record.current_tier_id IS NOT NULL THEN
    SELECT points_multiplier INTO multiplier
    FROM loyalty_tiers
    WHERE id = loyalty_record.current_tier_id;
  END IF;
  multiplier := COALESCE(multiplier, 1.00);

  -- Calculate points
  points_to_earn := FLOOR((p_amount_cents / 100.0) * loyalty_record.points_per_chf * multiplier);

  IF points_to_earn <= 0 THEN
    RETURN 0;
  END IF;

  -- Record transaction
  INSERT INTO loyalty_transactions (
    customer_loyalty_id, transaction_type,
    points, balance_before, balance_after,
    reference_type, reference_id, description,
    expires_at
  ) VALUES (
    loyalty_record.id, 'earn_purchase',
    points_to_earn, loyalty_record.points_balance, loyalty_record.points_balance + points_to_earn,
    p_reference_type, p_reference_id, COALESCE(p_description, 'Points earned from purchase'),
    NOW() + INTERVAL '2 years'
  );

  -- Update balance
  UPDATE customer_loyalty
  SET
    points_balance = points_balance + points_to_earn,
    lifetime_points = lifetime_points + points_to_earn,
    annual_spend_cents = annual_spend_cents + p_amount_cents
  WHERE id = loyalty_record.id;

  -- Check for tier upgrade
  PERFORM check_tier_upgrade(loyalty_record.id);

  RETURN points_to_earn;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Redeem loyalty points
-- ============================================
CREATE OR REPLACE FUNCTION redeem_loyalty_points(
  p_customer_id UUID,
  p_points_to_redeem INTEGER,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  loyalty_record RECORD;
  program_record RECORD;
  discount_cents INTEGER;
BEGIN
  -- Get customer loyalty
  SELECT cl.*, lp.points_value_cents, lp.min_points_to_redeem
  INTO loyalty_record
  FROM customer_loyalty cl
  JOIN loyalty_programs lp ON cl.program_id = lp.id
  WHERE cl.customer_id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not enrolled in loyalty program';
  END IF;

  -- Validate points
  IF p_points_to_redeem < loyalty_record.min_points_to_redeem THEN
    RAISE EXCEPTION 'Minimum redemption is % points', loyalty_record.min_points_to_redeem;
  END IF;

  IF p_points_to_redeem > loyalty_record.points_balance THEN
    RAISE EXCEPTION 'Insufficient points balance';
  END IF;

  -- Calculate discount value
  discount_cents := p_points_to_redeem * loyalty_record.points_value_cents;

  -- Record transaction
  INSERT INTO loyalty_transactions (
    customer_loyalty_id, transaction_type,
    points, balance_before, balance_after,
    reference_type, reference_id, description
  ) VALUES (
    loyalty_record.id, 'redeem',
    -p_points_to_redeem, loyalty_record.points_balance, loyalty_record.points_balance - p_points_to_redeem,
    p_reference_type, p_reference_id, COALESCE(p_description, 'Points redeemed')
  );

  -- Update balance
  UPDATE customer_loyalty
  SET points_balance = points_balance - p_points_to_redeem
  WHERE id = loyalty_record.id;

  RETURN discount_cents;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Check and apply tier upgrade
-- ============================================
CREATE OR REPLACE FUNCTION check_tier_upgrade(p_customer_loyalty_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  loyalty_record RECORD;
  new_tier RECORD;
  upgraded BOOLEAN := false;
BEGIN
  -- Get current loyalty status
  SELECT * INTO loyalty_record
  FROM customer_loyalty
  WHERE id = p_customer_loyalty_id;

  -- Find appropriate tier
  SELECT * INTO new_tier
  FROM loyalty_tiers
  WHERE program_id = loyalty_record.program_id
    AND min_points <= loyalty_record.lifetime_points
    AND (min_annual_spend_cents IS NULL OR min_annual_spend_cents <= loyalty_record.annual_spend_cents)
  ORDER BY min_points DESC
  LIMIT 1;

  -- Update if different
  IF new_tier.id IS DISTINCT FROM loyalty_record.current_tier_id THEN
    UPDATE customer_loyalty
    SET current_tier_id = new_tier.id
    WHERE id = p_customer_loyalty_id;
    upgraded := true;
  END IF;

  RETURN upgraded;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Award birthday bonus
-- ============================================
CREATE OR REPLACE FUNCTION award_birthday_bonus(p_customer_id UUID)
RETURNS INTEGER AS $$
DECLARE
  loyalty_record RECORD;
  program_record RECORD;
  customer_record RECORD;
  bonus_points INTEGER;
BEGIN
  -- Get customer birthday
  SELECT * INTO customer_record FROM customers WHERE id = p_customer_id;
  IF NOT FOUND OR customer_record.birthday IS NULL THEN
    RETURN 0;
  END IF;

  -- Get loyalty and program
  SELECT cl.*, lp.birthday_bonus_points
  INTO loyalty_record
  FROM customer_loyalty cl
  JOIN loyalty_programs lp ON cl.program_id = lp.id
  WHERE cl.customer_id = p_customer_id;

  IF NOT FOUND OR loyalty_record.birthday_bonus_points <= 0 THEN
    RETURN 0;
  END IF;

  bonus_points := loyalty_record.birthday_bonus_points;

  -- Check if already awarded this year
  IF EXISTS (
    SELECT 1 FROM loyalty_transactions
    WHERE customer_loyalty_id = loyalty_record.id
      AND transaction_type = 'earn_birthday'
      AND DATE_PART('year', created_at) = DATE_PART('year', NOW())
  ) THEN
    RETURN 0;
  END IF;

  -- Award bonus
  INSERT INTO loyalty_transactions (
    customer_loyalty_id, transaction_type,
    points, balance_before, balance_after,
    description, expires_at
  ) VALUES (
    loyalty_record.id, 'earn_birthday',
    bonus_points, loyalty_record.points_balance, loyalty_record.points_balance + bonus_points,
    'Geburtstagsbonus', NOW() + INTERVAL '1 year'
  );

  UPDATE customer_loyalty
  SET
    points_balance = points_balance + bonus_points,
    lifetime_points = lifetime_points + bonus_points
  WHERE id = loyalty_record.id;

  RETURN bonus_points;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Customer loyalty summary
-- ============================================
CREATE VIEW v_customer_loyalty AS
SELECT
  cl.*,
  c.first_name || ' ' || c.last_name AS customer_name,
  c.salon_id,
  lp.name AS program_name,
  lt.name AS tier_name,
  lt.points_multiplier,
  lt.discount_percent AS tier_discount_percent,
  (cl.points_balance * lp.points_value_cents / 100.0) AS points_value_chf
FROM customer_loyalty cl
JOIN customers c ON cl.customer_id = c.id
JOIN loyalty_programs lp ON cl.program_id = lp.id
LEFT JOIN loyalty_tiers lt ON cl.current_tier_id = lt.id;

COMMENT ON VIEW v_customer_loyalty IS 'Customer loyalty with tier info';

-- ============================================
-- VIEW: Recent loyalty transactions
-- ============================================
CREATE VIEW v_recent_loyalty_transactions AS
SELECT
  lt.*,
  c.first_name || ' ' || c.last_name AS customer_name,
  c.salon_id
FROM loyalty_transactions lt
JOIN customer_loyalty cl ON lt.customer_loyalty_id = cl.id
JOIN customers c ON cl.customer_id = c.id
WHERE lt.created_at >= NOW() - INTERVAL '30 days'
ORDER BY lt.created_at DESC;

COMMENT ON VIEW v_recent_loyalty_transactions IS 'Recent loyalty activity';
