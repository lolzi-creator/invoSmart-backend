import { Response } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { AuthenticatedRequest } from '../types'
import { db, handleSupabaseError } from '../lib/supabase'
const htmlPdf = require('html-pdf-node')

// Helper to generate PDF export HTML
const generateExportPDFTemplate = (data: any, type: 'invoices' | 'quotes' | 'payments' | 'customers') => {
  const today = new Date().toLocaleDateString('de-CH')
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${type.charAt(0).toUpperCase() + type.slice(1)} Export</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 10pt;
      color: #1a1a1a;
      padding: 20mm;
    }
    .header {
      margin-bottom: 10mm;
      border-bottom: 2pt solid #ff6b35;
      padding-bottom: 5mm;
    }
    .header h1 {
      font-size: 24pt;
      color: #ff6b35;
      font-weight: 700;
      margin-bottom: 2mm;
    }
    .header .date {
      color: #666;
      font-size: 9pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 5mm;
    }
    thead {
      background: #f8f9fa;
      border-bottom: 1.5pt solid #333;
    }
    th {
      padding: 3mm 2mm;
      text-align: left;
      font-weight: 600;
      font-size: 9pt;
      text-transform: uppercase;
      color: #333;
    }
    td {
      padding: 2.5mm 2mm;
      border-bottom: 0.5pt solid #e8e8e8;
      font-size: 9.5pt;
    }
    .footer {
      margin-top: 10mm;
      padding-top: 5mm;
      border-top: 1pt solid #e0e0e0;
      text-align: center;
      color: #666;
      font-size: 8pt;
    }
    .summary {
      margin-top: 5mm;
      padding: 3mm;
      background: #fff8f0;
      border-left: 3pt solid #ff6b35;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${type.charAt(0).toUpperCase() + type.slice(1)} Export</h1>
    <div class="date">Generated on: ${today}</div>
  </div>
  ${data}
  <div class="footer">
    <p>This is an automated export from invoSmart</p>
    <p>Generated on ${today}</p>
  </div>
</body>
</html>
  `
}

/**
 * @desc    Export invoices as CSV
 * @route   GET /api/v1/export/invoices/csv
 * @access  Private
 */
export const exportInvoicesCSV = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('Export invoices request - User:', req.user)
  
  const companyId = req.user?.companyId

  if (!companyId) {
    console.error('No companyId found. User object:', req.user)
    res.status(401).json({
      success: false,
      error: 'Authentication required - No company ID'
    })
    return
  }

  console.log('Exporting invoices for company:', companyId)

  try {
    // Get filter parameters
    const { status, customerId, startDate, endDate } = req.query

    // Build query
    let query = db.invoices()
      .select(`
        *,
        customers (
          id, name, company, email
        )
      `)
      .eq('company_id', companyId)
      .order('date', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (customerId) {
      query = query.eq('customer_id', customerId)
    }
    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data: invoices, error } = await query

    if (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to fetch invoices'
      })
      return
    }

    // Generate CSV
    const headers = [
      'Invoice Number',
      'Date',
      'Due Date',
      'Service Date',
      'Customer Name',
      'Customer Company',
      'Customer Email',
      'Status',
      'Subtotal (CHF)',
      'Discount (CHF)',
      'VAT (CHF)',
      'Total (CHF)',
      'Paid Amount (CHF)',
      'Outstanding (CHF)',
      'Payment Reference',
      'Notes'
    ]

    const rows = invoices?.map(invoice => [
      invoice.number,
      invoice.date,
      invoice.due_date,
      invoice.service_date || '',
      invoice.customers?.name || '',
      invoice.customers?.company || '',
      invoice.customers?.email || '',
      invoice.status,
      (invoice.subtotal / 100).toFixed(2),
      (invoice.discount_amount / 100).toFixed(2),
      (invoice.vat_amount / 100).toFixed(2),
      (invoice.total / 100).toFixed(2),
      ((invoice.paid_amount || 0) / 100).toFixed(2),
      ((invoice.total - (invoice.paid_amount || 0)) / 100).toFixed(2),
      invoice.qr_reference || '',
      invoice.notes || ''
    ]) || []

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="invoices_export_${new Date().toISOString().split('T')[0]}.csv"`)
    res.send(csvContent)

  } catch (error) {
    handleSupabaseError(error, 'export invoices')
  }
})

/**
 * @desc    Export quotes as CSV
 * @route   GET /api/v1/export/quotes/csv
 * @access  Private
 */
export const exportQuotesCSV = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    const { status, customerId, startDate, endDate } = req.query

    let query = db.quotes()
      .select(`
        *,
        customers (
          id, name, company, email
        )
      `)
      .eq('company_id', companyId)
      .order('date', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }
    if (customerId) {
      query = query.eq('customer_id', customerId)
    }
    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data: quotes, error } = await query

    if (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to fetch quotes'
      })
      return
    }

    const headers = [
      'Quote Number',
      'Date',
      'Expiry Date',
      'Customer Name',
      'Customer Company',
      'Customer Email',
      'Status',
      'Subtotal (CHF)',
      'VAT (CHF)',
      'Total (CHF)',
      'Notes'
    ]

    const rows = quotes?.map(quote => [
      quote.number,
      quote.date,
      quote.expiry_date,
      quote.customers?.name || '',
      quote.customers?.company || '',
      quote.customers?.email || '',
      quote.status,
      (quote.subtotal / 100).toFixed(2),
      (quote.vat_amount / 100).toFixed(2),
      (quote.total / 100).toFixed(2),
      quote.notes || ''
    ]) || []

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="quotes_export_${new Date().toISOString().split('T')[0]}.csv"`)
    res.send(csvContent)

  } catch (error) {
    handleSupabaseError(error, 'export quotes')
  }
})

/**
 * @desc    Export payments as CSV
 * @route   GET /api/v1/export/payments/csv
 * @access  Private
 */
export const exportPaymentsCSV = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    const { isMatched, startDate, endDate } = req.query

    let query = db.payments()
      .select(`
        *,
        invoices (
          number, total
        )
      `)
      .eq('company_id', companyId)
      .order('value_date', { ascending: false })

    if (isMatched === 'true') {
      query = query.eq('is_matched', true)
    } else if (isMatched === 'false') {
      query = query.eq('is_matched', false)
    }

    if (startDate) {
      query = query.gte('value_date', startDate)
    }
    if (endDate) {
      query = query.lte('value_date', endDate)
    }

    const { data: payments, error } = await query

    if (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to fetch payments'
      })
      return
    }

    const headers = [
      'Date',
      'Value Date',
      'Amount (CHF)',
      'Currency',
      'Reference',
      'Description',
      'Debtor Name',
      'Debtor Account',
      'Creditor Name',
      'Creditor Account',
      'Matched',
      'Confidence',
      'Invoice Number',
      'Import Batch'
    ]

    const rows = payments?.map(payment => [
      payment.payment_date,
      payment.value_date,
      (payment.amount / 100).toFixed(2),
      payment.currency,
      payment.reference || '',
      payment.description || '',
      payment.debtor_name || '',
      payment.debtor_account || '',
      payment.creditor_name || '',
      payment.creditor_account || '',
      payment.is_matched ? 'Yes' : 'No',
      payment.confidence || '',
      payment.invoices?.number || '',
      payment.import_batch || ''
    ]) || []

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="payments_export_${new Date().toISOString().split('T')[0]}.csv"`)
    res.send(csvContent)

  } catch (error) {
    handleSupabaseError(error, 'export payments')
  }
})

/**
 * @desc    Export customers as CSV
 * @route   GET /api/v1/export/customers/csv
 * @access  Private
 */
export const exportCustomersCSV = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    const { isActive } = req.query

    let query = db.customers()
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true })

    if (isActive === 'true') {
      query = query.eq('is_active', true)
    } else if (isActive === 'false') {
      query = query.eq('is_active', false)
    }

    const { data: customers, error } = await query

    if (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to fetch customers'
      })
      return
    }

    const headers = [
      'Customer Number',
      'Name',
      'Company',
      'Email',
      'Phone',
      'Address',
      'ZIP',
      'City',
      'Country',
      'VAT Number',
      'Payment Terms (days)',
      'Credit Limit (CHF)',
      'Language',
      'Active',
      'Notes',
      'Created At'
    ]

    const rows = customers?.map(customer => [
      customer.customer_number,
      customer.name,
      customer.company || '',
      customer.email || '',
      customer.phone || '',
      customer.address,
      customer.zip,
      customer.city,
      customer.country,
      customer.vat_number || '',
      customer.payment_terms,
      customer.credit_limit ? (customer.credit_limit / 100).toFixed(2) : '',
      customer.language || 'de',
      customer.is_active ? 'Yes' : 'No',
      customer.notes || '',
      customer.created_at
    ]) || []

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="customers_export_${new Date().toISOString().split('T')[0]}.csv"`)
    res.send(csvContent)

  } catch (error) {
    handleSupabaseError(error, 'export customers')
  }
})

/**
 * @desc    Export invoices as PDF
 * @route   GET /api/v1/export/invoices/pdf
 * @access  Private
 */
export const exportInvoicesPDF = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required - No company ID'
    })
    return
  }

  try {
    const { status, customerId, startDate, endDate } = req.query

    let query = db.invoices()
      .select(`
        *,
        customers (
          id, name, company, email
        )
      `)
      .eq('company_id', companyId)
      .order('date', { ascending: false })

    if (status) query = query.eq('status', status)
    if (customerId) query = query.eq('customer_id', customerId)
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    const { data: invoices, error } = await query

    if (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to fetch invoices'
      })
      return
    }

    // Calculate totals
    const totalAmount = invoices?.reduce((sum, inv) => sum + inv.total, 0) || 0
    const paidAmount = invoices?.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) || 0
    const outstandingAmount = totalAmount - paidAmount

    const tableRows = invoices?.map(invoice => `
      <tr>
        <td>${invoice.number}</td>
        <td>${new Date(invoice.date).toLocaleDateString('de-CH')}</td>
        <td>${invoice.customers?.name || ''}<br/><span style="color: #666; font-size: 8pt;">${invoice.customers?.company || ''}</span></td>
        <td style="text-align: center;">
          <span style="display: inline-block; padding: 1mm 3mm; background: ${
            invoice.status === 'PAID' ? '#d4edda' : 
            invoice.status === 'OPEN' ? '#fff3cd' : 
            invoice.status === 'OVERDUE' ? '#f8d7da' : '#e2e3e5'
          }; border-radius: 3mm; font-size: 8pt; font-weight: 600;">
            ${invoice.status}
          </span>
        </td>
        <td style="text-align: right;">CHF ${(invoice.total / 100).toFixed(2)}</td>
        <td style="text-align: right;">CHF ${((invoice.paid_amount || 0) / 100).toFixed(2)}</td>
        <td style="text-align: right; font-weight: ${invoice.total > (invoice.paid_amount || 0) ? '700' : '400'}; color: ${invoice.total > (invoice.paid_amount || 0) ? '#dc3545' : '#28a745'};">
          CHF ${((invoice.total - (invoice.paid_amount || 0)) / 100).toFixed(2)}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align: center; color: #999;">No invoices found</td></tr>'

    const summaryHTML = `
      <div class="summary">
        Total: ${invoices?.length || 0} invoices | 
        Total Amount: CHF ${(totalAmount / 100).toFixed(2)} | 
        Paid: CHF ${(paidAmount / 100).toFixed(2)} | 
        Outstanding: CHF ${(outstandingAmount / 100).toFixed(2)}
      </div>
    `

    const tableHTML = `
      ${summaryHTML}
      <table>
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Date</th>
            <th>Customer</th>
            <th style="text-align: center;">Status</th>
            <th style="text-align: right;">Total</th>
            <th style="text-align: right;">Paid</th>
            <th style="text-align: right;">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `

    const html = generateExportPDFTemplate(tableHTML, 'invoices')

    const options = {
      format: 'A4',
      landscape: true,
      preferCSSPageSize: true
    }

    const file = { content: html }
    const pdfBuffer = await htmlPdf.generatePdf(file, options)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="invoices_export_${new Date().toISOString().split('T')[0]}.pdf"`)
    res.send(pdfBuffer)

  } catch (error) {
    console.error('PDF generation error:', error)
    handleSupabaseError(error, 'export invoices PDF')
  }
})

/**
 * @desc    Export quotes as PDF
 * @route   GET /api/v1/export/quotes/pdf
 * @access  Private
 */
export const exportQuotesPDF = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required - No company ID'
    })
    return
  }

  try {
    const { status, customerId, startDate, endDate } = req.query

    let query = db.quotes()
      .select(`
        *,
        customers (
          id, name, company, email
        )
      `)
      .eq('company_id', companyId)
      .order('date', { ascending: false })

    if (status) query = query.eq('status', status)
    if (customerId) query = query.eq('customer_id', customerId)
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    const { data: quotes, error } = await query

    if (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to fetch quotes'
      })
      return
    }

    const totalAmount = quotes?.reduce((sum, q) => sum + q.total, 0) || 0

    const tableRows = quotes?.map(quote => `
      <tr>
        <td>${quote.number}</td>
        <td>${new Date(quote.date).toLocaleDateString('de-CH')}</td>
        <td>${quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('de-CH') : '-'}</td>
        <td>${quote.customers?.name || ''}<br/><span style="color: #666; font-size: 8pt;">${quote.customers?.company || ''}</span></td>
        <td style="text-align: center;">
          <span style="display: inline-block; padding: 1mm 3mm; background: ${
            quote.status === 'ACCEPTED' ? '#d4edda' : 
            quote.status === 'PENDING' ? '#fff3cd' : 
            quote.status === 'REJECTED' ? '#f8d7da' : '#e2e3e5'
          }; border-radius: 3mm; font-size: 8pt; font-weight: 600;">
            ${quote.status}
          </span>
        </td>
        <td style="text-align: right;">CHF ${(quote.total / 100).toFixed(2)}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align: center; color: #999;">No quotes found</td></tr>'

    const summaryHTML = `
      <div class="summary">
        Total: ${quotes?.length || 0} quotes | 
        Total Amount: CHF ${(totalAmount / 100).toFixed(2)}
      </div>
    `

    const tableHTML = `
      ${summaryHTML}
      <table>
        <thead>
          <tr>
            <th>Quote #</th>
            <th>Date</th>
            <th>Valid Until</th>
            <th>Customer</th>
            <th style="text-align: center;">Status</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `

    const html = generateExportPDFTemplate(tableHTML, 'quotes')

    const options = {
      format: 'A4',
      landscape: true,
      preferCSSPageSize: true
    }

    const file = { content: html }
    const pdfBuffer = await htmlPdf.generatePdf(file, options)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="quotes_export_${new Date().toISOString().split('T')[0]}.pdf"`)
    res.send(pdfBuffer)

  } catch (error) {
    console.error('PDF generation error:', error)
    handleSupabaseError(error, 'export quotes PDF')
  }
})

/**
 * @desc    Export payments as PDF
 * @route   GET /api/v1/export/payments/pdf
 * @access  Private
 */
export const exportPaymentsPDF = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required - No company ID'
    })
    return
  }

  try {
    const { isMatched, startDate, endDate } = req.query

    let query = db.payments()
      .select(`
        *,
        invoices (
          number, total
        )
      `)
      .eq('company_id', companyId)
      .order('value_date', { ascending: false })

    if (isMatched === 'true') {
      query = query.eq('is_matched', true)
    } else if (isMatched === 'false') {
      query = query.eq('is_matched', false)
    }

    if (startDate) query = query.gte('value_date', startDate)
    if (endDate) query = query.lte('value_date', endDate)

    const { data: payments, error } = await query

    if (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to fetch payments'
      })
      return
    }

    const totalAmount = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
    const matchedCount = payments?.filter(p => p.is_matched).length || 0
    const unmatchedCount = (payments?.length || 0) - matchedCount

    const tableRows = payments?.map(payment => `
      <tr>
        <td>${new Date(payment.value_date).toLocaleDateString('de-CH')}</td>
        <td>${payment.debtor_name || '-'}</td>
        <td style="font-family: monospace; font-size: 8pt;">${payment.reference || '-'}</td>
        <td style="text-align: right; font-weight: 600;">CHF ${(payment.amount / 100).toFixed(2)}</td>
        <td style="text-align: center;">
          ${payment.is_matched ? `
            <span style="display: inline-block; padding: 1mm 3mm; background: #d4edda; border-radius: 3mm; font-size: 8pt; font-weight: 600;">
              MATCHED
            </span><br/>
            <span style="font-size: 8pt; color: #666;">${payment.invoices?.number || ''}</span>
          ` : `
            <span style="display: inline-block; padding: 1mm 3mm; background: #fff3cd; border-radius: 3mm; font-size: 8pt; font-weight: 600;">
              UNMATCHED
            </span>
          `}
        </td>
        <td style="font-size: 8pt; color: #666;">${payment.description || '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align: center; color: #999;">No payments found</td></tr>'

    const summaryHTML = `
      <div class="summary">
        Total: ${payments?.length || 0} payments | 
        Matched: ${matchedCount} | 
        Unmatched: ${unmatchedCount} | 
        Total Amount: CHF ${(totalAmount / 100).toFixed(2)}
      </div>
    `

    const tableHTML = `
      ${summaryHTML}
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Debtor</th>
            <th>Reference</th>
            <th style="text-align: right;">Amount</th>
            <th style="text-align: center;">Status</th>
            <th>Info</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `

    const html = generateExportPDFTemplate(tableHTML, 'payments')

    const options = {
      format: 'A4',
      landscape: true,
      preferCSSPageSize: true
    }

    const file = { content: html }
    const pdfBuffer = await htmlPdf.generatePdf(file, options)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="payments_export_${new Date().toISOString().split('T')[0]}.pdf"`)
    res.send(pdfBuffer)

  } catch (error) {
    console.error('PDF generation error:', error)
    handleSupabaseError(error, 'export payments PDF')
  }
})

/**
 * @desc    Export customers as PDF
 * @route   GET /api/v1/export/customers/pdf
 * @access  Private
 */
export const exportCustomersPDF = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required - No company ID'
    })
    return
  }

  try {
    const { isActive } = req.query

    let query = db.customers()
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true })

    if (isActive === 'true') query = query.eq('is_active', true)
    if (isActive === 'false') query = query.eq('is_active', false)

    const { data: customers, error } = await query

    if (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to fetch customers'
      })
      return
    }

    const activeCount = customers?.filter(c => c.is_active).length || 0
    const inactiveCount = (customers?.length || 0) - activeCount

    const tableRows = customers?.map(customer => `
      <tr>
        <td>${customer.customer_number}</td>
        <td>
          <strong>${customer.name}</strong>
          ${customer.company ? `<br/><span style="color: #666; font-size: 8pt;">${customer.company}</span>` : ''}
        </td>
        <td style="font-size: 8pt;">
          ${customer.email || ''}<br/>
          ${customer.phone || ''}
        </td>
        <td style="font-size: 8pt;">
          ${customer.address || ''}<br/>
          ${customer.zip} ${customer.city}, ${customer.country}
        </td>
        <td style="text-align: center;">
          <span style="display: inline-block; padding: 1mm 3mm; background: ${customer.is_active ? '#d4edda' : '#f8d7da'}; border-radius: 3mm; font-size: 8pt; font-weight: 600;">
            ${customer.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align: center; color: #999;">No customers found</td></tr>'

    const summaryHTML = `
      <div class="summary">
        Total: ${customers?.length || 0} customers | 
        Active: ${activeCount} | 
        Inactive: ${inactiveCount}
      </div>
    `

    const tableHTML = `
      ${summaryHTML}
      <table>
        <thead>
          <tr>
            <th>Customer #</th>
            <th>Name</th>
            <th>Contact</th>
            <th>Address</th>
            <th style="text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `

    const html = generateExportPDFTemplate(tableHTML, 'customers')

    const options = {
      format: 'A4',
      landscape: true,
      preferCSSPageSize: true
    }

    const file = { content: html }
    const pdfBuffer = await htmlPdf.generatePdf(file, options)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="customers_export_${new Date().toISOString().split('T')[0]}.pdf"`)
    res.send(pdfBuffer)

  } catch (error) {
    console.error('PDF generation error:', error)
    handleSupabaseError(error, 'export customers PDF')
  }
})

