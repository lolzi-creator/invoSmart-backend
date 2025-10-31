-- Expenses System Database Schema
-- Execute this script in your Supabase SQL Editor

-- =====================================================
-- CUSTOM TYPES & ENUMS
-- =====================================================

-- Expense status
CREATE TYPE expense_status AS ENUM (
  'PENDING',    -- Awaiting approval
  'APPROVED',   -- Approved
  'REJECTED',   -- Rejected
  'PAID'        -- Paid/Reimbursed
);

-- Expense payment method
CREATE TYPE payment_method AS ENUM (
  'CASH',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'BANK_TRANSFER',
  'CHECK',
  'OTHER'
);

-- =====================================================
-- EXPENSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Basic Information
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  
  -- Financial Information
  amount BIGINT NOT NULL, -- in Rappen (cents)
  currency VARCHAR(3) NOT NULL DEFAULT 'CHF',
  vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 7.7, -- percentage
  vat_amount BIGINT NOT NULL DEFAULT 0, -- in Rappen (cents)
  is_tax_deductible BOOLEAN NOT NULL DEFAULT true,
  
  -- Dates
  expense_date DATE NOT NULL,
  payment_date DATE,
  
  -- Payment Details
  payment_method payment_method,
  vendor_name VARCHAR(255), -- Supplier/vendor name
  
  -- Workflow
  status expense_status NOT NULL DEFAULT 'PENDING',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Additional Fields (Option 3)
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_period VARCHAR(50), -- monthly, quarterly, yearly
  budget_category VARCHAR(100), -- Optional budget tracking
  notes TEXT, -- Additional notes/comments
  
  -- Attachments (stored as JSONB array)
  attachments JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_amount CHECK (amount >= 0),
  CONSTRAINT valid_vat_rate CHECK (vat_rate >= 0 AND vat_rate <= 100)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_expenses_company_id ON expenses(company_id);
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_category ON expenses(company_id, category);
CREATE INDEX idx_expenses_status ON expenses(company_id, status);
CREATE INDEX idx_expenses_expense_date ON expenses(company_id, expense_date);
CREATE INDEX idx_expenses_payment_date ON expenses(company_id, payment_date);
CREATE INDEX idx_expenses_created_at ON expenses(company_id, created_at DESC);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamp
CREATE TRIGGER update_expenses_updated_at 
  BEFORE UPDATE ON expenses 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see expenses from their company
CREATE POLICY expenses_company_isolation ON expenses
  FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::UUID);

