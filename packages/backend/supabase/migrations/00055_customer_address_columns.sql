-- Add address columns to customers table
-- so we can pre-fill checkout for returning customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS street2 TEXT,
  ADD COLUMN IF NOT EXISTS zip TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Schweiz';
