-- ============================================
-- 00049: Public Feedback Enhancements
-- Allow anonymous/public feedback submission
-- ============================================

-- 1. Drop existing view that depends on customer_feedback
-- (it has a computed customer_name column that conflicts with our new column)
DROP VIEW IF EXISTS v_recent_feedback;

-- 2. Add columns for public feedback
ALTER TABLE customer_feedback
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- 3. Make customer_id nullable (for anonymous feedback)
ALTER TABLE customer_feedback
ALTER COLUMN customer_id DROP NOT NULL;

-- 4. Recreate the view to handle NULL customer_id
CREATE OR REPLACE VIEW v_recent_feedback AS
SELECT
  cf.*,
  COALESCE(cf.customer_name, c.first_name || ' ' || c.last_name, 'Anonym') as display_name,
  s.name as service_name,
  st.display_name as staff_name
FROM customer_feedback cf
LEFT JOIN customers c ON cf.customer_id = c.id
LEFT JOIN services s ON cf.service_id = s.id
LEFT JOIN staff st ON cf.staff_id = st.id
WHERE cf.submitted_at >= NOW() - INTERVAL '30 days'
ORDER BY cf.submitted_at DESC;

COMMENT ON VIEW v_recent_feedback IS 'Recent customer feedback with details (includes anonymous)';

-- 5. Allow public/anonymous feedback submission
CREATE POLICY "Public can submit feedback"
ON customer_feedback FOR INSERT
TO anon
WITH CHECK (
  -- Must have a name
  customer_name IS NOT NULL AND
  customer_name != '' AND
  -- Rating must be valid
  rating >= 1 AND rating <= 5 AND
  -- Status must be pending (will be moderated)
  status = 'pending'
);

-- 6. Allow service_role full access for admin operations
CREATE POLICY "Service role can manage all feedback"
ON customer_feedback FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 7. Index for public feedback queries
CREATE INDEX IF NOT EXISTS idx_customer_feedback_public
ON customer_feedback(salon_id, status, submitted_at DESC)
WHERE status = 'approved';

-- 8. Comments
COMMENT ON COLUMN customer_feedback.customer_name IS 'Name provided by customer (for anonymous feedback)';
COMMENT ON COLUMN customer_feedback.customer_email IS 'Email provided by customer (optional, for follow-up)';
COMMENT ON COLUMN customer_feedback.ip_address IS 'IP address of submitter (for spam prevention)';
