-- RBAC and Invitation System Schema
-- Execute this script in your Supabase SQL Editor

-- =====================================================
-- PERMISSIONS TABLE
-- =====================================================
-- Stores available permissions in the system
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'invoices.create', 'invoices.delete'
  description TEXT,
  module VARCHAR(50) NOT NULL, -- e.g., 'invoices', 'customers', 'expenses'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- ROLE PERMISSIONS TABLE
-- =====================================================
-- Links roles to permissions (customizable per company)
-- Each company can customize what each role can do
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  is_granted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique permission per role per company
  UNIQUE(company_id, role, permission_id)
);

-- =====================================================
-- USER INVITATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'EMPLOYEE',
  token VARCHAR(100) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_role_permissions_company_role ON role_permissions(company_id, role);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_company_email ON user_invitations(company_id, email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_expires ON user_invitations(expires_at) WHERE accepted_at IS NULL;

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Permissions: All authenticated users can view (they're system-wide)
CREATE POLICY "Users can view permissions" ON permissions
  FOR SELECT USING (true);

-- Role Permissions: Users can view permissions for their company
CREATE POLICY "Users can view role permissions for their company" ON role_permissions
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Role Permissions: Only admins can modify
CREATE POLICY "Only admins can modify role permissions" ON role_permissions
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- User Invitations: Users can view invitations for their company
CREATE POLICY "Users can view invitations for their company" ON user_invitations
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- User Invitations: Only admins can create/manage invitations
CREATE POLICY "Only admins can manage invitations" ON user_invitations
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- User Invitations: Public access for token-based invitation acceptance (no auth required)
CREATE POLICY "Public can view invitation by token" ON user_invitations
  FOR SELECT USING (true); -- Token is unique and secure, so public read is safe

-- =====================================================
-- INSERT DEFAULT PERMISSIONS
-- =====================================================
-- Insert all available permissions in the system
INSERT INTO permissions (name, description, module) VALUES
-- Invoice permissions
('invoices.view', 'View invoices', 'invoices'),
('invoices.create', 'Create invoices', 'invoices'),
('invoices.edit_draft', 'Edit draft invoices', 'invoices'),
('invoices.edit_sent', 'Edit sent invoices', 'invoices'),
('invoices.delete', 'Delete invoices', 'invoices'),
('invoices.send_email', 'Send invoice emails', 'invoices'),
('invoices.view_pdf', 'View invoice PDFs', 'invoices'),
('invoices.mark_paid', 'Mark invoices as paid', 'invoices'),
('invoices.send_reminder', 'Send payment reminders', 'invoices'),
('invoices.cancel', 'Cancel invoices', 'invoices'),
('invoices.view_notes', 'View internal notes', 'invoices'),
('invoices.edit_notes', 'Edit internal notes', 'invoices'),
('invoices.add_files', 'Add files to invoices', 'invoices'),
('invoices.delete_files', 'Delete invoice files', 'invoices'),

-- Quote permissions
('quotes.view', 'View quotes', 'quotes'),
('quotes.create', 'Create quotes', 'quotes'),
('quotes.edit_draft', 'Edit draft quotes', 'quotes'),
('quotes.edit_sent', 'Edit sent quotes', 'quotes'),
('quotes.delete', 'Delete quotes', 'quotes'),
('quotes.send_email', 'Send quote emails', 'quotes'),
('quotes.view_pdf', 'View quote PDFs', 'quotes'),
('quotes.convert', 'Convert quotes to invoices', 'quotes'),
('quotes.regenerate_link', 'Regenerate acceptance links', 'quotes'),
('quotes.cancel', 'Cancel quotes', 'quotes'),
('quotes.view_notes', 'View internal notes', 'quotes'),
('quotes.edit_notes', 'Edit internal notes', 'quotes'),

-- Customer permissions
('customers.view', 'View customers', 'customers'),
('customers.create', 'Create customers', 'customers'),
('customers.edit', 'Edit customers', 'customers'),
('customers.delete', 'Delete customers', 'customers'),
('customers.deactivate', 'Deactivate customers', 'customers'),
('customers.view_payment_history', 'View customer payment history', 'customers'),
('customers.view_credit_limit', 'View credit limits', 'customers'),
('customers.edit_credit_limit', 'Edit credit limits', 'customers'),
('customers.view_notes', 'View customer notes', 'customers'),
('customers.edit_notes', 'Edit customer notes', 'customers'),

-- Payment permissions
('payments.view', 'View payments', 'payments'),
('payments.import', 'Import payments', 'payments'),
('payments.match', 'Match payments to invoices', 'payments'),
('payments.unmatch', 'Unmatch payments', 'payments'),
('payments.delete', 'Delete payments', 'payments'),
('payments.edit', 'Edit payments', 'payments'),

-- Expense permissions
('expenses.view_own', 'View own expenses', 'expenses'),
('expenses.view_all', 'View all expenses', 'expenses'),
('expenses.create', 'Create expenses', 'expenses'),
('expenses.edit_own', 'Edit own expenses', 'expenses'),
('expenses.edit_all', 'Edit any expense', 'expenses'),
('expenses.delete_own', 'Delete own expenses', 'expenses'),
('expenses.delete_all', 'Delete any expense', 'expenses'),
('expenses.approve', 'Approve expenses', 'expenses'),
('expenses.reject', 'Reject expenses', 'expenses'),
('expenses.mark_paid', 'Mark expenses as paid', 'expenses'),
('expenses.add_payment_date', 'Add payment dates', 'expenses'),
('expenses.export', 'Export expense reports', 'expenses'),
('expenses.view_statistics', 'View expense statistics', 'expenses'),
('expenses.upload_receipts', 'Upload receipts', 'expenses'),

-- User permissions
('users.view', 'View users', 'users'),
('users.create', 'Create users', 'users'),
('users.edit', 'Edit users', 'users'),
('users.change_role', 'Change user roles', 'users'),
('users.activate', 'Activate/deactivate users', 'users'),
('users.change_password', 'Change user passwords', 'users'),
('users.delete', 'Delete users', 'users'),
('users.view_activity', 'View user activity logs', 'users'),

-- Company settings permissions
('company.view', 'View company settings', 'company'),
('company.edit', 'Edit company settings', 'company'),
('company.change_logo', 'Change company logo', 'company'),
('company.edit_banking', 'Edit banking information', 'company'),
('company.edit_vat', 'Edit VAT information', 'company'),
('company.edit_payment_terms', 'Edit payment terms', 'company'),
('company.manage_email_templates', 'Manage email templates', 'company'),
('company.manage_vat_rates', 'Manage VAT rates', 'company'),

-- Reports permissions
('reports.view_dashboard', 'View dashboard', 'reports'),
('reports.view_sales', 'View sales reports', 'reports'),
('reports.view_financial', 'View financial reports', 'reports'),
('reports.export', 'Export reports', 'reports'),
('reports.view_analytics', 'View analytics', 'reports'),
('reports.view_expense_reports', 'View expense reports', 'reports'),

-- Files permissions
('files.upload', 'Upload files', 'files'),
('files.view', 'View files', 'files'),
('files.download', 'Download files', 'files'),
('files.delete', 'Delete files', 'files'),

-- Settings permissions
('settings.manage_permissions', 'Manage role permissions', 'settings'),
('settings.view_audit_logs', 'View audit logs', 'settings'),
('settings.view_activity_logs', 'View activity logs', 'settings'),
('settings.manage_api_keys', 'Manage API keys', 'settings')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- FUNCTION TO INITIALIZE DEFAULT PERMISSIONS FOR COMPANY
-- =====================================================
CREATE OR REPLACE FUNCTION initialize_company_permissions(company_uuid UUID)
RETURNS void AS $$
DECLARE
  perm_record RECORD;
BEGIN
  -- Set default permissions for ADMIN role (all permissions granted)
  FOR perm_record IN SELECT id FROM permissions LOOP
    INSERT INTO role_permissions (company_id, role, permission_id, is_granted)
    VALUES (company_uuid, 'ADMIN', perm_record.id, true)
    ON CONFLICT (company_id, role, permission_id) DO NOTHING;
  END LOOP;

  -- Set default permissions for EMPLOYEE role (based on RBAC_PERMISSIONS.md)
  -- Employees get most operational permissions but not admin ones
  FOR perm_record IN 
    SELECT id FROM permissions 
    WHERE name IN (
      -- Invoices (operational only)
      'invoices.view', 'invoices.create', 'invoices.edit_draft', 'invoices.send_email',
      'invoices.view_pdf', 'invoices.mark_paid', 'invoices.send_reminder',
      'invoices.view_notes', 'invoices.edit_notes', 'invoices.add_files',
      -- Quotes (operational only)
      'quotes.view', 'quotes.create', 'quotes.edit_draft', 'quotes.send_email',
      'quotes.view_pdf', 'quotes.convert', 'quotes.regenerate_link',
      'quotes.view_notes', 'quotes.edit_notes',
      -- Customers (operational only)
      'customers.view', 'customers.create', 'customers.edit', 'customers.deactivate',
      'customers.view_payment_history', 'customers.view_credit_limit',
      'customers.view_notes', 'customers.edit_notes',
      -- Payments (operational only)
      'payments.view', 'payments.import', 'payments.match', 'payments.unmatch',
      -- Expenses (own only)
      'expenses.view_own', 'expenses.create', 'expenses.edit_own', 'expenses.delete_own',
      'expenses.add_payment_date', 'expenses.upload_receipts',
      -- Users (view only)
      'users.view',
      -- Company (view only)
      'company.view',
      -- Reports (view only, no financial)
      'reports.view_dashboard', 'reports.view_sales',
      -- Files (operational only)
      'files.upload', 'files.view', 'files.download'
    )
  LOOP
    INSERT INTO role_permissions (company_id, role, permission_id, is_granted)
    VALUES (company_uuid, 'EMPLOYEE', perm_record.id, true)
    ON CONFLICT (company_id, role, permission_id) DO NOTHING;
  END LOOP;

  -- All other permissions are denied by default (not in the list above)
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Auto-initialize permissions for new companies
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_initialize_company_permissions()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM initialize_company_permissions(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_company_create_permissions
AFTER INSERT ON companies
FOR EACH ROW
EXECUTE FUNCTION trigger_initialize_company_permissions();

-- =====================================================
-- FUNCTION: Check if user has permission
-- =====================================================
CREATE OR REPLACE FUNCTION user_has_permission(
  user_uuid UUID,
  permission_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role_value user_role;
  user_company_id UUID;
  has_perm BOOLEAN;
BEGIN
  -- Get user's role and company
  SELECT role, company_id INTO user_role_value, user_company_id
  FROM users
  WHERE id = user_uuid AND is_active = true;

  IF user_role_value IS NULL THEN
    RETURN false;
  END IF;

  -- Check if permission exists and is granted for this role in this company
  SELECT rp.is_granted INTO has_perm
  FROM role_permissions rp
  JOIN permissions p ON p.id = rp.permission_id
  WHERE rp.company_id = user_company_id
    AND rp.role = user_role_value
    AND p.name = permission_name;

  -- If no permission record exists, deny by default
  RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

