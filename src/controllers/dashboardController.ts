import { Response } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { AuthenticatedRequest } from '../types'
import { db, supabaseAdmin } from '../lib/supabase'

/**
 * @desc    Get comprehensive dashboard statistics
 * @route   GET /api/v1/dashboard/stats
 * @access  Private
 */
export const getDashboardStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear
    
    // Start and end of this month
    const startOfThisMonth = new Date(thisYear, thisMonth, 1)
    const endOfThisMonth = new Date(thisYear, thisMonth + 1, 0, 23, 59, 59, 999)
    
    // Start and end of last month
    const startOfLastMonth = new Date(lastMonthYear, lastMonth, 1)
    const endOfLastMonth = new Date(lastMonthYear, lastMonth + 1, 0, 23, 59, 59, 999)

    // Fetch all data in parallel
    const [
      invoicesResult,
      customersResult,
      paymentsResult,
      expensesResult,
      quotesResult
    ] = await Promise.all([
      db.invoices().select('id, number, status, total, paid_amount, date, due_date').eq('company_id', companyId),
      db.customers().select('id, created_at, is_active').eq('company_id', companyId),
      db.payments().select('amount, value_date').eq('company_id', companyId),
      db.expenses().select('amount, expense_date, status').eq('company_id', companyId),
      db.quotes().select('status, total, date').eq('company_id', companyId)
    ])

    const invoices = invoicesResult.data || []
    const customers = customersResult.data || []
    const payments = paymentsResult.data || []
    const expenses = expensesResult.data || []
    const quotes = quotesResult.data || []

    // Invoice Statistics
    const totalInvoices = invoices.length
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0)
    const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0)
    const totalOutstanding = totalRevenue - totalPaid
    
    const thisMonthInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.date)
      return invDate >= startOfThisMonth && invDate <= endOfThisMonth
    })
    const thisMonthRevenue = thisMonthInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0)
    
    const lastMonthInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.date)
      return invDate >= startOfLastMonth && invDate <= endOfLastMonth
    })
    const lastMonthRevenue = lastMonthInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0)
    
    const revenueChange = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
      : '0.0'

    // Outstanding invoices (OPEN or PARTIAL_PAID)
    const outstandingInvoices = invoices.filter(inv => 
      inv.status === 'OPEN' || inv.status === 'PARTIAL_PAID'
    ).reduce((sum, inv) => sum + (inv.total - (inv.paid_amount || 0)), 0)

    // Overdue invoices
    const overdueCount = invoices.filter(inv => {
      if (inv.status === 'PAID') return false
      const dueDate = new Date(inv.due_date)
      return dueDate < now
    }).length

    // Customer Statistics
    const totalCustomers = customers.length
    const activeCustomers = customers.filter(c => c.is_active).length
    
    const thisMonthCustomers = customers.filter(c => {
      const custDate = new Date(c.created_at)
      return custDate >= startOfThisMonth && custDate <= endOfThisMonth
    }).length
    
    const lastMonthCustomers = customers.filter(c => {
      const custDate = new Date(c.created_at)
      return custDate >= startOfLastMonth && custDate <= endOfLastMonth
    }).length
    
    const customersChange = lastMonthCustomers > 0
      ? ((thisMonthCustomers - lastMonthCustomers) / lastMonthCustomers * 100).toFixed(1)
      : '0.0'

    // Payment Statistics
    const totalPayments = payments.length
    const totalPaymentsAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0)

    // Expense Statistics
    const totalExpenses = expenses.length
    const totalExpensesAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    
    const thisMonthExpenses = expenses.filter(e => {
      const expDate = new Date(e.expense_date)
      return expDate >= startOfThisMonth && expDate <= endOfThisMonth
    })
    const thisMonthExpensesAmount = thisMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

    // Quote Statistics
    const totalQuotes = quotes.length
    const totalQuotesValue = quotes.reduce((sum, q) => sum + (q.total || 0), 0)
    
    const thisMonthQuotes = quotes.filter(q => {
      const quoteDate = new Date(q.date)
      return quoteDate >= startOfThisMonth && quoteDate <= endOfThisMonth
    }).length
    
    const lastMonthQuotes = quotes.filter(q => {
      const quoteDate = new Date(q.date)
      return quoteDate >= startOfLastMonth && quoteDate <= endOfLastMonth
    }).length
    
    const quotesChange = lastMonthQuotes > 0
      ? ((thisMonthQuotes - lastMonthQuotes) / lastMonthQuotes * 100).toFixed(1)
      : '0.0'

    // Recent activity (last 20 audit log entries)
    const { data: recentActivityData } = await supabaseAdmin
      .from('audit_logs')
      .select('id, action, resource_type, resource_id, details, user_name, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50)

    const recentActivity = (recentActivityData || []).map((log: any) => ({
      id: log.id,
      type: log.resource_type.toLowerCase(),
      action: log.action,
      resourceId: log.resource_id,
      details: log.details || {},
      userName: log.user_name,
      timestamp: log.created_at
    }))

    // Recent invoices (last 5) for backward compatibility
    const { data: recentInvoicesData } = await db.invoices()
      .select('id, number, total, status, date')
      .eq('company_id', companyId)
      .order('date', { ascending: false })
      .limit(5)

    const recentInvoices = (recentInvoicesData || []).map((inv: any) => ({
      id: inv.id,
      number: inv.number || '',
      total: inv.total || 0,
      status: inv.status,
      date: inv.date
    }))

    // Net profit (Revenue - Expenses for this month)
    const netProfit = thisMonthRevenue - thisMonthExpensesAmount

    // Format amounts (convert from Rappen to CHF)
    const formatAmount = (amount: number) => amount / 100

    const stats = {
      // Revenue
      totalRevenue: formatAmount(totalRevenue),
      thisMonthRevenue: formatAmount(thisMonthRevenue),
      revenueChange: parseFloat(revenueChange),
      
      // Invoices
      totalInvoices,
      outstandingInvoices: formatAmount(totalOutstanding),
      overdueCount,
      
      // Customers
      totalCustomers,
      activeCustomers,
      newCustomers: thisMonthCustomers,
      customersChange: parseFloat(customersChange),
      
      // Payments
      totalPayments,
      totalPaymentsAmount: formatAmount(totalPaymentsAmount),
      
      // Expenses
      totalExpenses,
      totalExpensesAmount: formatAmount(totalExpensesAmount),
      thisMonthExpenses: formatAmount(thisMonthExpensesAmount),
      
      // Quotes
      totalQuotes,
      totalQuotesValue: formatAmount(totalQuotesValue),
      quotesSent: thisMonthQuotes,
      quotesChange: parseFloat(quotesChange),
      
      // Financial
      netProfit: formatAmount(netProfit),
      
      // Recent activity
      recentActivity: recentActivity,
      recentInvoices: recentInvoices.map(inv => ({
        ...inv,
        total: formatAmount(inv.total)
      }))
    }

    res.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    })
  }
})

