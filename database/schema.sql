-- Swiss Invoice System Database Schema
-- Execute this script in your Supabase SQL Editor

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CUSTOM TYPES & ENUMS
-- =====================================================

-- User roles
CREATE TYPE user_role AS ENUM ('ADMIN', 'EMPLOYEE');

-- Invoice status
CREATE TYPE invoice_status AS ENUM (
  'DRAFT', 
  'OPEN', 
  'PARTIAL_PAID', 
  'PAID', 
  'OVERDUE', 
  'CANCELLED'
);

-- Payment matching confidence
CREATE TYPE match_confidence AS ENUM (
  'HIGH',    -- Exact QR reference match
  'MEDIUM',  -- Amount + date match
  'LOW',     -- Only amount match
  'MANUAL'   -- Manually assigned
);

-- Discount types
CREATE TYPE discount_type AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- Email template types
CREATE TYPE email_type AS ENUM (
  'INVOICE',
  'REMINDER_1',
  'REMINDER_2', 
  'REMINDER_3'
);

-- =====================================================
-- COMPANIES TABLE
-- =====================================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500) NOT NULL,
  zip VARCHAR(20) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country VARCHAR(2) NOT NULL DEFAULT 'CH',
  phone VARCHAR(50),
  email VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  uid VARCHAR(50), -- Swiss UID
  vat_number VARCHAR(50), -- MWST Number
  iban VARCHAR(34),
  qr_iban VARCHAR(34),
  logo_url VARCHAR(500),
  default_payment_terms INTEGER NOT NULL DEFAULT 30,
  default_language VARCHAR(2) NOT NULL DEFAULT 'de',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'EMPLOYEE',
  is_active BOOLEAN NOT NULL DEFAULT true,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CUSTOMERS TABLE
-- =====================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  email VARCHAR(255),
  address VARCHAR(500) NOT NULL,
  zip VARCHAR(20) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country VARCHAR(2) NOT NULL DEFAULT 'CH',
  phone VARCHAR(50),
  uid VARCHAR(50), -- Swiss UID (CHE-XXX.XXX.XXX)
  vat_number VARCHAR(50),
  payment_terms INTEGER NOT NULL DEFAULT 30,
  credit_limit INTEGER, -- in Rappen (cents)
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  language VARCHAR(2) NOT NULL DEFAULT 'de',
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique customer numbers per company
  UNIQUE(company_id, customer_number)
);

-- =====================================================
-- INVOICES TABLE
-- =====================================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(50) NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  service_date DATE NOT NULL, -- Leistungsdatum (zwingend für MWST-Abrechnung)
  status invoice_status NOT NULL DEFAULT 'DRAFT',
  subtotal BIGINT NOT NULL DEFAULT 0, -- in Rappen
  vat_amount BIGINT NOT NULL DEFAULT 0, -- in Rappen
  total BIGINT NOT NULL DEFAULT 0, -- in Rappen
  paid_amount BIGINT NOT NULL DEFAULT 0, -- in Rappen
  qr_reference VARCHAR(50) NOT NULL,
  reminder_level INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  email_sent_count INTEGER NOT NULL DEFAULT 0,
  discount_code VARCHAR(50),
  discount_amount BIGINT NOT NULL DEFAULT 0, -- in Rappen
  internal_notes TEXT, -- Internal notes/comments for the invoice
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(company_id, number)
);

-- =====================================================
-- INVOICE ITEMS TABLE
-- =====================================================
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
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
-- PAYMENTS TABLE
-- =====================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL, -- in Rappen
  value_date DATE NOT NULL,
  reference VARCHAR(100),
  description VARCHAR(500),
  confidence match_confidence NOT NULL DEFAULT 'LOW',
  is_matched BOOLEAN NOT NULL DEFAULT false,
  import_batch VARCHAR(100),
  raw_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- VAT RATES TABLE
-- =====================================================
CREATE TABLE vat_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  rate INTEGER NOT NULL, -- percentage * 100
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- DISCOUNT CODES TABLE
-- =====================================================
CREATE TABLE discount_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100),
  type discount_type NOT NULL,
  value BIGINT NOT NULL, -- in Rappen or percentage * 100
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(company_id, code)
);

-- =====================================================
-- EMAIL TEMPLATES TABLE
-- =====================================================
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  type email_type NOT NULL,
  language VARCHAR(2) NOT NULL DEFAULT 'de',
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(company_id, name)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_company_id ON users(company_id);

-- Customers
CREATE INDEX idx_customers_company_id ON customers(company_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_active ON customers(company_id, is_active);

-- Invoices
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_number ON invoices(company_id, number);
CREATE INDEX idx_invoices_status ON invoices(company_id, status);
CREATE INDEX idx_invoices_date ON invoices(company_id, date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_qr_reference ON invoices(qr_reference);

-- Invoice Items
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Payments
CREATE INDEX idx_payments_company_id ON payments(company_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_reference ON payments(reference);
CREATE INDEX idx_payments_value_date ON payments(value_date);
CREATE INDEX idx_payments_matched ON payments(company_id, is_matched);

-- Email Templates
CREATE INDEX idx_email_templates_company_id ON email_templates(company_id);
CREATE INDEX idx_email_templates_type ON email_templates(company_id, type, language);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vat_rates_updated_at BEFORE UPDATE ON vat_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discount_codes_updated_at BEFORE UPDATE ON discount_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate invoice number
-- Format: RE-{UUID_PART}-{YEAR}-{7_DIGIT_SEQUENTIAL}
-- Example: RE-fd71-2025-0000001
CREATE OR REPLACE FUNCTION generate_invoice_number(company_uuid UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  invoice_number VARCHAR(50);
  uuid_part VARCHAR(10);
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Extract middle segment from UUID (e.g., "fd71" from "ba6d7934-fd71-426a-8344-57613a17477c")
  -- Using 2nd segment (split by dash and take 2nd part)
  uuid_part := UPPER(SPLIT_PART(company_uuid::TEXT, '-', 2));
  
  -- Get next sequential number for this company and year
  -- Match pattern: RE-{uuid_part}-{year}-{sequential} (7 digits)
  -- Escape special characters in uuid_part for regex
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(number FROM 'RE-' || uuid_part || '-' || current_year::TEXT || '-(\d{7})') AS INTEGER)
  ), 0) + 1
  INTO next_number
  FROM invoices 
  WHERE company_id = company_uuid 
    AND EXTRACT(YEAR FROM date) = current_year
    AND number LIKE 'RE-' || uuid_part || '-' || current_year::TEXT || '-%';
  
  -- Format: RE-{UUID_PART}-{YEAR}-{7_DIGIT_SEQUENTIAL}
  invoice_number := 'RE-' || uuid_part || '-' || current_year || '-' || LPAD(next_number::TEXT, 7, '0');
  
  RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate Modulo 10 checksum (ISO 11649)
CREATE OR REPLACE FUNCTION calculate_modulo10_checksum(input_str VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  sum_val INTEGER := 0;
  i INTEGER;
  digit INTEGER;
  weight INTEGER;
BEGIN
  -- Reverse the string and process each digit
  FOR i IN REVERSE LENGTH(input_str)..1 LOOP
    digit := CAST(SUBSTRING(input_str FROM i FOR 1) AS INTEGER);
    -- Alternate weight: 1, 3, 1, 3, ...
    weight := CASE WHEN (LENGTH(input_str) - i + 1) % 2 = 1 THEN 1 ELSE 3 END;
    sum_val := sum_val + (digit * weight);
  END LOOP;
  
  -- Calculate check digit: (10 - (sum mod 10)) mod 10
  RETURN (10 - (sum_val % 10)) % 10;
END;
$$ LANGUAGE plpgsql;

-- Function to generate QR reference (27-digit numeric with Modulo 10 checksum)
-- QR references are only used with QR-IBAN
CREATE OR REPLACE FUNCTION generate_qr_reference(invoice_num VARCHAR(50), company_uuid UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  base_number VARCHAR(50);
  checksum INTEGER;
  qr_reference VARCHAR(50);
  numeric_part VARCHAR(50);
  uuid_part VARCHAR(10);
BEGIN
  -- Extract numeric part from invoice number (e.g., "20250001" from "RE-2025-0001")
  numeric_part := REGEXP_REPLACE(invoice_num, '\D', '', 'g');
  
  -- Extract part from UUID to make it unique (first 6 chars, convert to numeric)
  uuid_part := REGEXP_REPLACE(SUBSTRING(company_uuid::TEXT FROM 1 FOR 6), '[^0-9]', '', 'g');
  
  -- If UUID part is too short, pad with zeros, if too long, truncate
  IF LENGTH(uuid_part) = 0 THEN
    uuid_part := '000000';
  ELSIF LENGTH(uuid_part) > 6 THEN
    uuid_part := SUBSTRING(uuid_part FROM 1 FOR 6);
  END IF;
  
  -- Build base number: ensure we have exactly 26 digits before checksum
  -- Format: [uuid_part (max 6)] + [numeric_part] + padding to reach 26 digits
  base_number := LPAD(uuid_part || numeric_part, 26, '0');
  
  -- If still too long, truncate from left
  IF LENGTH(base_number) > 26 THEN
    base_number := SUBSTRING(base_number FROM LENGTH(base_number) - 25 FOR 26);
  END IF;
  
  -- Calculate Modulo 10 checksum
  checksum := calculate_modulo10_checksum(base_number);
  
  -- QR reference: 27 digits total (26 digits + 1 check digit)
  qr_reference := base_number || checksum::TEXT;
  
  RETURN qr_reference;
END;
$$ LANGUAGE plpgsql;

-- Function to generate SCOR reference (RF prefix with ISO 11649 checksum)
-- SCOR references are only used with normal IBAN (not QR-IBAN)
CREATE OR REPLACE FUNCTION generate_scor_reference(invoice_num VARCHAR(50), company_uuid UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  base_string VARCHAR(50);
  checksum INTEGER;
  scor_reference VARCHAR(50);
  numeric_part VARCHAR(50);
  uuid_part VARCHAR(10);
BEGIN
  -- Extract numeric part from invoice number
  numeric_part := REGEXP_REPLACE(invoice_num, '\D', '', 'g');
  
  -- Extract part from UUID
  uuid_part := REGEXP_REPLACE(SUBSTRING(company_uuid::TEXT FROM 1 FOR 6), '[^0-9]', '', 'g');
  
  IF LENGTH(uuid_part) = 0 THEN
    uuid_part := '000000';
  ELSIF LENGTH(uuid_part) > 6 THEN
    uuid_part := SUBSTRING(uuid_part FROM 1 FOR 6);
  END IF;
  
  -- Build base: ensure we have enough digits for SCOR (max 21 digits after RF)
  -- SCOR format: RF + 2 check digits + up to 21 alphanumeric characters
  -- We'll use numeric only for simplicity: RF + 2 check digits + numeric part
  base_string := LPAD(uuid_part || numeric_part, 21, '0');
  
  -- If too long, truncate
  IF LENGTH(base_string) > 21 THEN
    base_string := SUBSTRING(base_string FROM LENGTH(base_string) - 20 FOR 21);
  END IF;
  
  -- Calculate ISO 11649 checksum for "RF" + base_string
  -- Convert RF to numbers: R=27, F=15, so RF = 2715
  checksum := calculate_modulo10_checksum('2715' || base_string);
  
  -- SCOR reference: RF + 2-digit checksum + base string
  scor_reference := 'RF' || LPAD(checksum::TEXT, 2, '0') || base_string;
  
  RETURN scor_reference;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Companies: Users can only access their own company
CREATE POLICY "Users can access their own company" ON companies
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM users WHERE company_id = companies.id
    )
  );

-- Users: Users can access users from their own company
CREATE POLICY "Users can access users from their own company" ON users
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Customers: Users can access customers from their own company
CREATE POLICY "Users can access customers from their own company" ON customers
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Invoices: Users can access invoices from their own company
CREATE POLICY "Users can access invoices from their own company" ON invoices
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Invoice Items: Users can access items from invoices of their own company
CREATE POLICY "Users can access invoice items from their own company" ON invoice_items
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Payments: Users can access payments from their own company
CREATE POLICY "Users can access payments from their own company" ON payments
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- VAT Rates: Users can access VAT rates from their own company
CREATE POLICY "Users can access VAT rates from their own company" ON vat_rates
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Discount Codes: Users can access discount codes from their own company
CREATE POLICY "Users can access discount codes from their own company" ON discount_codes
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Email Templates: Users can access email templates from their own company
CREATE POLICY "Users can access email templates from their own company" ON email_templates
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- DEFAULT DATA CREATION FUNCTIONS
-- =====================================================

-- Function to create default VAT rates for a new company
CREATE OR REPLACE FUNCTION create_default_vat_rates(company_uuid UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO vat_rates (name, rate, is_default, is_active, company_id) VALUES
    ('Standard 7.7%', 770, true, true, company_uuid),
    ('Reduziert 2.5%', 250, false, true, company_uuid),
    ('Befreit 0%', 0, false, true, company_uuid);
END;
$$ LANGUAGE plpgsql;

-- Function to create default email templates for a new company
CREATE OR REPLACE FUNCTION create_default_email_templates(company_uuid UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO email_templates (name, subject, body, type, language, company_id) VALUES
  (
    'Standard Rechnung (Deutsch)', 
    'Rechnung {{invoiceNumber}} von {{companyName}}',
    'Sehr geehrte Damen und Herren,

anbei erhalten Sie die Rechnung {{invoiceNumber}} vom {{invoiceDate}} über CHF {{total}}.

Zahlungsziel: {{dueDate}}
Zahlungsreferenz: {{qrReference}}

Vielen Dank für Ihr Vertrauen.

Mit freundlichen Grüssen
{{companyName}}
{{companyAddress}}
{{companyZip}} {{companyCity}}

Diese E-Mail wurde automatisch generiert.',
    'INVOICE',
    'de',
    company_uuid
  ),
  (
    '1. Mahnung (Deutsch)',
    '1. Zahlungserinnerung - Rechnung {{invoiceNumber}}',
    'Sehr geehrte Damen und Herren,

unsere Rechnung {{invoiceNumber}} vom {{invoiceDate}} über CHF {{total}} ist seit dem {{dueDate}} fällig.

Falls Sie die Zahlung bereits geleistet haben, betrachten Sie dieses Schreiben als gegenstandslos.

Andernfalls bitten wir Sie, den offenen Betrag binnen 10 Tagen zu begleichen.

Zahlungsreferenz: {{qrReference}}

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüssen
{{companyName}}',
    'REMINDER_1',
    'de',
    company_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for invoice overview with customer data
CREATE VIEW invoice_overview AS
SELECT 
  i.id,
  i.number,
  i.date,
  i.due_date,
  i.service_date, -- Leistungsdatum (für MWST-Abrechnung)
  i.status,
  i.total,
  i.paid_amount,
  (i.total - i.paid_amount) as outstanding_amount,
  i.qr_reference,
  i.reminder_level,
  i.company_id,
  c.name as customer_name,
  c.company as customer_company,
  c.email as customer_email,
  comp.name as company_name
FROM invoices i
JOIN customers c ON i.customer_id = c.id
JOIN companies comp ON i.company_id = comp.id;

-- View for payment statistics
CREATE VIEW payment_stats AS
SELECT 
  company_id,
  COUNT(*) as total_payments,
  COUNT(*) FILTER (WHERE is_matched = true) as matched_payments,
  COUNT(*) FILTER (WHERE is_matched = false) as unmatched_payments,
  SUM(amount) as total_amount,
  SUM(amount) FILTER (WHERE is_matched = true) as matched_amount,
  SUM(amount) FILTER (WHERE is_matched = false) as unmatched_amount
FROM payments
GROUP BY company_id;

-- =====================================================
-- COMPLETED SCHEMA
-- =====================================================

-- Schema creation completed successfully!
-- Next steps:
-- 1. Run this script in your Supabase SQL Editor
-- 2. Configure authentication in Supabase
-- 3. Update backend to use Supabase client
-- 4. Test all APIs with real database

COMMENT ON SCHEMA public IS 'Swiss Invoice System - Complete database schema with RLS, indexes, and triggers';
