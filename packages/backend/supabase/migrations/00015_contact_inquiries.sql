-- ============================================
-- Contact Inquiries Table
-- ============================================

CREATE TYPE contact_inquiry_status AS ENUM ('new', 'in_progress', 'resolved', 'spam');

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  reason TEXT NOT NULL,
  message TEXT NOT NULL,

  status contact_inquiry_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES profiles(id),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Index for fast lookup
CREATE INDEX idx_contact_inquiries_salon_status ON contact_inquiries(salon_id, status);
CREATE INDEX idx_contact_inquiries_created_at ON contact_inquiries(created_at DESC);

-- RLS
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Only admins and managers can view contact inquiries
CREATE POLICY "Staff can view contact inquiries" ON contact_inquiries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.profile_id = auth.uid()
        AND user_roles.salon_id = contact_inquiries.salon_id
        AND user_roles.role_name IN ('admin', 'manager')
    )
  );

-- Only admins and managers can update
CREATE POLICY "Staff can update contact inquiries" ON contact_inquiries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.profile_id = auth.uid()
        AND user_roles.salon_id = contact_inquiries.salon_id
        AND user_roles.role_name IN ('admin', 'manager')
    )
  );

-- Service role can insert (from server actions)
CREATE POLICY "Service role can insert contact inquiries" ON contact_inquiries
  FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER contact_inquiries_updated_at
  BEFORE UPDATE ON contact_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
