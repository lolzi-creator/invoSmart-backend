import { User, Company, Customer, Invoice, InvoiceItem, Payment } from '../types'

// Shared mock databases - will be replaced with Supabase later
export const mockUsers: User[] = []
export const mockCompanies: Company[] = []
export const mockCustomers: Customer[] = []
export const mockInvoices: Invoice[] = []
export const mockInvoiceItems: InvoiceItem[] = []
export const mockPayments: Payment[] = []

// Helper function to generate unique IDs
export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Helper function to find user by email
export const findUserByEmail = (email: string): User | undefined => {
  return mockUsers.find(user => user.email.toLowerCase() === email.toLowerCase())
}

// Helper function to find company by user
export const findCompanyByUser = (userId: string): Company | undefined => {
  const user = mockUsers.find(u => u.id === userId)
  if (!user) return undefined
  return mockCompanies.find(c => c.id === user.companyId)
}
