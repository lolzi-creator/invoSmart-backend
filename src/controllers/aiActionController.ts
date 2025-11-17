import { Response } from 'express'
import { AuthenticatedRequest } from '../types'
import { db, supabase } from '../lib/supabase'
import { asyncHandler } from '../middleware/errorHandler'

/**
 * Execute AI actions automatically
 */
export const executeAction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { action, data } = req.body
  const companyId = req.user?.companyId
  const userId = req.user?.id

  if (!companyId || !userId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  if (!action) {
    res.status(400).json({
      success: false,
      error: 'Action is required'
    })
    return
  }

  try {
    let result: any

    switch (action) {
      case 'CREATE_INVOICE':
        result = await createInvoiceAction(companyId, userId, data)
        break

      case 'CREATE_EXPENSE':
        result = await createExpenseAction(companyId, userId, data)
        break

      case 'SHOW_OVERDUE':
        result = await getOverdueInvoices(companyId)
        break

      case 'VIEW_STATS':
        result = await getBusinessStats(companyId)
        break

      case 'QUERY_CUSTOMERS':
        result = await queryCustomers(companyId, data)
        break

      case 'CREATE_CUSTOMER':
        result = await createCustomerAction(companyId, data)
        break

      case 'CREATE_QUOTE':
        result = await createQuoteAction(companyId, userId, data)
        break

      case 'IMPORT_PAYMENT':
        result = await importPaymentAction(companyId, data)
        break

      default:
        res.status(400).json({
          success: false,
          error: `Unknown action: ${action}`
        })
        return
    }

    res.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error('Execute action error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute action'
    })
  }
})

/**
 * Create invoice automatically
 */
async function createInvoiceAction(companyId: string, userId: string, data: any) {
  const { customerName, amount, description, items } = data

  // Find or create customer
  let customer
  if (customerName) {
    const { data: existingCustomer } = await db.customers()
      .select('*')
      .eq('company_id', companyId)
      .ilike('name', `%${customerName}%`)
      .single()

    if (existingCustomer) {
      customer = existingCustomer
    } else {
      // Generate customer number
      const { data: latestCustomer } = await db.customers()
        .select('customer_number')
        .eq('company_id', companyId)
        .order('customer_number', { ascending: false })
        .limit(1)
        .single()

      const nextNumber = latestCustomer 
        ? (parseInt(latestCustomer.customer_number) + 1).toString().padStart(6, '0')
        : '000001'

      // Create new customer with basic info
      const { data: newCustomer, error: customerError } = await db.customers()
        .insert({
          company_id: companyId,
          customer_number: nextNumber,
          name: customerName,
          address: 'To be updated',
          zip: '0000',
          city: 'To be updated',
          country: 'CH',
          payment_terms: 30,
          is_active: true,
          language: 'de'
        })
        .select()
        .single()

      if (customerError) throw customerError
      customer = newCustomer
    }
  }

  if (!customer) {
    throw new Error('Customer information is required')
  }

  // Generate invoice number
  const { data: latestInvoice } = await db.invoices()
    .select('number')
    .eq('company_id', companyId)
    .order('number', { ascending: false })
    .limit(1)
    .single()

  const nextNumber = latestInvoice ? parseInt(latestInvoice.number) + 1 : 1000

  // Prepare invoice items
  const invoiceItems = items && items.length > 0 ? items : [
    {
      description: description || 'Services',
      quantity: 1,
      unit_price: amount || 0,
      vat_rate: 8.1,
      total: amount || 0
    }
  ]

  const subtotal = invoiceItems.reduce((sum: number, item: any) => sum + (item.total || 0), 0)
  const vatAmount = invoiceItems.reduce((sum: number, item: any) => {
    const itemVat = (item.total || 0) * (item.vat_rate || 0) / 100
    return sum + itemVat
  }, 0)
  const total = subtotal + vatAmount

  // Create invoice
  const { data: invoice, error: invoiceError } = await db.invoices()
    .insert({
      company_id: companyId,
      customer_id: customer.id,
      number: nextNumber.toString(),
      status: 'DRAFT',
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + (customer.payment_terms || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      service_date: new Date().toISOString().split('T')[0],
      subtotal: Math.round(subtotal * 100),
      vat_amount: Math.round(vatAmount * 100),
      total: Math.round(total * 100),
      qr_reference: '', // Will be generated by trigger or function
      internal_notes: `Created by AI Assistant for ${customerName}`
    })
    .select()
    .single()

  if (invoiceError) throw invoiceError

  // Create invoice items in separate table
  const itemsToInsert = invoiceItems.map((item: any, index: number) => ({
    invoice_id: invoice.id,
    description: item.description || 'Item',
    quantity: (item.quantity || 1) * 1000, // * 1000 for 3 decimals
    unit: 'Stück',
    unit_price: Math.round((item.unit_price || item.total || 0) * 100),
    discount: 0,
    vat_rate: Math.round((item.vat_rate || 8.1) * 100),
    line_total: Math.round((item.total || 0) * 100),
    vat_amount: Math.round((item.total || 0) * (item.vat_rate || 8.1) / 100 * 100),
    sort_order: index + 1
  }))

  await supabase.from('invoice_items').insert(itemsToInsert)

  return {
    type: 'INVOICE_CREATED',
    invoice,
    message: `Invoice #${invoice.number} created for ${customer.name} - CHF ${(total).toFixed(2)}`,
    invoiceId: invoice.id
  }
}

/**
 * Create expense automatically
 */
async function createExpenseAction(companyId: string, userId: string, data: any) {
  const { amount, category, description, date } = data

  if (!amount) {
    throw new Error('Amount is required')
  }

  // Parse date if provided (handle DD.MM.YYYY format)
  let expenseDate = new Date().toISOString().split('T')[0]
  if (date) {
    // Check if date is in DD.MM.YYYY format
    const dateMatch = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    if (dateMatch) {
      const [, day, month, year] = dateMatch
      expenseDate = `${year}-${month}-${day}`
    } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Already in ISO format
      expenseDate = date
    }
  }

  // Calculate VAT amount
  const vatRate = 8.1
  const amountInRappen = Math.round(amount * 100)
  const vatAmount = Math.round(amountInRappen * (vatRate / 100))

  // Use the exact same structure as createExpense in expenseController
  const expenseData = {
    company_id: companyId,
    user_id: userId,
    title: description || 'AI Created Expense',
    description: description || 'Expense',
    amount: amountInRappen,
    currency: 'CHF',
    category: category || 'General',
    subcategory: null,
    payment_method: null,
    expense_date: expenseDate,
    payment_date: null,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    is_tax_deductible: true,
    vendor_name: null,
    status: 'PENDING',
    is_recurring: false,
    recurring_period: null,
    budget_category: null,
    notes: 'Created by AI Assistant',
    attachments: []
  }

  const { data: expense, error: expenseError } = await db.expenses()
    .insert(expenseData)
    .select()
    .single()

  if (expenseError) throw expenseError

  return {
    type: 'EXPENSE_CREATED',
    expense,
    message: `Expense created: ${category || 'General'} - CHF ${amount.toFixed(2)}`,
    expenseId: expense.id
  }
}

/**
 * Get overdue invoices
 */
async function getOverdueInvoices(companyId: string) {
  const { data: invoices, error } = await db.invoices()
    .select('*, customers(name)')
    .eq('company_id', companyId)
    .eq('status', 'OVERDUE')
    .order('due_date', { ascending: true })
    .limit(10)

  if (error) throw error

  return {
    type: 'OVERDUE_INVOICES',
    invoices,
    count: invoices?.length || 0,
    message: `Found ${invoices?.length || 0} overdue invoices`
  }
}

/**
 * Get business statistics
 */
async function getBusinessStats(companyId: string) {
  // Get paid invoices total
  const { data: paidInvoices } = await db.invoices()
    .select('total')
    .eq('company_id', companyId)
    .eq('status', 'PAID')

  const totalRevenue = paidInvoices?.reduce((sum, inv) => sum + inv.total, 0) || 0

  // Get outstanding invoices
  const { data: outstandingInvoices } = await db.invoices()
    .select('total')
    .eq('company_id', companyId)
    .in('status', ['OPEN', 'OVERDUE'])

  const totalOutstanding = outstandingInvoices?.reduce((sum, inv) => sum + inv.total, 0) || 0

  // Get counts
  const { count: invoiceCount } = await db.invoices()
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const { count: customerCount } = await db.customers()
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const { count: overdueCount } = await db.invoices()
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'OVERDUE')

  return {
    type: 'BUSINESS_STATS',
    stats: {
      totalRevenue: totalRevenue / 100,
      totalOutstanding: totalOutstanding / 100,
      invoiceCount: invoiceCount || 0,
      customerCount: customerCount || 0,
      overdueCount: overdueCount || 0
    },
    message: `Revenue: CHF ${(totalRevenue / 100).toFixed(2)} | Outstanding: CHF ${(totalOutstanding / 100).toFixed(2)}`
  }
}

/**
 * Query customers
 */
async function queryCustomers(companyId: string, data: any) {
  const { search } = data

  let query = db.customers()
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)

  // Parse search query
  if (search) {
    const searchLower = search.toLowerCase()
    
    // Check for "starts with X" pattern
    const startsWithMatch = searchLower.match(/starts? with ([a-z])/i)
    if (startsWithMatch) {
      const letter = startsWithMatch[1].toUpperCase()
      query = query.ilike('name', `${letter}%`)
    }
    // Check for "contains X" pattern
    else if (searchLower.includes('contains') || searchLower.includes('with')) {
      const word = searchLower.split(/contains|with/)[1]?.trim()
      if (word) {
        query = query.ilike('name', `%${word}%`)
      }
    }
    // Check for city
    else if (searchLower.includes('in ') || searchLower.includes('from ')) {
      const city = searchLower.split(/in |from /)[1]?.trim()
      if (city) {
        query = query.ilike('city', `%${city}%`)
      }
    }
    // Default: search by name
    else {
      query = query.ilike('name', `%${search}%`)
    }
  }

  query = query.order('name', { ascending: true }).limit(20)

  const { data: customers, error } = await query

  if (error) throw error

  return {
    type: 'CUSTOMERS_LIST',
    customers,
    count: customers?.length || 0,
    message: `Found ${customers?.length || 0} customer(s)`
  }
}

/**
 * Create customer automatically
 */
async function createCustomerAction(companyId: string, data: any) {
  const { name, email, phone, address, city, zip, country = 'CH' } = data

  if (!name) {
    throw new Error('Customer name is required')
  }

  // Generate unique customer number
  const { data: latestCustomer } = await db.customers()
    .select('customer_number')
    .eq('company_id', companyId)
    .order('customer_number', { ascending: false })
    .limit(1)
    .single()

  const nextNumber = latestCustomer 
    ? (parseInt(latestCustomer.customer_number) + 1).toString().padStart(6, '0')
    : '000001'

  const { data: customer, error: customerError } = await db.customers()
    .insert({
      company_id: companyId,
      customer_number: nextNumber,
      name,
      email: email || null,
      phone: phone || null,
      address: address || 'To be updated',
      city: city || 'To be updated',
      zip: zip || '0000',
      country,
      payment_terms: 30,
      is_active: true,
      language: 'de'
    })
    .select()
    .single()

  if (customerError) throw customerError

  return {
    type: 'CUSTOMER_CREATED',
    customer,
    message: `Customer "${name}" created successfully (Customer #${nextNumber})`,
    customerId: customer.id
  }
}

/**
 * Create quote automatically
 */
async function createQuoteAction(companyId: string, userId: string, data: any) {
  const { customerName, amount, description, items } = data

  // Find or create customer
  let customer
  if (customerName) {
    const { data: existingCustomer } = await db.customers()
      .select('*')
      .eq('company_id', companyId)
      .ilike('name', `%${customerName}%`)
      .single()

    if (existingCustomer) {
      customer = existingCustomer
    } else {
      // Generate customer number
      const { data: latestCustomer } = await db.customers()
        .select('customer_number')
        .eq('company_id', companyId)
        .order('customer_number', { ascending: false })
        .limit(1)
        .single()

      const nextCustNumber = latestCustomer 
        ? (parseInt(latestCustomer.customer_number) + 1).toString().padStart(6, '0')
        : '000001'

      const { data: newCustomer } = await db.customers()
        .insert({
          company_id: companyId,
          customer_number: nextCustNumber,
          name: customerName,
          address: 'To be updated',
          zip: '0000',
          city: 'To be updated',
          country: 'CH',
          payment_terms: 30,
          is_active: true,
          language: 'de'
        })
        .select()
        .single()
      customer = newCustomer
    }
  }

  if (!customer) {
    throw new Error('Customer information is required')
  }

  // Generate quote number
  const { data: latestQuote } = await db.quotes()
    .select('number')
    .eq('company_id', companyId)
    .order('number', { ascending: false })
    .limit(1)
    .single()

  const nextNumber = latestQuote ? parseInt(latestQuote.number) + 1 : 2000

  // Prepare quote items
  const quoteItems = items && items.length > 0 ? items : [
    {
      description: description || 'Services',
      quantity: 1,
      unit_price: amount || 0,
      vat_rate: 8.1,
      total: amount || 0
    }
  ]

  const subtotal = quoteItems.reduce((sum: number, item: any) => sum + (item.total || 0), 0)
  const vatAmount = quoteItems.reduce((sum: number, item: any) => {
    const itemVat = (item.total || 0) * (item.vat_rate || 0) / 100
    return sum + itemVat
  }, 0)
  const total = subtotal + vatAmount

  // Create quote
  const { data: quote, error: quoteError} = await db.quotes()
    .insert({
      company_id: companyId,
      customer_id: customer.id,
      number: nextNumber.toString(),
      status: 'DRAFT',
      date: new Date().toISOString().split('T')[0],
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      subtotal: Math.round(subtotal * 100),
      vat_amount: Math.round(vatAmount * 100),
      total: Math.round(total * 100),
      internal_notes: `Created by AI Assistant for ${customerName}`
    })
    .select()
    .single()

  if (quoteError) throw quoteError

  // Create quote items in separate table
  const quoteItemsToInsert = quoteItems.map((item: any, index: number) => ({
    quote_id: quote.id,
    description: item.description || 'Item',
    quantity: (item.quantity || 1) * 1000, // * 1000 for 3 decimals
    unit: 'Stück',
    unit_price: Math.round((item.unit_price || item.total || 0) * 100),
    discount: 0,
    vat_rate: Math.round((item.vat_rate || 8.1) * 100),
    line_total: Math.round((item.total || 0) * 100),
    vat_amount: Math.round((item.total || 0) * (item.vat_rate || 8.1) / 100 * 100),
    sort_order: index + 1
  }))

  await supabase.from('quote_items').insert(quoteItemsToInsert)

  return {
    type: 'QUOTE_CREATED',
    quote,
    message: `Quote #${quote.number} created for ${customer.name} - CHF ${(total).toFixed(2)}`,
    quoteId: quote.id
  }
}

/**
 * Import payment and auto-match
 */
async function importPaymentAction(companyId: string, data: any) {
  const { amount, reference, date, debtorName } = data

  if (!amount) {
    throw new Error('Payment amount is required')
  }

  // Parse date
  let paymentDate = new Date().toISOString().split('T')[0]
  if (date) {
    const dateMatch = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    if (dateMatch) {
      const [, day, month, year] = dateMatch
      paymentDate = `${year}-${month}-${day}`
    } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      paymentDate = date
    }
  }

  // Try to find matching invoice
  let matchedInvoice = null
  if (reference) {
    // Try to match by reference number
    const { data: invoice } = await db.invoices()
      .select('*')
      .eq('company_id', companyId)
      .or(`number.eq.${reference},payment_reference.eq.${reference}`)
      .single()
    
    if (invoice) {
      matchedInvoice = invoice
    }
  }

  // If no match by reference, try by debtor name and amount
  if (!matchedInvoice && debtorName) {
    const { data: customer } = await db.customers()
      .select('id')
      .eq('company_id', companyId)
      .ilike('name', `%${debtorName}%`)
      .single()

    if (customer) {
      const { data: invoice } = await db.invoices()
        .select('*')
        .eq('company_id', companyId)
        .eq('customer_id', customer.id)
        .eq('total', Math.round(amount * 100))
        .in('status', ['OPEN', 'OVERDUE'])
        .single()

      if (invoice) {
        matchedInvoice = invoice
      }
    }
  }

  // Create payment record (use actual schema fields)
  const { data: payment, error: paymentError } = await db.payments()
    .insert({
      company_id: companyId,
      invoice_id: matchedInvoice?.id || null,
      amount: Math.round(amount * 100),
      value_date: paymentDate,
      reference: reference || null,
      description: debtorName ? `Payment from ${debtorName}` : 'Imported by AI Assistant',
      is_matched: !!matchedInvoice,
      confidence: matchedInvoice ? 'HIGH' : 'LOW'
    })
    .select()
    .single()

  if (paymentError) throw paymentError

  // If matched, update invoice status
  if (matchedInvoice) {
    await db.invoices()
      .update({ status: 'PAID', paid_at: paymentDate })
      .eq('id', matchedInvoice.id)
  }

  return {
    type: 'PAYMENT_IMPORTED',
    payment,
    matched: !!matchedInvoice,
    invoice: matchedInvoice,
    message: matchedInvoice 
      ? `Payment CHF ${amount.toFixed(2)} imported and matched to Invoice #${matchedInvoice.number}`
      : `Payment CHF ${amount.toFixed(2)} imported (no matching invoice found)`,
    paymentId: payment.id
  }
}

