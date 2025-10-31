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
      // Search on direct columns: number and qr_reference
      // PostgREST .or() syntax: "col1.oper.val1,col2.oper.val2"
      console.log('[Invoice Search] Searching for:', search)
      
      // Use same pattern as other controllers: embed % directly in the query string
      // Try both exact match (eq) and partial match (ilike) for QR reference
      query = query.or(`number.ilike.%${search}%,qr_reference.ilike.%${search}%,qr_reference.eq.${search}`)
      
      console.log('[Invoice Search] Query OR clause:', `number.ilike.%${search}%,qr_reference.ilike.%${search}%,qr_reference.eq.${search}`)
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
      console.error('[Invoice Search] Query error:', error)
      handleSupabaseError(error, 'get invoices')
      return
    }

    console.log('[Invoice Search] Found', data?.length || 0, 'invoices (from query)')
    if (search) {
      // Debug: Also try a simple query to see if invoice exists at all
      const { data: debugData } = await db.invoices()
        .select('id, number, qr_reference, company_id')
        .eq('company_id', companyId)
        .eq('qr_reference', search)
        .limit(5)
      console.log('[Invoice Search] Direct QR reference query (exact match):', debugData?.length || 0, 'invoices')
      if (debugData && debugData.length > 0) {
        console.log('[Invoice Search] Direct match invoices:', debugData)
      }
      
      if (data) {
        console.log('[Invoice Search] Invoices from search query with QR references:', data.map((inv: any) => ({
          number: inv.number,
          qr_reference: inv.qr_reference,
          id: inv.id
        })))
      }
    }

    let invoices = (data as any[]).map(invoice => 
      createInvoiceResponse(invoice, invoice.customers, undefined, invoice.invoice_items)
    )

    // Filter by customer name if search didn't match number/qr_reference
    // (PostgREST doesn't support searching joined table columns in .or() queries)
    if (search && invoices.length === 0) {
      // If no results from direct column search, try fetching all and filtering by customer name
      const allQuery = db.invoices()
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
      
      if (status) {
        allQuery.eq('status', status)
      }
      
      const { data: allInvoices } = await allQuery
      
      if (allInvoices) {
        const searchLower = search.toLowerCase()
        invoices = allInvoices
          .filter((inv: any) => 
            inv.customers?.name?.toLowerCase().includes(searchLower) ||
            inv.customers?.company?.toLowerCase().includes(searchLower)
          )
          .slice(0, limit)
          .map((invoice: any) => 
            createInvoiceResponse(invoice, invoice.customers, undefined, invoice.invoice_items)
          )
      }
    }

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

    // Get matched payments for this invoice
    const { data: paymentsData, error: paymentsError } = await db.payments()
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('company_id', companyId)
      .eq('is_matched', true)
      .order('value_date', { ascending: false })

    const invoice = createInvoiceResponse(
      invoiceData,
      invoiceData.customers,
      invoiceData.companies,
      invoiceData.invoice_items
    )

    // Add payments to invoice response
    if (!paymentsError && paymentsData) {
      invoice.payments = paymentsData.map((payment: any) => ({
        id: payment.id,
        invoiceId: payment.invoice_id || undefined,
        companyId: payment.company_id,
        amount: payment.amount, // In Rappen
        valueDate: new Date(payment.value_date),
        reference: payment.reference || undefined,
        description: payment.description || undefined,
        confidence: payment.confidence,
        isMatched: payment.is_matched,
        importBatch: payment.import_batch || undefined,
        createdAt: new Date(payment.created_at),
        updatedAt: new Date(payment.updated_at)
      }))
    } else {
      invoice.payments = []
    }

    // Parse files from internal_notes if present
    if (invoiceData.internal_notes) {
      try {
        const notesData = JSON.parse(invoiceData.internal_notes)
        if (notesData && Array.isArray(notesData.files)) {
          // Generate signed URLs for files
          const filesWithUrls = await Promise.all(
            notesData.files.map(async (file: any) => {
              try {
                const { data: signedUrlData } = await supabaseAdmin.storage
                  .from('invoices')
                  .createSignedUrl(file.filePath, 3600) // 1 hour expiry
                
                return {
                  ...file,
                  downloadUrl: signedUrlData?.signedUrl || null
                }
              } catch (e) {
                console.error('Error generating signed URL for file:', e)
                return {
                  ...file,
                  downloadUrl: null
                }
              }
            })
          )
          ;(invoice as any).files = filesWithUrls
        }
      } catch (e) {
        // If parsing fails, no files
        ;(invoice as any).files = []
      }
    } else {
      ;(invoice as any).files = []
    }

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
        
        // Create organized file path: CompanyName/CustomerName/InvoiceNumber/filename.pdf
        const sanitizeForPath = (name: string) => {
          return name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
        }
        
        const companyName = sanitizeForPath(company.name || 'Company')
        const customerName = sanitizeForPath(invoice.customer?.name || 'Customer')
        const invoiceNumber = sanitizeForPath(invoice.number)
        
        const fileName = `Invoice-${invoice.number}.pdf`
        const filePath = `${companyName}/${customerName}/${invoiceNumber}/${fileName}`
        
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
          
          // Store file reference in internal_notes
          const fileInfo = {
            id: crypto.randomUUID(),
            fileName: fileName,
            filePath: uploadData.path,
            fileType: 'invoice_pdf',
            uploadedAt: new Date().toISOString()
          }
          
          // Get current internal_notes
          const currentNotes = completeInvoice.internal_notes || '{}'
          let notesData: any = {}
          try {
            if (currentNotes && currentNotes.trim() !== '' && currentNotes.trim().startsWith('{')) {
              notesData = JSON.parse(currentNotes)
            }
          } catch (e) {
            notesData = {
              _oldNotes: currentNotes,
              files: []
            }
          }
          
          if (!notesData.files) {
            notesData.files = []
          }
          notesData.files.push(fileInfo)
          
          // Update invoice with file info
          await db.invoices()
            .update({
              internal_notes: JSON.stringify(notesData)
            })
            .eq('id', newInvoice.id)
          
          console.log('📄 PDF file record stored in invoice:', fileInfo)
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
    // Get invoice with customer and company data
    console.log('🔍 Looking up invoice:', { invoiceId, companyId })
    const { data: invoice, error: invoiceError } = await db.invoices()
      .select(`
        *,
        customers (
          id, name, company, email, address, zip, city, country, phone
        )
      `)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()
    
    // Get company data for PDF
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
    
    // Check if invoice is fully paid
    const totalAmount = invoice.total
    const paidAmount = invoice.paid_amount || 0
    const isFullyPaid = paidAmount >= totalAmount
    
    if (isFullyPaid) {
      console.log('❌ Invoice is fully paid, cannot send reminder')
      res.status(400).json({
        success: false,
        error: 'Cannot send reminder for fully paid invoice'
      })
      return
    }
    
    // Check if 1 day has passed since due date (reminder can be sent on the day after due date)
    const dueDate = new Date(invoice.due_date)
    // Set time to start of day for accurate day calculation
    dueDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysSinceDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSinceDue < 1) {
      if (daysSinceDue < 0) {
        const daysUntilDue = Math.abs(daysSinceDue)
        console.log(`❌ Due date hasn't passed yet. ${daysUntilDue} days until due date.`)
        res.status(400).json({
          success: false,
          error: `Reminder can only be sent after the due date has passed. Due date is in ${daysUntilDue + 1} ${daysUntilDue === 0 ? 'day' : 'days'}.`
        })
      } else {
        console.log(`❌ Due date is today. Reminder can be sent tomorrow.`)
        res.status(400).json({
          success: false,
          error: `Reminder can be sent starting 1 day after the due date. Please try again tomorrow.`
        })
      }
      return
    }
    
    console.log(`✅ Invoice eligible for reminder: ${daysSinceDue} days overdue, CHF ${((totalAmount - paidAmount) / 100).toFixed(2)} remaining`)

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

    // Generate reminder PDF with progress bar
    let pdfFilePath: string | null = null
    let pdfBuffer: Buffer | null = null
    try {
      const htmlPdf = require('html-pdf-node')
      const daysSinceDue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
      const totalAmountCHF = invoice.total / 100
      const paidAmountCHF = (invoice.paid_amount || 0) / 100
      const remainingAmountCHF = totalAmountCHF - paidAmountCHF
      const paymentProgress = totalAmountCHF > 0 ? (paidAmountCHF / totalAmountCHF) * 100 : 0
      
      const reminderTemplates = {
        1: {
          title: '1. Mahnung',
          body: `Das Fälligkeitsdatum ist bereits überschritten, und wir haben noch keine vollständige Zahlung erhalten. Wir bitten Sie höflich, den offenen Betrag innerhalb der nächsten 10 Tage zu begleichen.`
        },
        2: {
          title: '2. Mahnung',
          body: `Trotz unserer ersten Mahnung ist die nachstehende Rechnung noch immer nicht vollständig beglichen. Wir bitten Sie dringend, den Betrag innerhalb von 5 Tagen zu begleichen.`
        },
        3: {
          title: '3. und letzte Mahnung',
          body: `Dies ist unsere letzte Mahnung für die nachstehende Rechnung. Sollte der offene Betrag nicht innerhalb von 3 Tagen beglichen werden, werden wir ohne weitere Vorankündigung rechtliche Schritte einleiten.`
        }
      }
      
      const template = reminderTemplates[level as keyof typeof reminderTemplates]
      
      // Generate QR code for payment (using remaining amount)
      const QRCode = require('qrcode')
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
        remainingAmountCHF.toFixed(2), // Amount (remaining amount)
        'CHF', // Currency
        'S', // Debtor address type
        invoice.customers.name, // Debtor name
        invoice.customers.address || '', // Debtor street
        '', // Debtor house number
        invoice.customers.zip || '0000', // Debtor postal code
        invoice.customers.city || '', // Debtor town
        invoice.customers.country || 'CH', // Debtor country
        'QRR', // Reference type (QR Reference)
        invoice.qr_reference, // Payment reference
        `Invoice ${invoice.number} - ${template.title}`, // Additional information
        'EPD' // End Payment Data
      ].join('\n')
      
      const qrCodeImage = await QRCode.toDataURL(qrPayload, {
        type: 'image/png',
        width: 140,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' }
      })
      
      const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${template.title} - ${invoice.number}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 0; 
            font-size: 12px;
            line-height: 1.4;
            color: #333;
          }
          .page-break {
            page-break-before: always;
          }
          .no-break {
            page-break-inside: avoid;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: start;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e5e5;
            page-break-inside: avoid;
          }
          .reminder-title { 
            font-size: 20px; 
            font-weight: bold; 
            color: #2563eb;
            margin: 20px 0 15px 0;
            text-align: center;
            text-transform: uppercase;
            page-break-inside: avoid;
          }
          .customer-address {
            margin: 30px 0;
            line-height: 1.3;
          }
          .reminder-content {
            margin: 25px 0;
            line-height: 1.6;
            page-break-inside: avoid;
          }
          .invoice-details {
            margin: 25px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            border-left: 4px solid #2563eb;
            page-break-inside: avoid;
          }
          .payment-progress {
            margin: 25px 0;
            padding: 15px;
            background-color: #f0f9ff;
            border: 1px solid #0ea5e9;
            border-radius: 8px;
            page-break-inside: avoid;
          }
          .progress-bar-container {
            width: 100%;
            height: 30px;
            background-color: #e5e7eb;
            border-radius: 15px;
            overflow: hidden;
            margin: 15px 0;
            position: relative;
          }
          .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981 0%, #059669 100%);
            border-radius: 15px;
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
          }
          .progress-info {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
            font-size: 11px;
            color: #6b7280;
          }
          .payment-info {
            margin: 25px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <div>
            <h1>${company.name}</h1>
            <div>${company.address}</div>
            <div>${company.zip} ${company.city}</div>
            <div>Schweiz</div>
          </div>
        </div>

        <!-- Customer Address -->
        <div class="customer-address">
          <strong>${invoice.customers.name}</strong><br>
          ${invoice.customers.company ? `${invoice.customers.company}<br>` : ''}
          ${invoice.customers.address}<br>
          ${invoice.customers.zip} ${invoice.customers.city}
        </div>

        <!-- Date -->
        <div style="text-align: right; margin: 20px 0;">
          ${company.city}, ${new Date().toLocaleDateString('de-CH')}
        </div>

        <!-- Reminder Title -->
        <div class="reminder-title">${template.title}</div>

        <!-- Reminder Content -->
        <div class="reminder-content">
          <p>Sehr geehrte Damen und Herren,</p>
          <p>${template.body}</p>
          <p>Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben als gegenstandslos.</p>
        </div>

        <!-- Invoice Details -->
        <div class="invoice-details">
          <h3 style="margin-top: 0;">Rechnungsdetails</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0;"><strong>Rechnungsnummer:</strong></td>
              <td style="padding: 8px 0;">${invoice.number}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Rechnungsdatum:</strong></td>
              <td style="padding: 8px 0;">${new Date(invoice.date).toLocaleDateString('de-CH')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Fälligkeitsdatum:</strong></td>
              <td style="padding: 8px 0;">${new Date(invoice.due_date).toLocaleDateString('de-CH')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Tage überfällig:</strong></td>
              <td style="padding: 8px 0; color: red; font-weight: bold;">${daysSinceDue} Tage</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Rechnungsbetrag:</strong></td>
              <td style="padding: 8px 0; font-weight: bold;">CHF ${totalAmountCHF.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <!-- Payment Progress -->
        <div class="payment-progress">
          <h3 style="margin-top: 0;">Zahlungsstatus</h3>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${Math.min(paymentProgress, 100)}%;">
              ${paymentProgress.toFixed(1)}%
            </div>
          </div>
          <div class="progress-info">
            <span>Bezahlt: <strong>CHF ${paidAmountCHF.toFixed(2)}</strong></span>
            <span>Offen: <strong>CHF ${remainingAmountCHF.toFixed(2)}</strong></span>
          </div>
          <div style="margin-top: 15px; text-align: center; font-weight: bold; color: #dc2626;">
            Offener Betrag: CHF ${remainingAmountCHF.toFixed(2)}
          </div>
        </div>

        <!-- Payment Information -->
        <div class="payment-info">
          <h3>Zahlungsinformationen</h3>
          <p><strong>Zahlbar bis:</strong> ${new Date(Date.now() + (level === 3 ? 3 : level === 2 ? 5 : 10) * 24 * 60 * 60 * 1000).toLocaleDateString('de-CH')}</p>
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
            <div style="width: 62mm; padding: 5mm; border-right: 1px solid #000; font-size: 8pt; position: relative;">
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
                <div style="font-size: 8pt;">${invoice.qr_reference}</div>
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
                <div style="font-weight: bold;">${remainingAmountCHF.toFixed(2)}</div>
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
                  <div style="font-weight: bold; font-size: 10pt;">${remainingAmountCHF.toFixed(2)}</div>
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
                  <div style="font-size: 8pt; word-break: break-all;">${invoice.qr_reference}</div>
                </div>
                
                <div style="margin-bottom: 3mm;">
                  <div style="font-weight: bold; font-size: 6pt;">Zusätzliche Informationen</div>
                  <div style="font-size: 8pt;">Rechnung ${invoice.number}</div>
                  <div style="font-size: 8pt;">${template.title}</div>
                  <div style="font-size: 8pt;">Zahlbar bis: ${new Date(Date.now() + (level === 3 ? 3 : level === 2 ? 5 : 10) * 24 * 60 * 60 * 1000).toLocaleDateString('de-CH')}</div>
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

        <!-- Closing -->
        <div style="margin: 40px 0 20px 0;">
          <p>Freundliche Grüsse</p>
          <br>
          <p><strong>${company.name}</strong></p>
        </div>
      </body>
      </html>
      `
      
      const options = {
        format: 'A4',
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '20mm',
          right: '20mm'
        },
        printBackground: true,
        timeout: 30000
      }
      
      const file = { content: htmlTemplate }
      pdfBuffer = await htmlPdf.generatePdf(file, options)
      
      // Create organized file path: CompanyName/CustomerName/InvoiceNumber/filename.pdf
      // Sanitize names for file paths (remove special characters, spaces become underscores)
      const sanitizeForPath = (name: string) => {
        return name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
      }
      
      const companyName = sanitizeForPath(company.name || 'Company')
      const customerName = sanitizeForPath(invoice.customers.name || 'Customer')
      const invoiceNumber = sanitizeForPath(invoice.number)
      
      const fileName = `Reminder-${level}-${invoice.number}.pdf`
      const filePath = `${companyName}/${customerName}/${invoiceNumber}/${fileName}`
      
      if (!pdfBuffer) {
        throw new Error('Failed to generate PDF buffer')
      }

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('invoices')
        .upload(filePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: false
        })
      
      if (uploadError) {
        console.error('❌ Failed to upload reminder PDF to storage:', uploadError)
      } else {
        pdfFilePath = uploadData.path
        console.log('✅ Reminder PDF uploaded successfully:', pdfFilePath)
        
        // Store file reference in database - we'll use a simple JSON structure in internal_notes
        // TODO: Create invoice_files table for proper file management
        const fileInfo = {
          id: crypto.randomUUID(),
          fileName: fileName,
          filePath: uploadData.path,
          fileType: 'reminder_pdf',
          reminderLevel: level,
          uploadedAt: new Date().toISOString()
        }
        
        // Update invoice with file info (store in internal_notes as JSON for now)
        const currentNotes = invoice.internal_notes || '{}'
        let notesData: any = {}
        try {
          // If notes is not empty and is JSON, parse it
          if (currentNotes && currentNotes.trim() !== '' && currentNotes.trim().startsWith('{')) {
            notesData = JSON.parse(currentNotes)
          }
        } catch (e) {
          // If not JSON, create new structure and preserve old notes as text
          notesData = {
            _oldNotes: currentNotes,
            files: []
          }
        }
        
        if (!notesData.files) {
          notesData.files = []
        }
        notesData.files.push(fileInfo)
        
        await db.invoices()
          .update({
            internal_notes: JSON.stringify(notesData)
          })
          .eq('id', invoiceId)
      }
    } catch (pdfError: any) {
      console.error('❌ Error generating reminder PDF:', pdfError)
      // Continue without PDF - email will still be sent
    }

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
      
      const daysSinceDue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
      const totalAmountCHF = invoice.total / 100
      const paidAmountCHF = (invoice.paid_amount || 0) / 100
      const remainingAmountCHF = totalAmountCHF - paidAmountCHF
      
      const emailData: any = {
        from: 'invoSmart <onboarding@resend.dev>',
        to: [verifiedEmail],
        subject: `${level}. Mahnung - Rechnung ${invoice.number}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Payment Reminder</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #2563eb; margin: 0;">${level}. Mahnung - Rechnung ${invoice.number}</h2>
            </div>
            
            <p>Sehr geehrte Damen und Herren,</p>
            
            <p>Es sind bereits ${daysSinceDue} Tage seit dem Fälligkeitsdatum vergangen, und wir haben noch keine vollständige Zahlung erhalten.</p>
            
            <div style="background: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p><strong>Rechnungsnummer:</strong> ${invoice.number}</p>
              <p><strong>Rechnungsdatum:</strong> ${new Date(invoice.date).toLocaleDateString('de-CH')}</p>
              <p><strong>Fälligkeitsdatum:</strong> ${new Date(invoice.due_date).toLocaleDateString('de-CH')}</p>
              <p><strong>Rechnungsbetrag:</strong> CHF ${totalAmountCHF.toFixed(2)}</p>
              <p><strong>Bezahlt:</strong> CHF ${paidAmountCHF.toFixed(2)}</p>
              <p><strong>Offener Betrag:</strong> <strong style="color: #dc2626;">CHF ${remainingAmountCHF.toFixed(2)}</strong></p>
            </div>
            
            <p>Bitte sehen Sie die beigefügte PDF-Datei für weitere Details.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p>Freundliche Grüsse<br><strong>${company.name}</strong></p>
              <p style="font-size: 12px; color: #6b7280;">
                Test email sent to ${verifiedEmail}
              </p>
            </div>
          </body>
          </html>
        `,
        text: `${level}. Mahnung - Rechnung ${invoice.number}\n\nSehr geehrte Damen und Herren,\n\nEs sind bereits ${daysSinceDue} Tage seit dem Fälligkeitsdatum vergangen, und wir haben noch keine vollständige Zahlung erhalten.\n\nRechnungsnummer: ${invoice.number}\nRechnungsdatum: ${new Date(invoice.date).toLocaleDateString('de-CH')}\nFälligkeitsdatum: ${new Date(invoice.due_date).toLocaleDateString('de-CH')}\nOffener Betrag: CHF ${remainingAmountCHF.toFixed(2)}\n\nBitte sehen Sie die beigefügte PDF-Datei für weitere Details.\n\nFreundliche Grüsse\n${company.name}\n\nTest email sent to ${verifiedEmail}`
      }
      
      // Add PDF attachment if available
      if (pdfBuffer && Buffer.isBuffer(pdfBuffer)) {
        emailData.attachments = [{
          filename: `Mahnung-${level}-${invoice.number}.pdf`,
          content: pdfBuffer
        }]
      }
      
      const result = await resend.emails.send(emailData)

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
  const { id } = req.params
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // First, fetch the invoice to get file information
    const { data: invoice, error: fetchError } = await db.invoices()
      .select('id, internal_notes, number')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        res.status(404).json({
          success: false,
          error: 'Invoice not found'
        })
        return
      }
      handleSupabaseError(fetchError, 'fetch invoice for deletion')
      return
    }

    // Delete files from storage bucket if they exist
    if (invoice && invoice.internal_notes) {
      try {
        const notesData = JSON.parse(invoice.internal_notes)
        if (notesData && Array.isArray(notesData.files) && notesData.files.length > 0) {
          const filePaths = notesData.files
            .map((file: any) => file.filePath)
            .filter((path: string) => path) // Filter out any null/undefined paths

          if (filePaths.length > 0) {
            console.log(`Deleting ${filePaths.length} file(s) for invoice ${invoice.number}:`, filePaths)
            
            const { data: deleteData, error: storageError } = await supabaseAdmin.storage
              .from('invoices')
              .remove(filePaths)

            if (storageError) {
              console.error('Error deleting files from storage:', storageError)
              // Continue with database deletion even if storage deletion fails
              // This prevents orphaned database records if storage cleanup fails
            } else {
              console.log('Successfully deleted files from storage:', deleteData)
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing internal_notes for file deletion:', parseError)
        // Continue with deletion even if parsing fails (might be old format or invalid JSON)
      }
    }

    // Delete invoice from database (CASCADE will handle invoice_items)
    const { error: deleteError } = await db.invoices()
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)

    if (deleteError) {
      handleSupabaseError(deleteError, 'delete invoice')
      return
    }

    console.log(`Invoice ${invoice.number} deleted successfully`)

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting invoice:', error)
    handleSupabaseError(error, 'delete invoice')
  }
})
