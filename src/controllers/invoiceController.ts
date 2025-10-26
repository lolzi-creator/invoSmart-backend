import { Request, Response } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { AuthenticatedRequest } from '../types'
import {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  ApiResponse
} from '../types'
import { 
  db, 
  supabaseAdmin,
  handleSupabaseError, 
  generateInvoiceNumber,
  generateQRReference,
  DatabaseInvoice,
  DatabaseInvoiceItem,
  DatabaseCustomer,
  DatabaseCompany 
} from '../lib/supabase'

// Helper function to convert DB invoice to API invoice
const createInvoiceResponse = (
  dbInvoice: DatabaseInvoice, 
  customer?: DatabaseCustomer,
  company?: DatabaseCompany,
  items?: DatabaseInvoiceItem[]
): Invoice => {
  return {
    id: dbInvoice.id,
    number: dbInvoice.number,
    customerId: dbInvoice.customer_id,
    customer: customer ? {
      id: customer.id,
      companyId: customer.company_id,
      customerNumber: customer.customer_number,
      name: customer.name,
      company: customer.company || undefined,
      email: customer.email || undefined,
      address: customer.address,
      zip: customer.zip,
      city: customer.city,
      country: customer.country,
      phone: customer.phone || undefined,
      vatNumber: customer.vat_number || undefined,
      paymentTerms: customer.payment_terms,
      creditLimit: customer.credit_limit || undefined,
      isActive: customer.is_active,
      notes: customer.notes || undefined,
      language: customer.language,
      createdAt: new Date(customer.created_at),
      updatedAt: new Date(customer.updated_at)
    } : undefined,
    companyId: dbInvoice.company_id,
    company: company ? {
      id: company.id,
      name: company.name,
      address: company.address,
      zip: company.zip,
      city: company.city,
      country: company.country,
      phone: company.phone || undefined,
      email: company.email,
      website: company.website || undefined,
      uid: company.uid || undefined,
      vatNumber: company.vat_number || undefined,
      iban: company.iban || undefined,
      qrIban: company.qr_iban || undefined,
      logoUrl: company.logo_url || undefined,
      defaultPaymentTerms: company.default_payment_terms,
      defaultLanguage: company.default_language,
      createdAt: new Date(company.created_at),
      updatedAt: new Date(company.updated_at)
    } : undefined,
    date: new Date(dbInvoice.date),
    dueDate: new Date(dbInvoice.due_date),
    status: dbInvoice.status as InvoiceStatus,
    subtotal: dbInvoice.subtotal / 100, // Convert Rappen to CHF
    vatAmount: dbInvoice.vat_amount / 100, // Convert Rappen to CHF
    total: dbInvoice.total / 100, // Convert Rappen to CHF
    paidAmount: dbInvoice.paid_amount / 100, // Convert Rappen to CHF
    qrReference: dbInvoice.qr_reference,
    reminderLevel: dbInvoice.reminder_level,
    lastReminderAt: dbInvoice.last_reminder_at ? new Date(dbInvoice.last_reminder_at) : undefined,
    sentAt: dbInvoice.sent_at ? new Date(dbInvoice.sent_at) : undefined,
    emailSentCount: dbInvoice.email_sent_count,
    discountCode: dbInvoice.discount_code || undefined,
    discountAmount: dbInvoice.discount_amount / 100, // Convert Rappen to CHF
    internalNotes: dbInvoice.internal_notes || undefined,
    items: items ? items.map(createInvoiceItemResponse) : [],
    payments: [], // Would need to be loaded separately
    createdAt: new Date(dbInvoice.created_at),
    updatedAt: new Date(dbInvoice.updated_at)
  }
}

// Helper function to convert DB invoice item to API invoice item
const createInvoiceItemResponse = (dbItem: DatabaseInvoiceItem): InvoiceItem => {
  return {
    id: dbItem.id,
    invoiceId: dbItem.invoice_id,
    description: dbItem.description,
    quantity: dbItem.quantity / 1000, // Convert from 3 decimal precision (1500 = 1.5)
    unit: dbItem.unit,
    unitPrice: dbItem.unit_price / 100, // Convert Rappen to CHF
    discount: dbItem.discount / 100, // Convert from basis points to percentage
    vatRate: dbItem.vat_rate / 100, // Convert from basis points to percentage
    lineTotal: dbItem.line_total / 100, // Convert Rappen to CHF
    vatAmount: dbItem.vat_amount / 100, // Convert Rappen to CHF
    sortOrder: dbItem.sort_order
  }
}

/**
 * @desc    Get all invoices
 * @route   GET /api/v1/invoices
 * @access  Private
 */
export const getInvoices = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  
  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  // Parse query parameters
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 5
  const search = req.query.search as string || ''
  const status = req.query.status as InvoiceStatus
  const sortBy = req.query.sortBy as string || 'date'
  const sortOrder = req.query.sortOrder as string || 'desc'

  try {
    // Build query with joins
    let query = db.invoices()
      .select(`
        *,
        customers (
          id, company_id, customer_number, name, company, email, 
          address, zip, city, country, phone, vat_number, 
          payment_terms, credit_limit, is_active, notes, language,
          created_at, updated_at
        )
      `, { count: 'exact' })
      .eq('company_id', companyId)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(`number.ilike.%${search}%,customers.name.ilike.%${search}%`)
    }

    // Apply sorting
    const ascending = sortOrder === 'asc'
    query = query.order(sortBy, { ascending })

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      handleSupabaseError(error, 'get invoices')
      return
    }

    const invoices = (data as any[]).map(invoice => 
      createInvoiceResponse(invoice, invoice.customers, undefined, invoice.invoice_items)
    )

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    })

  } catch (error) {
    handleSupabaseError(error, 'get invoices')
  }
})

/**
 * @desc    Get single invoice
 * @route   GET /api/v1/invoices/:id
 * @access  Private
 */
export const getInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const invoiceId = req.params.id

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get invoice with customer and items
    const { data: invoiceData, error: invoiceError } = await db.invoices()
      .select(`
        *,
        customers (*),
        companies (*),
        invoice_items (*)
      `)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()

    if (invoiceError || !invoiceData) {
      res.status(404).json({
        success: false,
        error: 'Invoice not found'
      })
      return
    }

    const invoice = createInvoiceResponse(
      invoiceData,
      invoiceData.customers,
      invoiceData.companies,
      invoiceData.invoice_items
    )

    res.json({
      success: true,
      data: { invoice }
    })

  } catch (error) {
    handleSupabaseError(error, 'get invoice')
  }
})

/**
 * @desc    Create new invoice
 * @route   POST /api/v1/invoices
 * @access  Private
 */
export const createInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  const {
    customerId,
    date = new Date(),
    dueDate,
    items = [],
    notes,
    discountCode
  } = req.body

  try {
    // Verify customer exists and belongs to company
    const { data: customer, error: customerError } = await db.customers()
      .select('*')
      .eq('id', customerId)
      .eq('company_id', companyId)
      .single()

    if (customerError || !customer) {
      res.status(404).json({
        success: false,
        error: 'Customer not found'
      })
      return
    }

    // Generate invoice number and QR reference
    const invoiceNumber = await generateInvoiceNumber(companyId)
    const qrReference = await generateQRReference(invoiceNumber, companyId)

    // Calculate due date if not provided
    let calculatedDueDate = dueDate
    if (!calculatedDueDate) {
      const invoiceDate = new Date(date)
      calculatedDueDate = new Date(invoiceDate.getTime() + customer.payment_terms * 24 * 60 * 60 * 1000)
    } else if (typeof calculatedDueDate === 'string') {
      calculatedDueDate = new Date(calculatedDueDate)
    }

    // Calculate totals from items
    let subtotal = 0
    let vatTotal = 0
    let discountAmount = 0

    const processedItems = items.map((item: {
      description: string
      quantity: number
      unit?: string
      unitPrice: number
      discount?: number
      vatRate?: number
    }, index: number) => {
      // Calculate amounts in CHF
      const lineTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100)
      const vatAmount = lineTotal * (item.vatRate || 0) / 100
      
      subtotal += lineTotal
      vatTotal += vatAmount

      return {
        description: item.description,
        quantity: Math.round(item.quantity * 1000), // Convert to 3 decimal precision (1.5 = 1500)
        unit: item.unit || 'Stk',
        unit_price: Math.round(item.unitPrice * 100), // Convert CHF to Rappen
        discount: Math.round((item.discount || 0) * 100), // Convert to basis points
        vat_rate: Math.round((item.vatRate || 0) * 100), // Convert to basis points
        line_total: Math.round(lineTotal * 100), // Convert CHF to Rappen
        vat_amount: Math.round(vatAmount * 100), // Convert CHF to Rappen
        sort_order: index + 1
      }
    })

    // Apply discount code if provided
    if (discountCode) {
      const { data: discount } = await db.discountCodes()
        .select('*')
        .eq('code', discountCode)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .single()

      if (discount) {
        discountAmount = Math.round(subtotal * discount.percentage / 10000 * 100) / 100
      }
    }

    const total = subtotal + vatTotal - discountAmount


    // Create invoice
    const invoiceData = {
      company_id: companyId,
      customer_id: customerId,
      number: invoiceNumber,
      qr_reference: qrReference,
      status: 'DRAFT' as InvoiceStatus,
      date: typeof date === 'string' ? date : date.toISOString().split('T')[0],
      due_date: typeof calculatedDueDate === 'string' ? calculatedDueDate : calculatedDueDate.toISOString().split('T')[0],
      subtotal: Math.round(subtotal * 100), // Convert CHF to Rappen
      vat_amount: Math.round(vatTotal * 100), // Convert CHF to Rappen
      total: Math.round(total * 100), // Convert CHF to Rappen
      paid_amount: 0,
      reminder_level: 0,
      email_sent_count: 0,
      discount_code: discountCode || null,
      discount_amount: Math.round(discountAmount * 100) // Convert CHF to Rappen
    }

    const { data: newInvoice, error: invoiceCreateError } = await db.invoices()
      .insert(invoiceData)
      .select()
      .single()

    if (invoiceCreateError || !newInvoice) {
      handleSupabaseError(invoiceCreateError, 'create invoice')
      return
    }

    // Create invoice items
    if (processedItems.length > 0) {
      const itemsWithInvoiceId = processedItems.map((item: any) => ({
        ...item,
        invoice_id: newInvoice.id
      }))

      const { error: itemsError } = await db.invoiceItems()
        .insert(itemsWithInvoiceId)

      if (itemsError) {
        // Cleanup: delete invoice if items creation fails
        await db.invoices().delete().eq('id', newInvoice.id)
        handleSupabaseError(itemsError, 'create invoice items')
        return
      }
    }

    // Get complete invoice with relations
    const { data: completeInvoice, error: fetchError } = await db.invoices()
      .select(`
        *,
        customers (*),
        companies (*),
        invoice_items (*)
      `)
      .eq('id', newInvoice.id)
      .single()

    if (fetchError || !completeInvoice) {
      handleSupabaseError(fetchError, 'fetch complete invoice')
      return
    }

    const invoice = createInvoiceResponse(
      completeInvoice,
      completeInvoice.customers,
      completeInvoice.companies,
      completeInvoice.invoice_items
    )

    // Generate and save PDF automatically
    try {
      console.log('📄 Generating PDF for new invoice:', invoice.number)
      
      // Generate PDF using the existing PDF generation function
      const { Resend } = require('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      
      // Get company data for PDF
      const { data: company, error: companyError } = await db.companies()
        .select('*')
        .eq('id', companyId)
        .single()

      if (companyError || !company) {
        console.error('❌ Company not found for PDF generation:', companyError)
      } else {
        // Generate PDF using the same logic as the PDF endpoint
        const QRCode = require('qrcode')
        
        const qrReference = invoice.qrReference
        
        // Swiss QR-Invoice payload
        const qrPayload = [
          'SPC', '0200', '1',
          company.iban || 'CH2109000000100015000.6',
          'S', company.name, company.address, '', company.zip, company.city, 'CH',
          '', '', '', '', '', '', '',
          (invoice.total / 100).toFixed(2), 'CHF',
          'S', invoice.customer?.name || 'Customer', 
          invoice.customer?.address || 'Address', '', 
          invoice.customer?.zip || '0000', 
          invoice.customer?.city || 'City', 
          invoice.customer?.country || 'CH',
          'QRR', qrReference, `Invoice ${invoice.number}`, 'EPD'
        ].join('\n')
        
        const qrCodeImage = await QRCode.toDataURL(qrPayload, {
          type: 'image/png',
          width: 140,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' }
        })

        // Create PDF content (simplified version)
        const pdfContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Invoice ${invoice.number}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 12px; color: #333; }
              .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e5e5; }
              .company-info { flex: 1; }
              .invoice-title { font-size: 24px; font-weight: bold; color: #2563eb; margin: 20px 0; }
              .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
              .items-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
              .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              .items-table th { background-color: #f8f9fa; font-weight: bold; }
              .totals { margin-top: 20px; text-align: right; }
              .totals table { margin-left: auto; border-collapse: collapse; }
              .totals td { padding: 5px 15px; border-bottom: 1px solid #eee; }
              .totals .total-row { font-weight: bold; font-size: 14px; border-top: 2px solid #333; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="company-info">
                <h1>${company.name}</h1>
                <div>${company.address}</div>
                <div>${company.zip} ${company.city}</div>
                <div>Schweiz</div>
                <br>
                <div>E-Mail: ${company.email}</div>
                ${company.phone ? `<div>Tel: ${company.phone}</div>` : ''}
                ${company.uid ? `<div>UID: ${company.uid}</div>` : ''}
                ${company.vat_number ? `<div>MWST-Nr: ${company.vat_number}</div>` : ''}
                ${company.iban ? `<div>IBAN: ${company.iban}</div>` : ''}
              </div>
            </div>

            <div class="invoice-title">Rechnung ${invoice.number}</div>

            <div class="invoice-details">
              <div>
                <h3>Rechnungsadresse:</h3>
                <div><strong>${invoice.customer?.name || 'Customer'}</strong></div>
                ${invoice.customer?.company ? `<div>${invoice.customer.company}</div>` : ''}
                <div>${invoice.customer?.address || 'Address'}</div>
                <div>${invoice.customer?.zip || '0000'} ${invoice.customer?.city || 'City'}</div>
                <div>${invoice.customer?.country || 'CH'}</div>
              </div>
              <div>
                <table>
                  <tr><td><strong>Rechnungsnummer:</strong></td><td>${invoice.number}</td></tr>
                  <tr><td><strong>Rechnungsdatum:</strong></td><td>${new Date(invoice.date).toLocaleDateString('de-CH')}</td></tr>
                  <tr><td><strong>Fälligkeitsdatum:</strong></td><td>${new Date(invoice.dueDate).toLocaleDateString('de-CH')}</td></tr>
                  <tr><td><strong>QR-Referenz:</strong></td><td>${invoice.qrReference}</td></tr>
                </table>
              </div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Beschreibung</th>
                  <th>Menge</th>
                  <th>Einheit</th>
                  <th>Preis (CHF)</th>
                  <th>Betrag (CHF)</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.items?.map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${item.description}</td>
                    <td>${item.quantity.toFixed(3)}</td>
                    <td>${item.unit}</td>
                    <td>${(item.unitPrice / 100).toFixed(2)}</td>
                    <td>${(item.lineTotal / 100).toFixed(2)}</td>
                  </tr>
                `).join('') || '<tr><td colspan="6">No items</td></tr>'}
              </tbody>
            </table>

            <div class="totals">
              <table>
                <tr><td>Zwischensumme:</td><td>CHF ${(invoice.subtotal / 100).toFixed(2)}</td></tr>
                <tr><td>MWST:</td><td>CHF ${(invoice.vatAmount / 100).toFixed(2)}</td></tr>
                <tr class="total-row"><td><strong>Total CHF:</strong></td><td><strong>${(invoice.total / 100).toFixed(2)}</strong></td></tr>
              </table>
            </div>

            <div style="margin-top: 40px; text-align: center;">
              <img src="${qrCodeImage}" alt="Swiss QR Code" style="width: 140px; height: 140px;" />
              <div style="margin-top: 10px; font-size: 10px;">Swiss QR Code</div>
            </div>
          </body>
          </html>
        `

        // Generate PDF using html-pdf-node
        const htmlPdf = require('html-pdf-node')
        const options = {
          format: 'A4',
          margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
          printBackground: true,
          displayHeaderFooter: false,
          timeout: 10000
        }
        
        const file = { content: pdfContent }
        const pdfBuffer = await htmlPdf.generatePdf(file, options)
        
        // Save PDF to Supabase Storage
        const fileName = `invoice-${invoice.number}-${Date.now()}.pdf`
        const filePath = `invoices/${companyId}/${fileName}`
        
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('invoices')
          .upload(filePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: false
          })

        if (uploadError) {
          console.error('❌ Failed to upload PDF to storage:', uploadError)
        } else {
          console.log('✅ PDF uploaded successfully:', uploadData.path)
          
          // Create file record in database
          const fileRecord = {
            invoice_id: invoice.id,
            file_name: fileName,
            file_path: filePath,
            file_size: pdfBuffer.length,
            mime_type: 'application/pdf',
            uploaded_at: new Date().toISOString()
          }
          
          // Note: You'll need to create an invoice_files table in your database
          // For now, we'll just log the file info
          console.log('📄 PDF file record:', fileRecord)
        }
      }
    } catch (pdfError) {
      console.error('❌ Error generating PDF:', pdfError)
      // Don't fail the invoice creation if PDF generation fails
    }

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: { invoice }
    })

  } catch (error) {
    handleSupabaseError(error, 'create invoice')
  }
})

/**
 * @desc    Update invoice status
 * @route   PUT /api/v1/invoices/:id/status
 * @access  Private
 */
export const updateInvoiceStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const invoiceId = req.params.id
  const { status } = req.body

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    const updateData: any = { status }

    // Set sentAt when status changes to OPEN
    if (status === 'OPEN') {
      updateData.sent_at = new Date().toISOString()
      updateData.email_sent_count = 1
    }

    const { data, error } = await db.invoices()
      .update(updateData)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error || !data) {
      res.status(404).json({
        success: false,
        error: 'Invoice not found'
      })
      return
    }

    res.json({
      success: true,
      message: 'Invoice status updated successfully',
      data: { invoice: createInvoiceResponse(data) }
    })

  } catch (error) {
    handleSupabaseError(error, 'update invoice status')
  }
})

/**
 * @desc    Get invoice statistics
 * @route   GET /api/v1/invoices/stats
 * @access  Private
 */
export const getInvoiceStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get all invoices for stats
    const { data: invoices, error } = await db.invoices()
      .select('status, total, paid_amount, date')
      .eq('company_id', companyId)

    if (error) {
      handleSupabaseError(error, 'get invoice stats')
      return
    }

    // Calculate statistics
    const totalInvoices = invoices?.length || 0
    const totalRevenue = invoices?.reduce((sum, inv) => sum + inv.total, 0) || 0
    const totalPaid = invoices?.reduce((sum, inv) => sum + inv.paid_amount, 0) || 0
    const totalOutstanding = totalRevenue - totalPaid

    const statusCounts = invoices?.reduce((acc, inv) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const stats = {
      totalInvoices,
      totalRevenue,
      totalPaid,
      totalOutstanding,
      statusCounts,
      averageInvoiceValue: totalInvoices > 0 ? Math.round(totalRevenue / totalInvoices) : 0
    }

    res.json({
      success: true,
      data: { stats }
    })

  } catch (error) {
    handleSupabaseError(error, 'get invoice stats')
  }
})

/**
 * @desc    Generate Swiss QR code data
 * @route   GET /api/v1/invoices/:id/qr
 * @access  Private
 */
export const generateInvoiceQR = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const invoiceId = req.params.id

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get invoice with company and customer data
    const { data: invoice, error: invoiceError } = await db.invoices()
      .select(`
        *,
        customers (
          id, name, company, address, zip, city, country
        )
      `)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()

    if (invoiceError || !invoice) {
      res.status(404).json({
        success: false,
        error: 'Invoice not found'
      })
      return
    }

    // Get company data
    const { data: company, error: companyError } = await db.companies()
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      res.status(404).json({
        success: false,
        error: 'Company not found'
      })
      return
    }

    // Generate Swiss QR-Invoice data according to SIX standard
    const qrData = {
      // QR Type
      qrType: 'SPC', // Swiss Payments Code
      version: '0200', // Version 2.0
      codingType: '1', // UTF-8
      
      // Account (Creditor)
      iban: company.iban || company.qr_iban || 'CH2109000000100015000.6', // Fallback IBAN
      creditor: {
        addressType: 'S', // Structured address
        name: company.name,
        street: company.address,
        houseNumber: '', // Could be extracted from address
        postalCode: company.zip,
        town: company.city,
        country: company.country || 'CH'
      },
      
      // Amount
      amount: invoice.total.toFixed(2), // Already in CHF
      currency: 'CHF',
      
      // Debtor (Customer)
      debtor: {
        addressType: 'S',
        name: invoice.customers.name,
        street: invoice.customers.address,
        houseNumber: '',
        postalCode: invoice.customers.zip,
        town: invoice.customers.city,
        country: invoice.customers.country || 'CH'
      },
      
      // Payment reference
      referenceType: 'QRR', // QR Reference
      reference: invoice.qr_reference,
      
      // Additional information
      unstructuredMessage: `Invoice ${invoice.number}`,
      trailer: 'EPD', // End Payment Data
      
      // For display
      invoiceNumber: invoice.number,
      invoiceDate: invoice.date,
      dueDate: invoice.due_date,
      
      // QR Code payload (simplified - in production use proper QR lib)
      qrCodePayload: [
        'SPC', // QR Type
        '0200', // Version
        '1', // Coding
        company.iban || 'CH2109000000100015000.6', // IBAN
        'S', // Address type
        company.name, // Creditor name
        company.address, // Street
        '', // House number
        company.zip, // Postal code
        company.city, // Town
        'CH', // Country
        '', '', '', '', '', '', '', // Ultimate creditor (empty)
        (invoice.total / 100).toFixed(2), // Amount
        'CHF', // Currency
        'S', // Debtor address type
        invoice.customers.name, // Debtor name
        invoice.customers.address, // Debtor street
        '', // Debtor house number
        invoice.customers.zip, // Debtor postal code
        invoice.customers.city, // Debtor town
        invoice.customers.country || 'CH', // Debtor country
        'QRR', // Reference type
        invoice.qr_reference, // Reference
        `Invoice ${invoice.number}`, // Additional info
        'EPD' // Trailer
      ].join('\n')
    }

    res.json({
      success: true,
      data: qrData
    })

  } catch (error) {
    handleSupabaseError(error, 'generate QR code')
  }
})

/**
 * @desc    Generate invoice PDF
 * @route   GET /api/v1/invoices/:id/pdf
 * @access  Private
 */
export const generateInvoicePdf = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const invoiceId = req.params.id

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get invoice with all related data
    const { data: invoice, error: invoiceError } = await db.invoices()
      .select(`
        *,
        customers (
          id, name, company, address, zip, city, country, email, phone, uid, vat_number
        ),
        invoice_items (
          id, description, quantity, unit, unit_price, discount, vat_rate, line_total, vat_amount, sort_order
        )
      `)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()

    if (invoiceError || !invoice) {
      res.status(404).json({
        success: false,
        error: 'Invoice not found'
      })
      return
    }

    // Get company data
    const { data: company, error: companyError } = await db.companies()
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      res.status(404).json({
        success: false,
        error: 'Company not found'
      })
      return
    }

    // Generate Swiss QR code according to SIX standard
    const QRCode = require('qrcode')
    
    const qrReference = invoice.qr_reference
    
    // Swiss QR-Invoice payload according to SIX standard
    const qrPayload = [
      'SPC', // Swiss Payments Code
      '0200', // Version
      '1', // Coding (UTF-8)
      company.iban || 'CH2109000000100015000.6', // IBAN
      'S', // Creditor address type (Structured)
      company.name, // Creditor name
      company.address, // Creditor street
      '', // Creditor house number
      company.zip, // Creditor postal code
      company.city, // Creditor town
      'CH', // Creditor country
      '', '', '', '', '', '', '', // Ultimate creditor (empty)
      (invoice.total / 100).toFixed(2), // Amount
      'CHF', // Currency
      'S', // Debtor address type
      invoice.customers.name, // Debtor name
      invoice.customers.address, // Debtor street
      '', // Debtor house number
      invoice.customers.zip, // Debtor postal code
      invoice.customers.city, // Debtor town
      invoice.customers.country || 'CH', // Debtor country
      'QRR', // Reference type (QR Reference)
      qrReference, // Payment reference
      `Invoice ${invoice.number}`, // Additional information
      'EPD' // End Payment Data
    ].join('\n')
    
    // Generate QR code as base64 image
    const qrCodeImage = await QRCode.toDataURL(qrPayload, {
      type: 'image/png',
      width: 140,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
    
    console.log('QR code generated for invoice:', invoice.number)

    // Create HTML template for Swiss invoice
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice ${invoice.number}</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 0; 
          padding: 20px; 
          font-size: 12px;
          color: #333;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e5e5;
        }
        .company-info { flex: 1; }
        .logo { width: 150px; height: 80px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; }
        .invoice-title { 
          font-size: 24px; 
          font-weight: bold; 
          color: #2563eb;
          margin: 20px 0;
        }
        .invoice-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-bottom: 30px;
        }
        .customer-info { }
        .invoice-meta { text-align: right; }
        .items-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 30px 0;
        }
        .items-table th, .items-table td { 
          border: 1px solid #ddd; 
          padding: 8px; 
          text-align: left;
        }
        .items-table th { 
          background-color: #f8f9fa; 
          font-weight: bold;
        }
        .items-table .number { text-align: right; }
        .totals { 
          margin-top: 20px;
          text-align: right;
        }
        .totals table {
          margin-left: auto;
          border-collapse: collapse;
        }
        .totals td {
          padding: 5px 15px;
          border-bottom: 1px solid #eee;
        }
        .totals .total-row {
          font-weight: bold;
          font-size: 14px;
          border-top: 2px solid #333;
        }
        .payment-info {
          margin-top: 40px;
          padding: 20px;
          background-color: #f8f9fa;
          border: 1px solid #ddd;
        }
        .qr-section {
          margin-top: 30px;
          padding: 20px;
          border: 2px solid #000;
          display: flex;
          gap: 20px;
        }
        .qr-code {
          width: 140px;
          height: 140px;
          border: 1px solid #000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          font-size: 10px;
        }
        .qr-info { flex: 1; }
        .swiss-cross {
          color: red;
          font-weight: bold;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <!-- Header with Company Info and Logo -->
      <div class="header">
        <div class="company-info">
          <h1>${company.name}</h1>
          <div>${company.address}</div>
          <div>${company.zip} ${company.city}</div>
          <div>Schweiz</div>
          <br>
          <div>E-Mail: ${company.email}</div>
          ${company.phone ? `<div>Tel: ${company.phone}</div>` : ''}
          ${company.uid ? `<div>UID: ${company.uid}</div>` : ''}
          ${company.vat_number ? `<div>MWST-Nr: ${company.vat_number}</div>` : ''}
          ${company.iban ? `<div>IBAN: ${company.iban}</div>` : ''}
        </div>
        <div class="logo">
          ${company.logo_url ? `<img src="${company.logo_url}" alt="Logo" style="max-width: 100%; max-height: 100%;">` : '[LOGO]'}
        </div>
      </div>

      <!-- Invoice Title -->
      <div class="invoice-title">Rechnung ${invoice.number}</div>

      <!-- Invoice Details -->
      <div class="invoice-details">
        <div class="customer-info">
          <h3>Rechnungsadresse:</h3>
          <div><strong>${invoice.customers.name}</strong></div>
          ${invoice.customers.company ? `<div>${invoice.customers.company}</div>` : ''}
          <div>${invoice.customers.address}</div>
          <div>${invoice.customers.zip} ${invoice.customers.city}</div>
          <div>${invoice.customers.country === 'CH' ? 'Schweiz' : invoice.customers.country}</div>
          ${invoice.customers.email ? `<br><div>E-Mail: ${invoice.customers.email}</div>` : ''}
          ${invoice.customers.phone ? `<div>Tel: ${invoice.customers.phone}</div>` : ''}
          ${invoice.customers.uid ? `<div>UID: ${invoice.customers.uid}</div>` : ''}
        </div>
        <div class="invoice-meta">
          <table>
            <tr><td><strong>Rechnungsnummer:</strong></td><td>${invoice.number}</td></tr>
            <tr><td><strong>Rechnungsdatum:</strong></td><td>${new Date(invoice.date).toLocaleDateString('de-CH')}</td></tr>
            <tr><td><strong>Fälligkeitsdatum:</strong></td><td>${new Date(invoice.due_date).toLocaleDateString('de-CH')}</td></tr>
            <tr><td><strong>Zahlungsfrist:</strong></td><td>${invoice.customers.payment_terms || 30} Tage</td></tr>
            <tr><td><strong>QR-Referenz:</strong></td><td>${invoice.qr_reference}</td></tr>
          </table>
        </div>
      </div>

      <!-- Invoice Items -->
      <table class="items-table">
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Beschreibung</th>
            <th>Menge</th>
            <th>Einheit</th>
            <th>Preis (CHF)</th>
            <th>Rabatt (%)</th>
            <th>MWST (%)</th>
            <th>Betrag (CHF)</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.invoice_items?.map((item: any, index: number) => `
            <tr>
              <td>${index + 1}</td>
              <td>${item.description}</td>
              <td class="number">${(item.quantity / 1000).toFixed(3)}</td>
              <td>${item.unit}</td>
              <td class="number">${(item.unit_price / 100).toFixed(2)}</td>
              <td class="number">${(item.discount / 100).toFixed(1)}%</td>
              <td class="number">${(item.vat_rate / 100).toFixed(1)}%</td>
              <td class="number">${(item.line_total / 100).toFixed(2)}</td>
            </tr>
          `).join('') || '<tr><td colspan="8">No items</td></tr>'}
        </tbody>
      </table>

      <!-- Totals -->
      <div class="totals">
        <table>
          <tr><td>Zwischensumme:</td><td>CHF ${(invoice.subtotal / 100).toFixed(2)}</td></tr>
          ${invoice.discount_amount > 0 ? `<tr><td>Rabatt:</td><td>CHF -${(invoice.discount_amount / 100).toFixed(2)}</td></tr>` : ''}
          <tr><td>MWST:</td><td>CHF ${(invoice.vat_amount / 100).toFixed(2)}</td></tr>
          <tr class="total-row"><td><strong>Total CHF:</strong></td><td><strong>${(invoice.total / 100).toFixed(2)}</strong></td></tr>
        </table>
      </div>

      <!-- Payment Information -->
      <div class="payment-info">
        <h3>Zahlungsinformationen</h3>
        <p><strong>Zahlbar bis:</strong> ${new Date(invoice.due_date).toLocaleDateString('de-CH')}</p>
        <p><strong>Referenz:</strong> ${invoice.qr_reference}</p>
        <p>Bitte verwenden Sie den beigefügten QR-Code für die Zahlung oder überweisen Sie den Betrag unter Angabe der Referenznummer.</p>
      </div>

      <!-- Page Break Before QR Section -->
      <div style="page-break-before: always;"></div>
      
      <!-- Swiss QR-Invoice Payment Slip (Separate Page) -->
      <div style="width: 210mm; height: 297mm; position: relative; margin: 0; padding: 0;">
        
        <!-- QR-Invoice Header -->
        <div style="text-align: center; margin: 20mm 0 10mm 0; font-size: 16px; font-weight: bold;">
          Zahlteil / Section paiement / Sezione pagamento
        </div>
        
        <!-- Main QR Payment Section -->
        <div style="display: flex; height: 105mm; border: 1px solid #000;">
          
          <!-- Receipt Section (Left) -->
          <div style="width: 62mm; padding: 5mm; border-right: 1px solid #000; font-size: 8pt;">
            <div style="font-weight: bold; margin-bottom: 5mm;">Empfangsschein</div>
            
            <div style="margin-bottom: 3mm;">
              <div style="font-weight: bold; font-size: 6pt;">Konto / Payable to</div>
              <div>${company.iban || 'CH21 0900 0000 1001 5000 6'}</div>
              <div>${company.name}</div>
              <div>${company.address}</div>
              <div>${company.zip} ${company.city}</div>
            </div>
            
            <div style="margin-bottom: 3mm;">
              <div style="font-weight: bold; font-size: 6pt;">Referenz</div>
              <div style="font-size: 8pt;">${qrReference}</div>
            </div>
            
            <div style="margin-bottom: 3mm;">
              <div style="font-weight: bold; font-size: 6pt;">Zahlbar durch</div>
              <div>${invoice.customers.name}</div>
              ${invoice.customers.company ? `<div>${invoice.customers.company}</div>` : ''}
              <div>${invoice.customers.address}</div>
              <div>${invoice.customers.zip} ${invoice.customers.city}</div>
            </div>
            
            <div style="position: absolute; bottom: 5mm; left: 5mm;">
              <div style="font-weight: bold; font-size: 6pt;">Währung</div>
              <div>CHF</div>
            </div>
            
            <div style="position: absolute; bottom: 5mm; left: 20mm;">
              <div style="font-weight: bold; font-size: 6pt;">Betrag</div>
              <div style="font-weight: bold;">${(invoice.total / 100).toFixed(2)}</div>
            </div>
            
            <div style="position: absolute; bottom: 15mm; right: 5mm; font-size: 6pt;">
              Annahmestelle
            </div>
          </div>
          
          <!-- Payment Section (Right) -->
          <div style="flex: 1; padding: 5mm; position: relative;">
            <div style="font-weight: bold; margin-bottom: 5mm;">Zahlteil</div>
            
            <!-- QR Code -->
            <div style="position: absolute; top: 5mm; right: 5mm;">
              <img src="${qrCodeImage}" alt="Swiss QR Code" style="width: 46mm; height: 46mm;" />
              <div style="text-align: center; margin-top: 2mm; font-size: 6pt;">
                🇨🇭 Swiss QR Code
              </div>
            </div>
            
            <!-- Payment Information -->
            <div style="width: 55mm;">
              <div style="margin-bottom: 3mm;">
                <div style="font-weight: bold; font-size: 6pt;">Währung</div>
                <div>CHF</div>
              </div>
              
              <div style="margin-bottom: 3mm;">
                <div style="font-weight: bold; font-size: 6pt;">Betrag</div>
                <div style="font-weight: bold; font-size: 10pt;">${(invoice.total / 100).toFixed(2)}</div>
              </div>
              
              <div style="margin-bottom: 3mm;">
                <div style="font-weight: bold; font-size: 6pt;">Konto / Payable to</div>
                <div>${company.iban || 'CH21 0900 0000 1001 5000 6'}</div>
                <div>${company.name}</div>
                <div>${company.address}</div>
                <div>${company.zip} ${company.city}</div>
              </div>
              
              <div style="margin-bottom: 3mm;">
                <div style="font-weight: bold; font-size: 6pt;">Referenz</div>
                <div style="font-size: 8pt; word-break: break-all;">${qrReference}</div>
              </div>
              
              <div style="margin-bottom: 3mm;">
                <div style="font-weight: bold; font-size: 6pt;">Zusätzliche Informationen</div>
                <div style="font-size: 8pt;">Rechnung ${invoice.number}</div>
                <div style="font-size: 8pt;">Fällig: ${new Date(invoice.due_date).toLocaleDateString('de-CH')}</div>
              </div>
              
              <div>
                <div style="font-weight: bold; font-size: 6pt;">Zahlbar durch</div>
                <div>${invoice.customers.name}</div>
                ${invoice.customers.company ? `<div>${invoice.customers.company}</div>` : ''}
                <div>${invoice.customers.address}</div>
                <div>${invoice.customers.zip} ${invoice.customers.city}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Perforated Line -->
        <div style="margin: 5mm 0; border-top: 1px dashed #000; text-align: center; font-size: 6pt; color: #666;">
          ✂️ Hier abtrennen / Détacher ici / Staccare qui
        </div>
        
      </div>

      <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #666;">
        Generiert am ${new Date().toLocaleDateString('de-CH')} um ${new Date().toLocaleTimeString('de-CH')}
      </div>
    </body>
    </html>
    `

    // Generate actual PDF using html-pdf-node
    try {
      const htmlPdf = require('html-pdf-node')
      
      console.log('Starting PDF generation for invoice:', invoice.number)
      
      const options = {
        format: 'A4',
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '20mm',
          right: '20mm'
        },
        printBackground: true,
        displayHeaderFooter: false,
        // Optimized for speed
        timeout: 5000, // Reduced timeout for faster generation
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--run-all-compositor-stages-before-draw',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        waitForSelector: 'body',
        omitBackground: false,
        // Additional speed optimizations
        preferCSSPageSize: true,
        emulateMedia: 'print'
      }
      
      const file = { content: htmlTemplate }
      
      console.log('Generating PDF with html-pdf-node...')
      
      const pdfBuffer = await htmlPdf.generatePdf(file, options)
      
      console.log('PDF generated successfully, size:', pdfBuffer.length)
      
      // Send PDF as download
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.number}.pdf"`)
      res.setHeader('Content-Length', pdfBuffer.length.toString())
      res.send(pdfBuffer)
      
    } catch (pdfError: any) {
      console.error('PDF generation error:', pdfError)
      
      // Fallback to HTML if PDF fails
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(htmlTemplate + `
        <br><br>
        <div style="color: red; background: #ffe6e6; padding: 10px; border: 1px solid red; margin: 20px;">
          <strong>PDF Generation Failed:</strong> ${pdfError?.message || 'Unknown error'}<br>
          Showing HTML version instead. Use browser Print → Save as PDF.
        </div>
      `)
    }

  } catch (error) {
    handleSupabaseError(error, 'generate PDF')
  }
})

/**
 * @desc    Send reminder for invoice
 * @route   POST /api/v1/invoices/:id/reminder
 * @access  Private
 */
export const sendInvoiceReminder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const invoiceId = req.params.id
  const { level } = req.body

  console.log('📧 Reminder request:', { companyId, invoiceId, level })

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get invoice with customer data
    console.log('🔍 Looking up invoice:', { invoiceId, companyId })
    const { data: invoice, error: invoiceError } = await db.invoices()
      .select(`
        *,
        customers (
          id, name, company, email
        )
      `)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()

    console.log('📋 Invoice lookup result:', { invoice, error: invoiceError })

    if (invoiceError || !invoice) {
      console.log('❌ Invoice not found:', invoiceError)
      res.status(404).json({
        success: false,
        error: 'Invoice not found'
      })
      return
    }

    // Check if invoice is eligible for reminders
    console.log('📊 Invoice status:', invoice.status)
    if (invoice.status === 'CANCELLED') {
      console.log('❌ Invoice is cancelled, cannot send reminder')
      res.status(400).json({
        success: false,
        error: 'Cannot send reminder for cancelled invoice'
      })
      return
    }
    
    // For testing purposes, allow reminders for paid invoices
    if (invoice.status === 'PAID') {
      console.log('⚠️ Invoice is paid, but allowing reminder for testing')
    }

    // Check if reminder level is valid
    if (level < 1 || level > 3) {
      res.status(400).json({
        success: false,
        error: 'Invalid reminder level (must be 1-3)'
      })
      return
    }
    
    // For testing purposes, allow any level (remove strict validation)
    console.log(`Sending reminder level ${level} for invoice ${invoice.number}`)

    // Cooldown check is now handled above with 1-hour testing period

    // Update invoice reminder level and timestamp
    const { data: updatedInvoice, error: updateError } = await db.invoices()
      .update({
        reminder_level: level,
        last_reminder_at: new Date().toISOString(),
        email_sent_count: (invoice.email_sent_count || 0) + 1
      })
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (updateError) {
      handleSupabaseError(updateError, 'update reminder level')
      return
    }

    // Send actual email using Resend to verified email
    try {
      const { Resend } = require('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      
      // Send to verified email address
      const verifiedEmail = 'mkrshkov@gmail.com'
      
      const result = await resend.emails.send({
        from: 'invoSmart <onboarding@resend.dev>',
        to: [verifiedEmail],
        subject: `Reminder ${level} - Invoice ${invoice.number} Payment Due`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Payment Reminder</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #2563eb; margin: 0;">Reminder ${level} - Invoice Payment Due</h2>
            </div>
            
            <p>Dear ${invoice.customers.name},</p>
            
            <p>This is reminder ${level} for the following invoice:</p>
            
            <div style="background: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p><strong>Invoice Number:</strong> ${invoice.number}</p>
              <p><strong>Invoice Date:</strong> ${new Date(invoice.date).toLocaleDateString()}</p>
              <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
              <p><strong>Amount Due:</strong> CHF ${(invoice.total / 100).toFixed(2)}</p>
            </div>
            
            <p>Please process payment at your earliest convenience.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p>Best regards,<br><strong>invoSmart Team</strong></p>
              <p style="font-size: 12px; color: #6b7280;">
                Test email sent to ${verifiedEmail}
              </p>
            </div>
          </body>
          </html>
        `,
        text: `Reminder ${level} - Invoice ${invoice.number} Payment Due\n\nDear ${invoice.customers.name},\n\nThis is reminder ${level} for the following invoice:\n\nInvoice Number: ${invoice.number}\nInvoice Date: ${new Date(invoice.date).toLocaleDateString()}\nDue Date: ${new Date(invoice.due_date).toLocaleDateString()}\nAmount Due: CHF ${(invoice.total / 100).toFixed(2)}\n\nPlease process payment at your earliest convenience.\n\nBest regards,\ninvoSmart Team\n\nTest email sent to ${verifiedEmail}`
      })

      if (result.data?.id) {
        console.log(`✅ Reminder ${level} sent successfully to ${verifiedEmail} (Message ID: ${result.data.id})`)
      } else {
        console.error(`❌ Failed to send reminder email:`, result.error)
      }
    } catch (emailError) {
      console.error('Error sending reminder email:', emailError)
    }

    res.json({
      success: true,
      message: `Reminder ${level} sent successfully to mkrshkov@gmail.com`,
      data: {
        invoice: updatedInvoice,
        reminderLevel: level,
        sentTo: 'mkrshkov@gmail.com',
        sentAt: new Date().toISOString(),
        testMode: true
      }
    })

  } catch (error) {
    handleSupabaseError(error, 'send reminder')
  }
})

/**
 * @desc    Generate reminder PDF
 * @route   GET /api/v1/invoices/:id/reminder-pdf/:level
 * @access  Private
 */
export const generateReminderPdf = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const invoiceId = req.params.id
  const reminderLevel = parseInt(req.params.level)

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  if (!reminderLevel || reminderLevel < 1 || reminderLevel > 3) {
    res.status(400).json({
      success: false,
      error: 'Invalid reminder level (1-3)'
    })
    return
  }

  try {
    // Get invoice with customer and company data
    const { data: invoice, error: invoiceError } = await db.invoices()
      .select(`
        *,
        customers (
          id, name, company, address, zip, city, country, email, phone
        )
      `)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()

    if (invoiceError || !invoice) {
      res.status(404).json({
        success: false,
        error: 'Invoice not found'
      })
      return
    }

    // Get company data
    const { data: company, error: companyError } = await db.companies()
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      res.status(404).json({
        success: false,
        error: 'Company not found'
      })
      return
    }

    // Reminder templates
    const reminderTemplates = {
      1: {
        title: '1. Mahnung',
        subject: `1. Zahlungserinnerung - Rechnung ${invoice.number}`,
        salutation: 'Sehr geehrte Damen und Herren',
        body: `unser System zeigt, dass die nachstehende Rechnung noch nicht beglichen wurde. Wir bitten Sie höflich, den offenen Betrag innerhalb der nächsten 10 Tage zu begleichen.

Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben als gegenstandslos.`,
        closing: 'Freundliche Grüsse',
        urgency: 'info',
        fee: 0
      },
      2: {
        title: '2. Mahnung',
        subject: `2. Mahnung - Rechnung ${invoice.number}`,
        salutation: 'Sehr geehrte Damen und Herren',
        body: `trotz unserer ersten Mahnung ist die nachstehende Rechnung noch immer offen. Wir bitten Sie dringend, den Betrag innerhalb von 5 Tagen zu begleichen.

Bei weiterem Zahlungsverzug sehen wir uns leider veranlasst, weitere Massnahmen zu ergreifen.`,
        closing: 'Mit freundlichen Grüssen',
        urgency: 'warning',
        fee: 20.00
      },
      3: {
        title: '3. und letzte Mahnung',
        subject: `Letzte Mahnung - Rechnung ${invoice.number}`,
        salutation: 'Sehr geehrte Damen und Herren',
        body: `dies ist unsere letzte Mahnung für die nachstehende Rechnung. Sollte der offene Betrag nicht innerhalb von 3 Tagen beglichen werden, werden wir ohne weitere Vorankündigung rechtliche Schritte einleiten.

Dies kann zusätzliche Kosten zur Folge haben, die wir Ihnen in Rechnung stellen werden.`,
        closing: 'Hochachtungsvoll',
        urgency: 'danger',
        fee: 50.00
      }
    }

    const template = reminderTemplates[reminderLevel as keyof typeof reminderTemplates]
    const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))

    // Create HTML template for reminder
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${template.title} - ${invoice.number}</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 0; 
          padding: 20mm; 
          font-size: 12px;
          line-height: 1.4;
          color: #333;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e5e5;
        }
        .company-info { flex: 1; }
        .logo { width: 150px; height: 80px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; }
        .reminder-title { 
          font-size: 20px; 
          font-weight: bold; 
          color: ${template.urgency === 'danger' ? '#dc2626' : template.urgency === 'warning' ? '#d97706' : '#2563eb'};
          margin: 30px 0 20px 0;
          text-align: center;
          text-transform: uppercase;
        }
        .customer-address {
          margin: 40px 0;
          line-height: 1.3;
        }
        .reminder-content {
          margin: 30px 0;
          line-height: 1.6;
        }
        .invoice-details {
          margin: 30px 0;
          padding: 20px;
          background-color: #f8f9fa;
          border: 1px solid #ddd;
          border-left: 4px solid ${template.urgency === 'danger' ? '#dc2626' : template.urgency === 'warning' ? '#d97706' : '#2563eb'};
        }
        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .invoice-table th, .invoice-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        .invoice-table th {
          background-color: #f8f9fa;
          font-weight: bold;
        }
        .reminder-fees {
          margin: 20px 0;
          padding: 15px;
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 5px;
        }
        .payment-info {
          margin: 30px 0;
          padding: 20px;
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
        }
        .urgency-${template.urgency} {
          border-left: 4px solid ${template.urgency === 'danger' ? '#dc2626' : template.urgency === 'warning' ? '#d97706' : '#2563eb'};
        }
      </style>
    </head>
    <body>
      <!-- Header with Company Info -->
      <div class="header">
        <div class="company-info">
          <h1>${company.name}</h1>
          <div>${company.address}</div>
          <div>${company.zip} ${company.city}</div>
          <div>Schweiz</div>
          <br>
          <div>E-Mail: ${company.email}</div>
          ${company.phone ? `<div>Tel: ${company.phone}</div>` : ''}
          ${company.uid ? `<div>UID: ${company.uid}</div>` : ''}
        </div>
        <div class="logo">
          ${company.logo_url ? `<img src="${company.logo_url}" alt="Logo" style="max-width: 100%; max-height: 100%;">` : '[LOGO]'}
        </div>
      </div>

      <!-- Customer Address -->
      <div class="customer-address">
        <strong>${invoice.customers.name}</strong><br>
        ${invoice.customers.company ? `${invoice.customers.company}<br>` : ''}
        ${invoice.customers.address}<br>
        ${invoice.customers.zip} ${invoice.customers.city}
      </div>

      <!-- Date and Place -->
      <div style="text-align: right; margin: 20px 0;">
        ${company.city}, ${new Date().toLocaleDateString('de-CH')}
      </div>

      <!-- Reminder Title -->
      <div class="reminder-title">${template.title}</div>

      <!-- Subject Line -->
      <div style="font-weight: bold; margin: 20px 0;">
        Betreff: ${template.subject}
      </div>

      <!-- Reminder Content -->
      <div class="reminder-content">
        <p>${template.salutation},</p>
        <p>${template.body}</p>
      </div>

      <!-- Invoice Details -->
      <div class="invoice-details urgency-${template.urgency}">
        <h3 style="margin-top: 0;">📄 Rechnungsdetails</h3>
        <table class="invoice-table">
          <tr>
            <td><strong>Rechnungsnummer:</strong></td>
            <td>${invoice.number}</td>
          </tr>
          <tr>
            <td><strong>Rechnungsdatum:</strong></td>
            <td>${new Date(invoice.date).toLocaleDateString('de-CH')}</td>
          </tr>
          <tr>
            <td><strong>Fälligkeitsdatum:</strong></td>
            <td>${new Date(invoice.due_date).toLocaleDateString('de-CH')}</td>
          </tr>
          <tr>
            <td><strong>Tage überfällig:</strong></td>
            <td style="color: red; font-weight: bold;">${daysOverdue} Tage</td>
          </tr>
          <tr>
            <td><strong>Offener Betrag:</strong></td>
            <td style="font-size: 14px; font-weight: bold;">CHF ${(invoice.total / 100).toFixed(2)}</td>
          </tr>
        </table>
      </div>

      ${template.fee > 0 ? `
      <!-- Reminder Fees -->
      <div class="reminder-fees">
        <h4 style="margin-top: 0;">💰 Mahngebühren</h4>
        <p>Für diese ${template.title} berechnen wir Ihnen eine Bearbeitungsgebühr von <strong>CHF ${template.fee.toFixed(2)}</strong>.</p>
        <p><strong>Neuer Gesamtbetrag: CHF ${(invoice.total + template.fee).toFixed(2)}</strong></p>
      </div>
      ` : ''}

      <!-- Payment Information -->
      <div class="payment-info">
        <h3 style="margin-top: 0;">💳 Zahlungsinformationen</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <div><strong>IBAN:</strong> ${company.iban || 'CH21 0900 0000 1001 5000 6'}</div>
            <div><strong>Referenz:</strong> ${invoice.qr_reference}</div>
            <div><strong>Betrag:</strong> CHF ${(invoice.total + template.fee).toFixed(2)}</div>
          </div>
          <div>
            <div><strong>Empfänger:</strong> ${company.name}</div>
            <div><strong>Zahlbar bis:</strong> ${new Date(Date.now() + (reminderLevel === 3 ? 3 : reminderLevel === 2 ? 5 : 10) * 24 * 60 * 60 * 1000).toLocaleDateString('de-CH')}</div>
          </div>
        </div>
      </div>

      <!-- Closing -->
      <div style="margin: 40px 0 20px 0;">
        <p>${template.closing}</p>
        <br>
        <p><strong>${company.name}</strong></p>
      </div>

      <!-- Footer -->
      <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; color: #666; text-align: center;">
        ${template.title} generiert am ${new Date().toLocaleDateString('de-CH')} um ${new Date().toLocaleTimeString('de-CH')}
        <br>
        ${reminderLevel === 3 ? '⚠️ LETZTE MAHNUNG - Bei Nichtzahlung erfolgt Inkasso' : `Mahnstufe ${reminderLevel} von 3`}
      </div>
    </body>
    </html>
    `

    // Generate PDF using html-pdf-node
    try {
      const htmlPdf = require('html-pdf-node')
      
      console.log(`Starting reminder PDF generation for invoice: ${invoice.number}, level: ${reminderLevel}`)
      
      const options = {
        format: 'A4',
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '20mm',
          right: '20mm'
        },
        printBackground: true,
        displayHeaderFooter: false,
        timeout: 10000
      }
      
      const file = { content: htmlTemplate }
      
      const pdfBuffer = await htmlPdf.generatePdf(file, options)
      
      console.log('Reminder PDF generated successfully, size:', pdfBuffer.length)
      
      // Send PDF as download
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="Mahnung-${reminderLevel}-${invoice.number}.pdf"`)
      res.setHeader('Content-Length', pdfBuffer.length.toString())
      res.send(pdfBuffer)
      
    } catch (pdfError: any) {
      console.error('Reminder PDF generation error:', pdfError)
      
      // Fallback to HTML
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(htmlTemplate + `
        <br><br>
        <div style="color: red; background: #ffe6e6; padding: 10px; border: 1px solid red; margin: 20px;">
          <strong>PDF Generation Failed:</strong> ${pdfError?.message || 'Unknown error'}<br>
          Showing HTML version instead.
        </div>
      `)
    }

  } catch (error) {
    handleSupabaseError(error, 'generate reminder PDF')
  }
})

/**
 * @desc    Update invoice
 * @route   PUT /api/v1/invoices/:id
 * @access  Private
 */
export const updateInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const invoiceId = req.params.id
  const updateData = req.body

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Check if invoice exists and belongs to company
    const { data: existingInvoice, error: invoiceError } = await db.invoices()
      .select('id, company_id')
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()

    if (invoiceError || !existingInvoice) {
      res.status(404).json({
        success: false,
        error: 'Invoice not found'
      })
      return
    }

    // Prepare update data
    const updateFields: any = {}
    
    if (updateData.status) {
      updateFields.status = updateData.status
    }
    
    if (updateData.customerId) {
      updateFields.customer_id = updateData.customerId
    }
    
    if (updateData.date) {
      updateFields.date = updateData.date
    }
    
    if (updateData.dueDate) {
      updateFields.due_date = updateData.dueDate
    }
    
    if (updateData.discountCode !== undefined) {
      updateFields.discount_code = updateData.discountCode
    }
    
    if (updateData.discountAmount !== undefined) {
      updateFields.discount_amount = updateData.discountAmount
    }
    
    if (updateData.internalNotes !== undefined) {
      updateFields.internal_notes = updateData.internalNotes
    }

    // Update invoice
    const { data: updatedInvoice, error: updateError } = await db.invoices()
      .update(updateFields)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .select('*')
      .single()

    if (updateError) {
      res.status(400).json({
        success: false,
        error: 'Failed to update invoice'
      })
      return
    }

    // If items are provided, update them
    if (updateData.items && Array.isArray(updateData.items)) {
      // Delete existing items
      await db.invoiceItems()
        .delete()
        .eq('invoice_id', invoiceId)

      // Insert new items
      const itemsToInsert = updateData.items.map((item: any, index: number) => ({
        invoice_id: invoiceId,
        description: item.description,
        quantity: Math.round(item.quantity * 1000), // Convert to 3 decimal precision (1.5 = 1500)
        unit: item.unit || 'Stück',
        unit_price: Math.round(item.unitPrice * 100), // Convert CHF to Rappen
        discount: Math.round((item.discount || 0) * 100), // Convert to basis points
        vat_rate: Math.round(item.vatRate * 100), // Convert to basis points
        line_total: Math.round(item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100) * 100), // Convert CHF to Rappen
        vat_amount: Math.round(item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100) * (item.vatRate / 100) * 100), // Convert CHF to Rappen
        sort_order: index
      }))

      const { error: itemsError } = await db.invoiceItems()
        .insert(itemsToInsert)

      if (itemsError) {
        res.status(400).json({
          success: false,
          error: 'Failed to update invoice items'
        })
        return
      }

      // Recalculate totals
      const { data: items } = await db.invoiceItems()
        .select('line_total, vat_amount')
        .eq('invoice_id', invoiceId)

      const subtotal = items?.reduce((sum: number, item: any) => sum + item.line_total, 0) || 0
      const vatAmount = items?.reduce((sum: number, item: any) => sum + item.vat_amount, 0) || 0
      const total = subtotal + vatAmount - (updateData.discountAmount || 0)

      // Update totals
      await db.invoices()
        .update({
          subtotal,
          vat_amount: vatAmount,
          total
        })
        .eq('id', invoiceId)
    }

    res.json({
      success: true,
      data: {
        invoice: createInvoiceResponse(updatedInvoice)
      }
    })
  } catch (error: any) {
    console.error('Error updating invoice:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * @desc    Delete invoice
 * @route   DELETE /api/v1/invoices/:id
 * @access  Private
 */
export const deleteInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Invoice deletion logic would be implemented here
  res.status(501).json({
    success: false,
    error: 'Invoice deletion not implemented yet'
  })
})
