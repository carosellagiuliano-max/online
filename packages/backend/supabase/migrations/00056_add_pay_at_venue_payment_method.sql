-- Add 'pay_at_venue' to payment_method enum
-- This allows customers to pay at the salon when picking up orders
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'pay_at_venue';

-- Add payment_method and payment_status columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method payment_method DEFAULT 'stripe_card';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'pending';
