-- Quotes System Database Schema
-- Execute this script in your Supabase SQL Editor

-- =====================================================
-- CUSTOM TYPES & ENUMS
-- =====================================================

-- Quote status
CREATE TYPE quote_status AS ENUM (
  'DRAFT',           -- Being prepared
  'SENT',            -- Sent to customer
  'ACCEPTED',        -- Customer accepted
  'DECLINED',        -- Customer declined
  'EXPIRED',         -- Past expiry date
  'CANCELLED',       -- Cancelled by company
  'CONVERTED'        -- Converted to invoice
);

-- =====================================================
-- QUOTES TABLE
-- =====================================================
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(50) NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  status quote_status NOT NULL DEFAULT 'DRAFT',
  subtotal BIGINT NOT NULL DEFAULT 0, -- in Rappen
  vat_amount BIGINT NOT NULL DEFAULT 0, -- in Rappen
  total BIGINT NOT NULL DEFAULT 0, -- in Rappen
  discount_code VARCHAR(50),
  discount_amount BIGINT NOT NULL DEFAULT 0, -- in Rappen
  internal_notes TEXT,
  acceptance_token VARCHAR(100) UNIQUE, -- Unique token for acceptance link
  acceptance_link TEXT, -- Full acceptance URL
  accepted_at TIMESTAMPTZ, -- When customer accepted
  accepted_by_email VARCHAR(255), -- Email that accepted the quote
  sent_at TIMESTAMPTZ,
  email_sent_count INTEGER NOT NULL DEFAULT 0,
  converted_to_invoice_id UUID REFERENCES invoices(id), -- If converted to invoice
  converted_at TIMESTAMPTZ, -- When converted to invoice
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(company_id, number)
);

-- =====================================================
-- QUOTE ITEMS TABLE
-- =====================================================
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  quantity INTEGER NOT NULL, -- * 1000 for 3 decimals
  unit VARCHAR(20) NOT NULL DEFAULT 'Stück',
  unit_price BIGINT NOT NULL, -- in Rappen
  discount INTEGER NOT NULL DEFAULT 0, -- percentage * 100
  vat_rate INTEGER NOT NULL, -- percentage * 100
  line_total BIGINT NOT NULL, -- in Rappen
  vat_amount BIGINT NOT NULL, -- in Rappen
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_quotes_company_id ON quotes(company_id);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quotes_number ON quotes(company_id, number);
CREATE INDEX idx_quotes_status ON quotes(company_id, status);
CREATE INDEX idx_quotes_date ON quotes(company_id, date);
CREATE INDEX idx_quotes_expiry_date ON quotes(expiry_date);
CREATE INDEX idx_quotes_acceptance_token ON quotes(acceptance_token);
CREATE INDEX idx_quotes_converted_to_invoice ON quotes(converted_to_invoice_id);

CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);

-- =====================================================
-- UPDATED_AT TRIGGER FOR QUOTES
-- =====================================================
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTION TO GENERATE QUOTE NUMBER
-- =====================================================
CREATE OR REPLACE FUNCTION generate_quote_number(company_uuid UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  quote_number VARCHAR(50);
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(number FROM 'AN-\d{4}-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO next_number
  FROM quotes 
  WHERE company_id = company_uuid 
    AND EXTRACT(YEAR FROM date) = current_year;
  
  quote_number := 'AN-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN quote_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- Quotes: Users can access quotes from their own company
CREATE POLICY "Users can access quotes from their own company" ON quotes
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Quote Items: Users can access items from quotes of their own company
CREATE POLICY "Users can access quote items from their own company" ON quote_items
  FOR ALL USING (
    quote_id IN (
      SELECT id FROM quotes WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- =====================================================
-- VIEW FOR QUOTE OVERVIEW
-- =====================================================
CREATE VIEW quote_overview AS
SELECT 
  q.id,
  q.number,
  q.date,
  q.expiry_date,
  q.status,
  q.total,
  q.accepted_at,
  q.converted_to_invoice_id,
  q.company_id,
  c.name as customer_name,
  c.company as customer_company,
  c.email as customer_email,
  comp.name as company_name
FROM quotes q
JOIN customers c ON q.customer_id = c.id
JOIN companies comp ON q.company_id = comp.id;

-- =====================================================
-- COMPLETED
-- =====================================================

COMMENT ON TABLE quotes IS 'Quotes table for customer proposals before invoicing';
COMMENT ON TABLE quote_items IS 'Line items for quotes';
COMMENT ON COLUMN quotes.acceptance_token IS 'Unique token for customer acceptance link';
COMMENT ON COLUMN quotes.acceptance_link IS 'Full URL for customer to accept the quote';
COMMENT ON COLUMN quotes.accepted_at IS 'Timestamp when customer accepted via link';
COMMENT ON COLUMN quotes.converted_to_invoice_id IS 'Reference to invoice if quote was converted';






