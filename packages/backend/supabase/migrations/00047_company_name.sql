-- Add company name field for legal pages

ALTER TABLE salons ADD COLUMN IF NOT EXISTS company_name TEXT;

COMMENT ON COLUMN salons.company_name IS 'Legal company name (e.g., "BeautifyPRO SG GmbH") used in Impressum, Datenschutz, AGB';
