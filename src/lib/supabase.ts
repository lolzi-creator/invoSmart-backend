import { createClient } from '@supabase/supabase-js'
import { config } from '../config'

// Create Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false // We handle our own JWT
    }
  }
)

// Create admin client for server-side operations
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Database helper functions
export const db = {
  // Companies
  companies: () => supabaseAdmin.from('companies'),
  
  // Users
  users: () => supabaseAdmin.from('users'),
  
  // Customers
  customers: () => supabaseAdmin.from('customers'),
  
  // Invoices
  invoices: () => supabaseAdmin.from('invoices'),
  invoiceItems: () => supabaseAdmin.from('invoice_items'),
  
  // Quotes
  quotes: () => supabaseAdmin.from('quotes'),
  quoteItems: () => supabaseAdmin.from('quote_items'),
  
  // Payments
  payments: () => supabaseAdmin.from('payments'),
  
  // VAT Rates
  vatRates: () => supabaseAdmin.from('vat_rates'),
  
  // Discount Codes
  discountCodes: () => supabaseAdmin.from('discount_codes'),
  
  // Email Templates
  emailTemplates: () => supabaseAdmin.from('email_templates'),
  
  // Expenses
  expenses: () => supabaseAdmin.from('expenses'),
  
  // Views
  invoiceOverview: () => supabaseAdmin.from('invoice_overview'),
  paymentStats: () => supabaseAdmin.from('payment_stats')
}

// Helper function to handle Supabase errors
export const handleSupabaseError = (error: any, operation: string) => {
  console.error(`Supabase ${operation} error:`, error)
  
  if (error.code === 'PGRST116') {
    throw new Error('Record not found')
  }
  
  if (error.code === '23505') {
    throw new Error('Duplicate entry')
  }
  
  if (error.code === '23503') {
    throw new Error('Referenced record not found')
  }
  
  if (error.code === '42501') {
    throw new Error('Insufficient permissions')
  }
  
  throw new Error(error.message || `${operation} failed`)
}

// Helper function to generate invoice number using database function
export const generateInvoiceNumber = async (companyId: string): Promise<string> => {
  const { data, error } = await supabaseAdmin.rpc('generate_invoice_number', {
    company_uuid: companyId
  })
  
  if (error) {
    handleSupabaseError(error, 'generate invoice number')
  }
  
  return data
}

// Helper function to generate QR reference using database function
export const generateQRReference = async (invoiceNumber: string, companyId: string): Promise<string> => {
  const { data, error } = await supabaseAdmin.rpc('generate_qr_reference', {
    invoice_num: invoiceNumber,
    company_uuid: companyId
  })
  
  if (error) {
    handleSupabaseError(error, 'generate QR reference')
  }
  
  return data
}

// Type definitions for database records
export interface DatabaseUser {
  id: string
  email: string
  password_hash: string
  name: string
  role: 'ADMIN' | 'EMPLOYEE'
  is_active: boolean
  company_id: string
  created_at: string
  updated_at: string
}

export interface DatabaseCompany {
  id: string
  name: string
  address: string
  zip: string
  city: string
  country: string
  phone?: string
  email: string
  website?: string
  uid?: string
  vat_number?: string
  iban?: string
  qr_iban?: string
  logo_url?: string
  default_payment_terms: number
  default_language: string
  created_at: string
  updated_at: string
}

export interface DatabaseCustomer {
  id: string
  company_id: string
  customer_number: string
  name: string
  company?: string
  email?: string
  address: string
  zip: string
  city: string
  country: string
  phone?: string
  uid?: string
  vat_number?: string
  payment_terms: number
  credit_limit?: number
  is_active: boolean
  notes?: string
  language: string
  created_at: string
  updated_at: string
}

export interface DatabaseInvoice {
  id: string
  number: string
  customer_id: string
  company_id: string
  date: string
  due_date: string
  status: 'DRAFT' | 'OPEN' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  subtotal: number
  vat_amount: number
  total: number
  paid_amount: number
  qr_reference: string
  reminder_level: number
  last_reminder_at?: string
  sent_at?: string
  email_sent_count: number
  discount_code?: string
  discount_amount: number
  internal_notes?: string
  created_at: string
  updated_at: string
}

export interface DatabaseInvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  discount: number
  vat_rate: number
  line_total: number
  vat_amount: number
  sort_order: number
  created_at: string
}

export interface DatabasePayment {
  id: string
  invoice_id?: string
  company_id: string
  amount: number
  value_date: string
  reference?: string
  description?: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'MANUAL'
  is_matched: boolean
  import_batch?: string
  raw_data?: any
  notes?: string
  created_at: string
  updated_at: string
}

export interface DatabaseEmailTemplate {
  id: string
  company_id: string
  name: string
  subject: string
  body: string
  type: 'INVOICE' | 'REMINDER_1' | 'REMINDER_2' | 'REMINDER_3'
  language: string
  is_active: boolean
  created_at: string
  updated_at: string
}
export interface ExpenseAttachment {
  id: string
  expense_id: string
  filename: string
  originalName: string
  filePath: string
  fileSize: number
  mimeType: string
  uploadedAt: string
}

export interface DatabaseExpense {
  id: string
  company_id: string
  user_id: string
  category: string
  description: string
  amount: number
  currency: string
  payment_date: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  attachments?: ExpenseAttachment[]
  created_at: string
  updated_at: string
}

export interface DatabaseQuote {
  id: string
  number: string
  customer_id: string
  company_id: string
  date: string
  expiry_date: string
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED' | 'CONVERTED'
  subtotal: number
  vat_amount: number
  total: number
  discount_code?: string
  discount_amount: number
  internal_notes?: string
  acceptance_token?: string
  acceptance_link?: string
  accepted_at?: string
  accepted_by_email?: string
  sent_at?: string
  email_sent_count: number
  converted_to_invoice_id?: string
  converted_at?: string
  created_at: string
  updated_at: string
}

export interface DatabaseQuoteItem {
  id: string
  quote_id: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  discount: number
  vat_rate: number
  line_total: number
  vat_amount: number
  sort_order: number
  created_at: string
}

