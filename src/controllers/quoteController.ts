import { Response } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { db, handleSupabaseError, supabaseAdmin } from '../lib/supabase'
import { Quote, QuoteItem, AuthenticatedRequest } from '../types'
import { config } from '../config'
import { createAuditLog } from './auditController'
import { emailTranslations, getCustomerLanguage } from '../utils/emailTranslations'
import { generateQuotePdfTemplate, SupportedLanguage } from '../utils/pdfTemplates'
import EmailService from '../services/emailService'

// Helper function to convert DB quote to API quote
const createQuoteResponse = (dbQuote: any, customer?: any, company?: any, items?: any[]): Quote => {
  return {
    id: dbQuote.id,
    number: dbQuote.number,
    customerId: dbQuote.customer_id,
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
    companyId: dbQuote.company_id,
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
    date: new Date(dbQuote.date),
    expiryDate: new Date(dbQuote.expiry_date),
    status: dbQuote.status as any,
    subtotal: dbQuote.subtotal / 100,
    vatAmount: dbQuote.vat_amount / 100,
    total: dbQuote.total / 100,
    discountCode: dbQuote.discount_code || undefined,
    discountAmount: dbQuote.discount_amount / 100,
    internalNotes: dbQuote.internal_notes || undefined,
    acceptanceToken: dbQuote.acceptance_token || undefined,
    // Regenerate acceptance link if it's invalid (undefined, null, or starts with "undefined")
    acceptanceLink: (() => {
      const link = dbQuote.acceptance_link
      if (!link || link === 'undefined' || link.startsWith('undefined/')) {
        // Regenerate link if invalid
        if (dbQuote.acceptance_token) {
          const frontendUrl = process.env.FRONTEND_URL || config.frontendUrl || 'http://localhost:5173'
          return `${frontendUrl}/quotes/accept/${dbQuote.acceptance_token}`
        }
        return undefined
      }
      return link
    })(),
    acceptedAt: dbQuote.accepted_at ? new Date(dbQuote.accepted_at) : undefined,
    acceptedByEmail: dbQuote.accepted_by_email || undefined,
    sentAt: dbQuote.sent_at ? new Date(dbQuote.sent_at) : undefined,
    emailSentCount: dbQuote.email_sent_count,
    convertedToInvoiceId: dbQuote.converted_to_invoice_id || undefined,
    convertedAt: dbQuote.converted_at ? new Date(dbQuote.converted_at) : undefined,
    items: items ? items.map(createQuoteItemResponse) : [],
    createdAt: new Date(dbQuote.created_at),
    updatedAt: new Date(dbQuote.updated_at)
  }
}

// Helper function to convert DB quote item to API quote item
const createQuoteItemResponse = (dbItem: any): QuoteItem => {
  return {
    id: dbItem.id,
    quoteId: dbItem.quote_id,
    description: dbItem.description,
    quantity: dbItem.quantity / 1000,
    unit: dbItem.unit,
    unitPrice: dbItem.unit_price / 100,
    discount: dbItem.discount / 100,
    vatRate: dbItem.vat_rate / 100,
    lineTotal: dbItem.line_total / 100,
    vatAmount: dbItem.vat_amount / 100,
    sortOrder: dbItem.sort_order
  }
}

/**
 * @desc    Get all quotes
 * @route   GET /api/v1/quotes
 * @access  Private
 */
export const getQuotes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  const limit = parseInt(req.query.limit as string) || 10
  const offset = parseInt(req.query.offset as string) || 0
  const search = req.query.search as string || ''
  const customerId = req.query.customerId as string || ''

  try {
    let query = db.quotes()
      .select(`
        *,
        customers (*),
        companies (*),
        quote_items (*)
      `)
      .eq('company_id', companyId)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by customer ID if provided
    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    if (search) {
      query = query.or(`number.ilike.%${search}%,customers.name.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      handleSupabaseError(error, 'fetch quotes')
      return
    }

    const quotes = (data as any[]).map(quote => 
      createQuoteResponse(quote, quote.customers, quote.companies, quote.quote_items)
    )

    res.json({
      success: true,
      data: { quotes, total: quotes.length }
    })

  } catch (error) {
    handleSupabaseError(error, 'get quotes')
  }
})

/**
 * @desc    Get quote by ID
 * @route   GET /api/v1/quotes/:id
 * @access  Private
 */
export const getQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const quoteId = req.params.id

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    const { data: quoteData, error: quoteError } = await db.quotes()
      .select(`
        *,
        customers (*),
        companies (*),
        quote_items (*)
      `)
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .single()

    if (quoteError || !quoteData) {
      res.status(404).json({
        success: false,
        error: 'Quote not found'
      })
      return
    }

    const quote = createQuoteResponse(
      quoteData,
      quoteData.customers,
      quoteData.companies,
      quoteData.quote_items
    )

    res.json({
      success: true,
      data: { quote }
    })

  } catch (error) {
    handleSupabaseError(error, 'get quote')
  }
})

/**
 * @desc    Create quote
 * @route   POST /api/v1/quotes
 * @access  Private
 */
export const createQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
    date,
    expiryDate,
    items,
    discountCode,
    discountAmount = 0,
    internalNotes
  } = req.body

  try {
    // Generate quote number
    const { Resend } = require('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    // This would call the SQL function, but for now we'll generate it manually
    const currentYear = new Date().getFullYear()
    const quoteNumber = `AN-${currentYear}-${Date.now().toString().slice(-4)}`

    // Calculate totals
    let subtotal = 0
    const itemsData = []
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const itemSubtotal = item.quantity * item.unitPrice
      const discounted = itemSubtotal * (1 - item.discount / 100)
      const vatAmount = discounted * (item.vatRate / 100)
      const lineTotal = discounted + vatAmount
      
      subtotal += discounted
      
      itemsData.push({
        description: item.description,
        quantity: Math.round(item.quantity * 1000),
        unit: item.unit || 'Stück',
        unit_price: Math.round(item.unitPrice * 100),
        discount: Math.round(item.discount * 100),
        vat_rate: Math.round(item.vatRate * 100),
        line_total: Math.round(lineTotal * 100),
        vat_amount: Math.round(vatAmount * 100),
        sort_order: i + 1
      })
    }

    const vatAmount = itemsData.reduce((sum, item) => sum + item.vat_amount, 0)
    const total = Math.round(subtotal * 100) + vatAmount - Math.round(discountAmount * 100)

    // Generate acceptance token
    const acceptanceToken = Buffer.from(`${companyId}-${Date.now()}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '')
    // Get frontend URL from config (set via FRONTEND_URL env variable)
    // Use environment variable directly with fallback
    const frontendUrl = process.env.FRONTEND_URL || config.frontendUrl || 'http://localhost:5173'
    console.log('[Quote] Generating acceptance link with FRONTEND_URL:', frontendUrl)
    const acceptanceLink = `${frontendUrl}/quotes/accept/${acceptanceToken}`

    // Insert quote
    const { data: quote, error: quoteError } = await db.quotes()
      .insert({
        number: quoteNumber,
        customer_id: customerId,
        company_id: companyId,
        date: typeof date === 'string' ? date : date.toISOString().split('T')[0],
        expiry_date: typeof expiryDate === 'string' ? expiryDate : expiryDate.toISOString().split('T')[0],
        status: 'DRAFT' as any,
        subtotal: Math.round(subtotal * 100),
        vat_amount: vatAmount,
        total: Math.round(total),
        discount_code: discountCode || null,
        discount_amount: Math.round(discountAmount * 100),
        internal_notes: internalNotes || null,
        acceptance_token: acceptanceToken,
        acceptance_link: acceptanceLink,
        email_sent_count: 0
      })
      .select()
      .single()

    if (quoteError) {
      handleSupabaseError(quoteError, 'create quote')
      return
    }

    // Insert quote items
    const quoteItems = itemsData.map(item => ({
      ...item,
      quote_id: quote.id
    }))

    const { error: itemsError } = await db.quoteItems()
      .insert(quoteItems)

    if (itemsError) {
      handleSupabaseError(itemsError, 'create quote items')
      return
    }

    // Fetch complete quote
    const { data: completeQuote, error: fetchError } = await db.quotes()
      .select(`
        *,
        customers (*),
        companies (*),
        quote_items (*)
      `)
      .eq('id', quote.id)
      .single()

    if (fetchError) {
      handleSupabaseError(fetchError, 'fetch quote')
      return
    }

    const fullQuote = createQuoteResponse(
      completeQuote,
      completeQuote.customers,
      completeQuote.companies,
      completeQuote.quote_items
    )

    // Generate and store PDF for the quote
    try {
      const htmlPdf = require('html-pdf-node')
      const QRCode = require('qrcode')
      
      // Generate QR code for the quote acceptance
      const qrCodeImage = await QRCode.toDataURL(fullQuote.acceptanceLink || '', {
        type: 'image/png',
        width: 140,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' }
      })
      
      // Get company data
      const company = completeQuote.companies
      
      // Fetch and convert logo to base64 if available
      let logoBase64 = null
      if (company?.logo_url) {
        try {
          console.log('🔍 Attempting to fetch logo for quote PDF. Logo URL:', company.logo_url)
          
          // Extract path from logo URL - handle different URL formats
          let logoPath = null
          if (company.logo_url.includes('/storage/v1/object/public/logos/')) {
            logoPath = company.logo_url.split('/storage/v1/object/public/logos/')[1].split('?')[0]
          } else if (company.logo_url.includes('/logos/')) {
            logoPath = company.logo_url.split('/logos/')[1].split('?')[0]
          } else if (company.logo_url.startsWith('logos/')) {
            logoPath = company.logo_url.replace('logos/', '').split('?')[0]
          } else {
            logoPath = company.logo_url.split('?')[0]
          }
          
          console.log('📂 Extracted logo path for quote:', logoPath)
          
          if (logoPath) {
            const { data: logoData, error: logoError } = await supabaseAdmin.storage
              .from('logos')
              .download(logoPath)
            
            if (logoError) {
              console.error('❌ Error downloading logo for quote:', logoError)
            } else if (logoData) {
              const logoBuffer = Buffer.from(await logoData.arrayBuffer())
              const logoMimeType = logoData.type || 'image/png'
              logoBase64 = `data:${logoMimeType};base64,${logoBuffer.toString('base64')}`
              console.log('✅ Logo converted to base64 for quote PDF')
            }
          }
        } catch (logoFetchError) {
          console.error('❌ Error fetching logo for quote PDF:', logoFetchError)
        }
      }
      
      // Build quote PDF HTML template
      const quotePDFHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Quote ${fullQuote.number}</title>
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
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 2px solid #e5e5e5;
            }
            .company-info { flex: 1; }
            .logo { width: 100px; height: 100px; background: transparent; display: flex; align-items: center; justify-content: center; padding: 5px; }
            .quote-title { 
              font-size: 24px; 
              font-weight: bold; 
              color: #f59e0b;
              margin: 20px 0;
            }
            .quote-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-bottom: 30px;
            }
            .customer-info { }
            .quote-meta { text-align: right; }
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
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <h1>${company?.name || 'Company'}</h1>
              <div>${company?.address || 'Address'}</div>
              <div>${company?.zip || ''} ${company?.city || 'City'}</div>
              <div>Schweiz</div>
              <br>
              <div>E-Mail: ${company?.email || 'email@company.com'}</div>
              ${company?.phone ? `<div>Tel: ${company.phone}</div>` : ''}
            </div>
            <div class="logo">
              ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-width: 100px; max-height: 100px; width: 100px; height: 100px; object-fit: contain; display: block;">` : ''}
            </div>
          </div>

          <div class="quote-title">Quote ${fullQuote.number}</div>

          <div class="quote-details">
            <div class="customer-info">
              <h3>Quote For:</h3>
              <div><strong>${fullQuote.customer?.name || 'Customer'}</strong></div>
              ${fullQuote.customer?.company ? `<div>${fullQuote.customer.company}</div>` : ''}
              <div>${fullQuote.customer?.address || 'Address'}</div>
              <div>${fullQuote.customer?.zip || ''} ${fullQuote.customer?.city || 'City'}</div>
              <div>${fullQuote.customer?.country || 'CH'}</div>
              ${fullQuote.customer?.email ? `<br><div>E-Mail: ${fullQuote.customer.email}</div>` : ''}
            </div>
            <div class="quote-meta">
              <table>
                <tr><td><strong>Quote Number:</strong></td><td>${fullQuote.number}</td></tr>
                <tr><td><strong>Date:</strong></td><td>${new Date(fullQuote.date).toLocaleDateString('de-CH')}</td></tr>
                <tr><td><strong>Valid Until:</strong></td><td>${new Date(fullQuote.expiryDate).toLocaleDateString('de-CH')}</td></tr>
                <tr><td><strong>Status:</strong></td><td>${fullQuote.status}</td></tr>
              </table>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Price (CHF)</th>
                <th>VAT (%)</th>
                <th>Amount (CHF)</th>
              </tr>
            </thead>
            <tbody>
              ${fullQuote.items.map((item: any, index: number) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.description}</td>
                  <td class="number">${item.quantity.toFixed(3)}</td>
                  <td>${item.unit}</td>
                  <td class="number">${item.unitPrice.toFixed(2)}</td>
                  <td class="number">${item.vatRate.toFixed(1)}%</td>
                  <td class="number">${item.lineTotal.toFixed(2)}</td>
                </tr>
              `).join('') || '<tr><td colspan="7">No items</td></tr>'}
            </tbody>
          </table>

          <div class="totals">
            <table>
              <tr><td>Subtotal:</td><td>CHF ${fullQuote.subtotal.toFixed(2)}</td></tr>
              <tr><td>VAT:</td><td>CHF ${fullQuote.vatAmount.toFixed(2)}</td></tr>
              <tr class="total-row"><td><strong>Total CHF:</strong></td><td><strong>${fullQuote.total.toFixed(2)}</strong></td></tr>
            </table>
          </div>
          
          <!-- Page break for QR Code -->
          <div style="page-break-before: always;"></div>
          
          ${fullQuote.acceptanceLink ? `
          <div style="margin-top: 40px; padding: 20px; background-color: #fef3c7; border: 1px solid #f59e0b;">
            <h3 style="color: #92400e;">Accept Quote</h3>
            <p style="color: #92400e;">Click the link below to accept this quote:</p>
            <p style="font-size: 10px; word-break: break-all; color: #92400e;">${fullQuote.acceptanceLink}</p>
            <div style="margin-top: 20px; text-align: center;">
              <img src="${qrCodeImage}" alt="Accept Quote QR Code" style="width: 140px; height: 140px; border: 1px solid #000;" />
              <p style="font-size: 10px;">Scan to accept quote</p>
            </div>
          </div>
          ` : ''}

          <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #666;">
            Generated on ${new Date().toLocaleDateString('de-CH')} at ${new Date().toLocaleTimeString('de-CH')}
          </div>
        </body>
        </html>
      `
      
      // Generate PDF buffer
      const pdfBuffer = await htmlPdf.generatePdf(
        { content: quotePDFHTML },
        { format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' } }
      )
      
      // Save PDF to Supabase Storage
      const fileName = `quote-${fullQuote.number}-${Date.now()}.pdf`
      const filePath = `${companyId}/${fileName}`
      
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('quotes')
        .upload(filePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: false
        })

      if (uploadError) {
        console.error('❌ Failed to upload quote PDF to storage:', uploadError)
      } else {
        console.log('✅ Quote PDF uploaded successfully:', uploadData.path)
      }
    } catch (pdfError) {
      console.error('❌ Error generating quote PDF:', pdfError)
      // Don't fail the quote creation if PDF generation fails
    }

    // Log audit event
    try {
      await createAuditLog(
        companyId,
        req.user!.id,
        req.user!.name,
        'QUOTE_CREATED',
        'QUOTE',
        fullQuote.id,
        {
          quoteNumber: fullQuote.number,
          customerId: fullQuote.customerId,
          customerName: fullQuote.customer?.name,
          total: fullQuote.total,
          status: fullQuote.status
        },
        req.ip,
        req.get('User-Agent')
      )
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
    }

    res.status(201).json({
      success: true,
      message: 'Quote created successfully',
      data: { quote: fullQuote }
    })

  } catch (error) {
    handleSupabaseError(error, 'create quote')
  }
})

/**
 * @desc    Update quote
 * @route   PUT /api/v1/quotes/:id
 * @access  Private
 */
export const updateQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const quoteId = req.params.id

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  const {
    customerId,
    date,
    expiryDate,
    items,
    discountCode,
    discountAmount = 0,
    internalNotes,
    status
  } = req.body

  try {
    // First, check if quote exists and belongs to company
    const { data: existingQuote, error: quoteError } = await db.quotes()
      .select()
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .single()

    if (quoteError || !existingQuote) {
      res.status(404).json({
        success: false,
        error: 'Quote not found'
      })
      return
    }

    // Only allow edits to DRAFT quotes
    if (existingQuote.status !== 'DRAFT') {
      res.status(400).json({
        success: false,
        error: 'Only draft quotes can be edited'
      })
      return
    }

    // Calculate totals
    let subtotal = 0
    const itemsData = []
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const itemSubtotal = item.quantity * item.unitPrice
      const discounted = itemSubtotal * (1 - item.discount / 100)
      const vatAmount = discounted * (item.vatRate / 100)
      const lineTotal = discounted + vatAmount
      
      subtotal += discounted
      
      itemsData.push({
        description: item.description,
        quantity: Math.round(item.quantity * 1000),
        unit: item.unit || 'Stück',
        unit_price: Math.round(item.unitPrice * 100),
        discount: Math.round(item.discount * 100),
        vat_rate: Math.round(item.vatRate * 100),
        line_total: Math.round(lineTotal * 100),
        vat_amount: Math.round(vatAmount * 100),
        sort_order: i + 1
      })
    }

    const vatAmount = itemsData.reduce((sum, item) => sum + item.vat_amount, 0)
    const total = Math.round(subtotal * 100) + vatAmount - Math.round(discountAmount * 100)

    // Update the quote
    const { data: updatedQuote, error: updateError } = await db.quotes()
      .update({
        customer_id: customerId,
        date: typeof date === 'string' ? date : date.toISOString().split('T')[0],
        expiry_date: typeof expiryDate === 'string' ? expiryDate : expiryDate.toISOString().split('T')[0],
        status: status || existingQuote.status,
        subtotal: Math.round(subtotal * 100),
        vat_amount: vatAmount,
        total: Math.round(total),
        discount_code: discountCode || null,
        discount_amount: Math.round(discountAmount * 100),
        internal_notes: internalNotes || null
      })
      .eq('id', quoteId)
      .select()
      .single()

    if (updateError) {
      handleSupabaseError(updateError, 'update quote')
      return
    }

    // Delete old items
    const { error: deleteItemsError } = await db.quoteItems()
      .delete()
      .eq('quote_id', quoteId)

    if (deleteItemsError) {
      handleSupabaseError(deleteItemsError, 'delete old quote items')
      return
    }

    // Insert new items
    const quoteItems = itemsData.map(item => ({
      ...item,
      quote_id: quoteId
    }))

    const { error: itemsError } = await db.quoteItems()
      .insert(quoteItems)

    if (itemsError) {
      handleSupabaseError(itemsError, 'insert new quote items')
      return
    }

    // Fetch complete updated quote
    const { data: completeQuote, error: fetchError } = await db.quotes()
      .select(`
        *,
        customers (*),
        companies (*),
        quote_items (*)
      `)
      .eq('id', quoteId)
      .single()

    if (fetchError) {
      handleSupabaseError(fetchError, 'fetch updated quote')
      return
    }

    const fullQuote = createQuoteResponse(
      completeQuote,
      completeQuote.customers,
      completeQuote.companies,
      completeQuote.quote_items
    )

    // Log audit event
    try {
      await createAuditLog(
        companyId,
        req.user!.id,
        req.user!.name,
        'QUOTE_UPDATED',
        'QUOTE',
        quoteId,
        {
          quoteNumber: fullQuote.number,
          customerName: fullQuote.customer?.name,
          total: fullQuote.total,
          status: fullQuote.status
        },
        req.ip,
        req.get('User-Agent')
      )
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
    }

    res.json({
      success: true,
      message: 'Quote updated successfully',
      data: { quote: fullQuote }
    })

  } catch (error) {
    handleSupabaseError(error, 'update quote')
  }
})

/**
 * @desc    Update quote status
 * @route   PATCH /api/v1/quotes/:id/status
 * @access  Private
 */
export const updateQuoteStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const quoteId = req.params.id
  const { status } = req.body

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    const { data, error } = await db.quotes()
      .update({ status })
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error || !data) {
      res.status(404).json({
        success: false,
        error: 'Quote not found'
      })
      return
    }

    // Log audit event
    try {
      await createAuditLog(
        companyId,
        req.user!.id,
        req.user!.name,
        'QUOTE_STATUS_UPDATED',
        'QUOTE',
        quoteId,
        {
          quoteNumber: data.number,
          oldStatus: data.status,
          newStatus: status
        },
        req.ip,
        req.get('User-Agent')
      )
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
    }

    res.json({
      success: true,
      message: 'Quote status updated successfully',
      data: { quote: createQuoteResponse(data) }
    })

  } catch (error) {
    handleSupabaseError(error, 'update quote status')
  }
})

/**
 * @desc    Send quote email to customer
 * @route   POST /api/v1/quotes/:id/send
 * @access  Private
 */
export const sendQuoteEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const quoteId = req.params.id

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get quote with customer data
    const { data: quote, error: quoteError } = await db.quotes()
      .select(`
        *,
        customers (*),
        companies (*),
        quote_items (*)
      `)
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .single()

    if (quoteError || !quote) {
      res.status(404).json({
        success: false,
        error: 'Quote not found'
      })
      return
    }

    const fullQuote = createQuoteResponse(quote, quote.customers, quote.companies, quote.quote_items)
    
    // Check if customer has email
    if (!fullQuote.customer?.email) {
      res.status(400).json({
        success: false,
        error: 'Customer has no email address'
      })
      return
    }
    
    // Generate FRESH professional PDF (don't use cached old PDF!)
    console.log('🎨 Generating fresh professional quote PDF...')
    
    // Fetch company logo
    let logoBase64: string | null = null
    if (quote.companies?.logo_url) {
      try {
        let logoPath = quote.companies.logo_url
        if (logoPath.includes('/storage/v1/object/public/logos/')) {
          logoPath = logoPath.split('/storage/v1/object/public/logos/')[1].split('?')[0]
        } else if (logoPath.includes('/logos/')) {
          logoPath = logoPath.split('/logos/')[1].split('?')[0]
        } else if (logoPath.startsWith('logos/')) {
          logoPath = logoPath.replace('logos/', '').split('?')[0]
        }
        
        const { data: logoData, error: logoError } = await supabaseAdmin.storage
          .from('logos')
          .download(logoPath)
          
        if (!logoError && logoData) {
          const logoBuffer = Buffer.from(await logoData.arrayBuffer())
          logoBase64 = `data:${logoData.type || 'image/png'};base64,${logoBuffer.toString('base64')}`
      }
      } catch (err) {
        console.log('⚠️ Could not fetch logo:', err)
    }
    }
    
    // Generate acceptance QR code
    const QRCode = require('qrcode')
    let acceptanceQRCode: string | undefined
    if (fullQuote.acceptanceLink) {
      acceptanceQRCode = await QRCode.toDataURL(fullQuote.acceptanceLink, {
        type: 'image/png',
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' }
      })
    }
    
    // Generate PDF using professional template
    const htmlTemplate = generateQuotePdfTemplate({
      quote: {
        number: fullQuote.number,
        date: fullQuote.date,
        expiryDate: fullQuote.expiryDate,
        subtotal: Math.round(fullQuote.subtotal * 100),
        vatAmount: Math.round(fullQuote.vatAmount * 100),
        total: Math.round(fullQuote.total * 100),
        acceptanceLink: fullQuote.acceptanceLink,
        items: fullQuote.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: Math.round(item.unitPrice * 100),
          vatRate: Math.round(item.vatRate * 100),
          lineTotal: Math.round(item.lineTotal * 100)
        }))
      },
      company: quote.companies,
      customer: quote.customers,
      logoBase64,
      acceptanceQRCode,
      language: (((quote.customers?.language ?? quote.companies?.default_language) ?? 'de') as string).toLowerCase() as SupportedLanguage
    })
    
    const htmlPdf = require('html-pdf-node')
    const pdfBuffer = await htmlPdf.generatePdf(
      { content: htmlTemplate },
      { 
        format: 'A4', 
        preferCSSPageSize: true,
        printBackground: true,
        margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' }
      }
    )
    
    // Upload fresh PDF to storage
    const fileName = `Quote-${fullQuote.number}-${Date.now()}.pdf`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('quotes')
      .upload(`${companyId}/${fileName}`, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })
    
    if (uploadError) {
      console.error('❌ Error uploading fresh PDF:', uploadError)
    } else {
      console.log('✅ Fresh professional PDF generated and uploaded:', fileName)
    }
    
    const pdfPath = `${companyId}/${fileName}`
    
    // Send quote email using professional EmailService
    const emailService = EmailService.getInstance()
    
    const emailResult = await emailService.sendQuoteNotification(
      {
        quote: {
          id: quoteId,
          number: fullQuote.number,
          date: fullQuote.date,
          expiryDate: fullQuote.expiryDate,
          subtotal: Math.round(fullQuote.subtotal * 100),
          vatAmount: Math.round(fullQuote.vatAmount * 100),
          total: Math.round(fullQuote.total * 100),
          acceptanceLink: fullQuote.acceptanceLink
        },
        customer: quote.customers,
        company: quote.companies
      },
      pdfPath
    )
    
    if (emailResult.success) {
      console.log(`✅ Professional quote email sent to ${fullQuote.customer?.email}`)
      
      // Update quote status and sent_at
      await db.quotes()
        .update({
          status: 'SENT' as any,
          sent_at: new Date().toISOString(),
          email_sent_count: (quote.email_sent_count || 0) + 1
        })
        .eq('id', quoteId)
      
      // Log audit event
      try {
        await createAuditLog(
          companyId,
          req.user!.id,
          req.user!.name,
          'QUOTE_SENT',
          'QUOTE',
          quoteId,
          {
            quoteNumber: fullQuote.number,
            customerName: fullQuote.customer?.name,
            customerEmail: fullQuote.customer?.email,
            total: fullQuote.total
          },
          req.ip,
          req.get('User-Agent')
        )
      } catch (auditError) {
        console.error('Error creating audit log:', auditError)
      }
      
      res.json({
        success: true,
        message: 'Quote email sent successfully',
        data: {
          sentTo: fullQuote.customer?.email,
          sentAt: new Date().toISOString(),
          quoteId: quoteId
        }
      })
    } else {
      res.status(500).json({
        success: false,
        error: emailResult.error || 'Failed to send quote email'
      })
    }
  } catch (error) {
    handleSupabaseError(error, 'send quote email')
  }
})


/**
 * @desc    Download quote PDF
 * @route   GET /api/v1/quotes/:id/pdf
 * @access  Private
 */
export const downloadQuotePDF = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const quoteId = req.params.id

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get quote with all related data
    const { data: quoteData, error: quoteError } = await db.quotes()
      .select(`
        *,
        customers (*),
        companies (*),
        quote_items (*)
      `)
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .single()

    if (quoteError || !quoteData) {
      res.status(404).json({
        success: false,
        error: 'Quote not found'
      })
      return
    }

    const quote = createQuoteResponse(quoteData, quoteData.customers, quoteData.companies, quoteData.quote_items)
    
    // Use the professional quote PDF template
    const htmlTemplate = generateQuotePdfTemplate({
      quote: {
        number: quote.number,
        date: quote.date,
        expiryDate: quote.expiryDate,
        subtotal: quote.subtotal,
        vatAmount: quote.vatAmount,
        total: quote.total,
        acceptanceLink: quote.acceptanceLink,
        items: quote.items
      },
      company: quoteData.companies,
      customer: quoteData.customers,
      language: (((quoteData.customers?.language ?? quoteData.companies?.default_language) ?? 'de') as string).toLowerCase() as SupportedLanguage
    })

    // Generate PDF
    const htmlPdf = require('html-pdf-node')
    const pdfBuffer = await htmlPdf.generatePdf(
      { content: htmlTemplate },
      { format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' } }
    )

    // Send PDF as download
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="Quote-${quote.number}.pdf"`)
    res.setHeader('Content-Length', pdfBuffer.length.toString())
    res.send(pdfBuffer)

  } catch (error) {
    handleSupabaseError(error, 'download quote PDF')
  }
})

/**
 * @desc    Delete quote
 * @route   DELETE /api/v1/quotes/:id
 * @access  Private
 */
/**
 * @desc    Get quote by acceptance token (public)
 * @route   GET /api/v1/quotes/token/:token
 * @access  Public
 */
export const getQuoteByToken = asyncHandler(async (req: any, res: Response) => {
  const { token } = req.params

  if (!token) {
    res.status(400).json({
      success: false,
      error: 'Acceptance token is required'
    })
    return
  }

  try {
    // Find quote by acceptance token
    const { data: quoteData, error: quoteError } = await db.quotes()
      .select(`
        *,
        customers (*),
        companies (*),
        quote_items (*)
      `)
      .eq('acceptance_token', token)
      .single()

    if (quoteError || !quoteData) {
      res.status(404).json({
        success: false,
        error: 'Quote not found or invalid token'
      })
      return
    }

    const quote = createQuoteResponse(quoteData, quoteData.customers, quoteData.companies, quoteData.quote_items)

    res.json({
      success: true,
      data: { quote }
    })

  } catch (error) {
    handleSupabaseError(error, 'get quote by token')
  }
})

export const deleteQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const quoteId = req.params.id

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // First, check if quote exists and belongs to company
    const { data: quote, error: quoteError } = await db.quotes()
      .select()
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .single()

    if (quoteError || !quote) {
      res.status(404).json({
        success: false,
        error: 'Quote not found'
      })
      return
    }

    // Delete quote items first (cascade should handle this, but being explicit)
    const { error: itemsError } = await db.quoteItems()
      .delete()
      .eq('quote_id', quoteId)

    if (itemsError) {
      handleSupabaseError(itemsError, 'delete quote items')
      return
    }

    // Get quote data before deletion for audit log
    const quoteNumber = quote.number

    // Delete the quote
    const { error: deleteError } = await db.quotes()
      .delete()
      .eq('id', quoteId)
      .eq('company_id', companyId)

    if (deleteError) {
      handleSupabaseError(deleteError, 'delete quote')
      return
    }

    // Log audit event
    try {
      await createAuditLog(
        companyId,
        req.user!.id,
        req.user!.name,
        'QUOTE_DELETED',
        'QUOTE',
        quoteId,
        {
          quoteNumber: quoteNumber
        },
        req.ip,
        req.get('User-Agent')
      )
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
    }

    res.json({
      success: true,
      message: 'Quote deleted successfully'
    })

  } catch (error) {
    handleSupabaseError(error, 'delete quote')
  }
})

/**
 * @desc    Regenerate acceptance link for a quote
 * @route   POST /api/v1/quotes/:id/regenerate-link
 * @access  Private
 */
export const regenerateAcceptanceLink = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const quoteId = req.params.id

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get existing quote
    const { data: quoteData, error: quoteError } = await db.quotes()
      .select('id, acceptance_token, company_id')
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .single()

    if (quoteError || !quoteData) {
      res.status(404).json({
        success: false,
        error: 'Quote not found'
      })
      return
    }

    // Check if quote has already been accepted
    const { data: fullQuote } = await db.quotes()
      .select('status')
      .eq('id', quoteId)
      .single()

    if (fullQuote?.status === 'ACCEPTED' || fullQuote?.status === 'CONVERTED') {
      res.status(400).json({
        success: false,
        error: 'Cannot regenerate link for already accepted quote'
      })
      return
    }

    // Generate new acceptance token if needed, or reuse existing one
    let acceptanceToken = quoteData.acceptance_token
    if (!acceptanceToken) {
      acceptanceToken = Buffer.from(`${companyId}-${Date.now()}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '')
    }

    // Generate new acceptance link
    const frontendUrl = process.env.FRONTEND_URL || config.frontendUrl || 'http://localhost:5173'
    const acceptanceLink = `${frontendUrl}/quotes/accept/${acceptanceToken}`

    // Update quote with new link (and token if it was missing)
    const updateData: any = {
      acceptance_link: acceptanceLink
    }
    if (!quoteData.acceptance_token) {
      updateData.acceptance_token = acceptanceToken
    }

    const { data: updatedQuote, error: updateError } = await db.quotes()
      .update(updateData)
      .eq('id', quoteId)
      .select()
      .single()

    if (updateError) {
      handleSupabaseError(updateError, 'regenerate acceptance link')
      return
    }

    res.json({
      success: true,
      message: 'Acceptance link regenerated successfully',
      data: {
        acceptanceLink,
        acceptanceToken
      }
    })

  } catch (error) {
    handleSupabaseError(error, 'regenerate acceptance link')
  }
})

/**
 * @desc    Accept quote (public endpoint, converts to invoice)
 * @route   POST /api/v1/quotes/accept/:token
 * @access  Public
 */
export const acceptQuote = asyncHandler(async (req: any, res: Response) => {
  const { token } = req.params
  const { customerEmail } = req.body

  if (!token) {
    res.status(400).json({
      success: false,
      error: 'Acceptance token is required'
    })
    return
  }

  try {
    // Find quote by acceptance token
    const { data: quoteData, error: quoteError } = await db.quotes()
      .select(`
        *,
        customers (*),
        companies (*),
        quote_items (*)
      `)
      .eq('acceptance_token', token)
      .single()

    if (quoteError || !quoteData) {
      res.status(404).json({
        success: false,
        error: 'Quote not found or invalid token'
      })
      return
    }

    // Check if quote has already been accepted
    if (quoteData.status === 'ACCEPTED' || quoteData.status === 'CONVERTED') {
      res.status(400).json({
        success: false,
        error: 'This quote has already been accepted'
      })
      return
    }

    // Check if quote has expired
    const expiryDate = new Date(quoteData.expiry_date)
    if (new Date() > expiryDate) {
      // Update status to expired
      await db.quotes()
        .update({ status: 'EXPIRED' as any })
        .eq('id', quoteData.id)

      res.status(400).json({
        success: false,
        error: 'This quote has expired'
      })
      return
    }

    // Convert quote to invoice
    const quote = createQuoteResponse(quoteData, quoteData.customers, quoteData.companies, quoteData.quote_items)

    // Generate invoice number and QR reference
    const generateInvoiceNumber = require('../lib/supabase').generateInvoiceNumber
    const generateQRReference = require('../lib/supabase').generateQRReference
    
    const invoiceNumber = await generateInvoiceNumber(quoteData.company_id)
    const qrReference = await generateQRReference(invoiceNumber, quoteData.company_id)

    // Calculate due date based on customer payment terms
    const quoteDateObj = quote.date instanceof Date ? quote.date : new Date(quote.date)
    const customerPaymentTerms = quote.customer?.paymentTerms || 30
    const dueDate = new Date(quoteDateObj.getTime() + customerPaymentTerms * 24 * 60 * 60 * 1000)

    // Prepare invoice data (using values from quote)
    const invoiceDate = quote.date instanceof Date ? quote.date.toISOString().split('T')[0] : quote.date
    const invoiceData = {
      company_id: quoteData.company_id,
      customer_id: quoteData.customer_id,
      number: invoiceNumber,
      qr_reference: qrReference,
      status: 'OPEN' as any, // OPEN status means sent to customer, awaiting payment
      date: invoiceDate,
      service_date: invoiceDate, // Service date required for VAT reporting - use invoice date
      due_date: dueDate.toISOString().split('T')[0],
      subtotal: Math.round(quote.subtotal * 100), // Already in Rappen
      vat_amount: Math.round(quote.vatAmount * 100),
      total: Math.round(quote.total * 100),
      paid_amount: 0,
      reminder_level: 0,
      email_sent_count: 0,
      discount_code: quote.discountCode || null,
      discount_amount: Math.round(quote.discountAmount * 100)
    }

    // Create the invoice
    const { data: newInvoice, error: invoiceError } = await db.invoices()
      .insert(invoiceData)
      .select()
      .single()

    if (invoiceError || !newInvoice) {
      handleSupabaseError(invoiceError, 'create invoice from quote')
      return
    }

    // Create invoice items from quote items
    if (quote.items && quote.items.length > 0) {
      const invoiceItems = quote.items.map((item, index) => ({
        invoice_id: newInvoice.id,
        description: item.description,
        quantity: Math.round(item.quantity * 1000),
        unit: item.unit,
        unit_price: Math.round(item.unitPrice * 100),
        discount: Math.round(item.discount * 100),
        vat_rate: Math.round(item.vatRate * 100),
        line_total: Math.round(item.lineTotal * 100),
        vat_amount: Math.round(item.vatAmount * 100),
        sort_order: index + 1
      }))

      const { error: itemsError } = await db.invoiceItems()
        .insert(invoiceItems)

      if (itemsError) {
        // Cleanup: delete invoice if items creation fails
        await db.invoices().delete().eq('id', newInvoice.id)
        handleSupabaseError(itemsError, 'create invoice items from quote')
        return
      }
    }

    // Update quote status to CONVERTED and link to invoice
    const { error: updateError } = await db.quotes()
      .update({
        status: 'CONVERTED' as any,
        converted_to_invoice_id: newInvoice.id,
        converted_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        accepted_by_email: customerEmail || null
      })
      .eq('id', quoteData.id)

    if (updateError) {
      handleSupabaseError(updateError, 'update quote status')
      return
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
      handleSupabaseError(fetchError, 'fetch converted invoice')
      return
    }

    // Send email notification with both quote and invoice PDFs
    try {
      const customerEmailToUse = customerEmail || quote.customer?.email
      
      if (customerEmailToUse) {
        const { Resend } = require('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        
        // Get company data first
        const { data: company, error: companyError } = await db.companies()
          .select('*')
          .eq('id', quoteData.company_id)
          .single()
        
        // Fetch and convert logo to base64 if available
        let logoBase64 = null
        if (company?.logo_url) {
          try {
            console.log('🔍 Attempting to fetch logo for accept quote PDFs. Logo URL:', company.logo_url)
            
            // Extract path from logo URL - handle different URL formats
            let logoPath = null
            if (company.logo_url.includes('/storage/v1/object/public/logos/')) {
              logoPath = company.logo_url.split('/storage/v1/object/public/logos/')[1].split('?')[0]
            } else if (company.logo_url.includes('/logos/')) {
              logoPath = company.logo_url.split('/logos/')[1].split('?')[0]
            } else if (company.logo_url.startsWith('logos/')) {
              logoPath = company.logo_url.replace('logos/', '').split('?')[0]
            } else {
              logoPath = company.logo_url.split('?')[0]
            }
            
            console.log('📂 Extracted logo path for accept quote:', logoPath)
            
            if (logoPath) {
              const { data: logoData, error: logoError } = await supabaseAdmin.storage
                .from('logos')
                .download(logoPath)
              
              if (logoError) {
                console.error('❌ Error downloading logo for accept quote:', logoError)
              } else if (logoData) {
                const logoBuffer = Buffer.from(await logoData.arrayBuffer())
                const logoMimeType = logoData.type || 'image/png'
                logoBase64 = `data:${logoMimeType};base64,${logoBuffer.toString('base64')}`
                console.log('✅ Logo converted to base64 for accept quote PDFs')
              }
            }
          } catch (logoFetchError) {
            console.error('❌ Error fetching logo for accept quote PDFs:', logoFetchError)
          }
        }
        
        // Generate quote PDF on-the-fly for attachment
        const htmlPdfQuote = require('html-pdf-node')
        const QRCodeQuote = require('qrcode')
        
        const quoteQrCodeImage = await QRCodeQuote.toDataURL(quote.acceptanceLink || '', {
          type: 'image/png',
          width: 140,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' }
        })
        
        // Generate Swiss QR code for invoice
        const htmlPdf = require('html-pdf-node')
        const QRCode = require('qrcode')
        
        const qrPayload = [
          'SPC', // Swiss Payments Code
          '0200', // Version
          '1', // Coding (UTF-8)
          company?.iban || 'CH2109000000100015000.6',
          'S', // Creditor address type
          company?.name || 'Company',
          company?.address || '',
          '', // Creditor house number
          company?.zip || '',
          company?.city || '',
          'CH', // Creditor country
          '', '', '', '', '', '', '',
          (completeInvoice.total / 100).toFixed(2), // Amount
          'CHF',
          'S', // Debtor address type
          quote.customer?.name || 'Customer',
          quote.customer?.address || '',
          '',
          quote.customer?.zip || '',
          quote.customer?.city || '',
          quote.customer?.country || 'CH',
          'QRR',
          completeInvoice.qr_reference,
          `Invoice ${completeInvoice.number}`,
          'EPD'
        ].join('\n')
        
        const qrCodeImage = await QRCode.toDataURL(qrPayload, {
          type: 'image/png',
          width: 140,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' }
        })
        
        // Professional invoice HTML template (similar to the main invoice PDF)
        const invoiceHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Invoice ${completeInvoice.number}</title>
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
                margin-bottom: 40px;
                padding-bottom: 20px;
                border-bottom: 2px solid #e5e5e5;
              }
              .company-info { flex: 1; }
              .logo { width: 100px; height: 100px; background: transparent; display: flex; align-items: center; justify-content: center; padding: 5px; }
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
            </style>
          </head>
          <body>
            <div class="header">
              <div class="company-info">
                <h1>${company?.name || 'Company'}</h1>
                <div>${company?.address || 'Address'}</div>
                <div>${company?.zip || ''} ${company?.city || 'City'}</div>
                <div>Schweiz</div>
                <br>
                <div>E-Mail: ${company?.email || 'email@company.com'}</div>
                ${company?.phone ? `<div>Tel: ${company.phone}</div>` : ''}
                ${company?.iban ? `<div>IBAN: ${company.iban}</div>` : ''}
              </div>
              <div class="logo">
                ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-width: 100px; max-height: 100px; width: 100px; height: 100px; object-fit: contain; display: block;">` : ''}
              </div>
            </div>

            <div class="invoice-title">Invoice ${completeInvoice.number}</div>

            <div class="invoice-details">
              <div class="customer-info">
                <h3>Bill To:</h3>
                <div><strong>${quote.customer?.name || 'Customer'}</strong></div>
                ${quote.customer?.company ? `<div>${quote.customer.company}</div>` : ''}
                <div>${quote.customer?.address || 'Address'}</div>
                <div>${quote.customer?.zip || ''} ${quote.customer?.city || 'City'}</div>
                <div>${quote.customer?.country || 'CH'}</div>
                ${quote.customer?.email ? `<br><div>E-Mail: ${quote.customer.email}</div>` : ''}
              </div>
              <div class="invoice-meta">
                <table>
                  <tr><td><strong>Invoice Number:</strong></td><td>${completeInvoice.number}</td></tr>
                  <tr><td><strong>Date:</strong></td><td>${new Date(completeInvoice.date).toLocaleDateString('de-CH')}</td></tr>
                  <tr><td><strong>Due Date:</strong></td><td>${new Date(completeInvoice.due_date).toLocaleDateString('de-CH')}</td></tr>
                  <tr><td><strong>QR Reference:</strong></td><td>${completeInvoice.qr_reference}</td></tr>
                </table>
              </div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Price (CHF)</th>
                  <th>VAT (%)</th>
                  <th>Amount (CHF)</th>
                </tr>
              </thead>
              <tbody>
                ${completeInvoice.invoice_items?.map((item: any, index: number) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${item.description}</td>
                    <td class="number">${(item.quantity / 1000).toFixed(3)}</td>
                    <td>${item.unit}</td>
                    <td class="number">${(item.unit_price / 100).toFixed(2)}</td>
                    <td class="number">${(item.vat_rate / 100).toFixed(1)}%</td>
                    <td class="number">${(item.line_total / 100).toFixed(2)}</td>
                  </tr>
                `).join('') || '<tr><td colspan="7">No items</td></tr>'}
              </tbody>
            </table>

            <div class="totals">
              <table>
                <tr><td>Subtotal:</td><td>CHF ${(completeInvoice.subtotal / 100).toFixed(2)}</td></tr>
                ${completeInvoice.discount_amount > 0 ? `<tr><td>Discount:</td><td>CHF -${(completeInvoice.discount_amount / 100).toFixed(2)}</td></tr>` : ''}
                <tr><td>VAT:</td><td>CHF ${(completeInvoice.vat_amount / 100).toFixed(2)}</td></tr>
                <tr class="total-row"><td><strong>Total CHF:</strong></td><td><strong>${(completeInvoice.total / 100).toFixed(2)}</strong></td></tr>
              </table>
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
                    <div>${company?.iban || 'CH21 0900 0000 1001 5000 6'}</div>
                    <div>${company?.name || 'Company'}</div>
                    <div>${company?.address || 'Address'}</div>
                    <div>${company?.zip || ''} ${company?.city || 'City'}</div>
                  </div>
                  
                  <div style="margin-bottom: 3mm;">
                    <div style="font-weight: bold; font-size: 6pt;">Referenz</div>
                    <div style="font-size: 8pt;">${completeInvoice.qr_reference}</div>
                  </div>
                  
                  <div style="margin-bottom: 3mm;">
                    <div style="font-weight: bold; font-size: 6pt;">Zahlbar durch</div>
                    <div>${quote.customer?.name || 'Customer'}</div>
                    ${quote.customer?.company ? `<div>${quote.customer.company}</div>` : ''}
                    <div>${quote.customer?.address || 'Address'}</div>
                    <div>${quote.customer?.zip || ''} ${quote.customer?.city || 'City'}</div>
                  </div>
                  
                  <div style="position: absolute; bottom: 5mm; left: 5mm;">
                    <div style="font-weight: bold; font-size: 6pt;">Währung</div>
                    <div>CHF</div>
                  </div>
                  
                  <div style="position: absolute; bottom: 5mm; left: 20mm;">
                    <div style="font-weight: bold; font-size: 6pt;">Betrag</div>
                    <div style="font-weight: bold;">${(completeInvoice.total / 100).toFixed(2)}</div>
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
                      <div style="font-weight: bold; font-size: 10pt;">${(completeInvoice.total / 100).toFixed(2)}</div>
                    </div>
                    
                    <div style="margin-bottom: 3mm;">
                      <div style="font-weight: bold; font-size: 6pt;">Konto / Payable to</div>
                      <div>${company?.iban || 'CH21 0900 0000 1001 5000 6'}</div>
                      <div>${company?.name || 'Company'}</div>
                      <div>${company?.address || 'Address'}</div>
                      <div>${company?.zip || ''} ${company?.city || 'City'}</div>
                    </div>
                    
                    <div style="margin-bottom: 3mm;">
                      <div style="font-weight: bold; font-size: 6pt;">Referenz</div>
                      <div style="font-size: 8pt; word-break: break-all;">${completeInvoice.qr_reference}</div>
                    </div>
                    
                    <div style="margin-bottom: 3mm;">
                      <div style="font-weight: bold; font-size: 6pt;">Zusätzliche Informationen</div>
                      <div style="font-size: 8pt;">Rechnung ${completeInvoice.number}</div>
                      <div style="font-size: 8pt;">Fällig: ${new Date(completeInvoice.due_date).toLocaleDateString('de-CH')}</div>
                    </div>
                    
                    <div>
                      <div style="font-weight: bold; font-size: 6pt;">Zahlbar durch</div>
                      <div>${quote.customer?.name || 'Customer'}</div>
                      ${quote.customer?.company ? `<div>${quote.customer.company}</div>` : ''}
                      <div>${quote.customer?.address || 'Address'}</div>
                      <div>${quote.customer?.zip || ''} ${quote.customer?.city || 'City'}</div>
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
              Generated on ${new Date().toLocaleDateString('de-CH')} at ${new Date().toLocaleTimeString('de-CH')}
            </div>
          </body>
          </html>
        `
        
        // Build quote PDF HTML
        const quotePDFHTML = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8"><title>Quote ${quote.number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 12px; color: #333; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e5e5; }
            .company-info { flex: 1; }
            .logo { width: 100px; height: 100px; background: transparent; display: flex; align-items: center; justify-content: center; padding: 5px; }
            .quote-title { font-size: 24px; font-weight: bold; color: #f59e0b; margin: 20px 0; }
            .quote-details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
            .items-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .items-table th { background-color: #f8f9fa; font-weight: bold; }
            .items-table .number { text-align: right; }
            .totals { margin-top: 20px; text-align: right; }
            .totals table { margin-left: auto; border-collapse: collapse; }
            .totals td { padding: 5px 15px; border-bottom: 1px solid #eee; }
            .totals .total-row { font-weight: bold; font-size: 14px; border-top: 2px solid #333; }
          </style>
          </head>
          <body>
            <div class="header">
              <div class="company-info"><h1>${company?.name || 'Company'}</h1>
                <div>${company?.address || 'Address'}</div>
                <div>${company?.zip || ''} ${company?.city || 'City'}</div><div>Schweiz</div><br>
                <div>E-Mail: ${company?.email || 'email@company.com'}</div>
                ${company?.phone ? `<div>Tel: ${company.phone}</div>` : ''}
              </div>
              <div class="logo">
                ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-width: 100px; max-height: 100px; width: 100px; height: 100px; object-fit: contain; display: block;">` : ''}
              </div>
            </div>
            <div class="quote-title">Quote ${quote.number}</div>
            <div class="quote-details">
              <div class="customer-info"><h3>Quote For:</h3>
                <div><strong>${quote.customer?.name || 'Customer'}</strong></div>
                ${quote.customer?.company ? `<div>${quote.customer.company}</div>` : ''}
                <div>${quote.customer?.address || 'Address'}</div>
                <div>${quote.customer?.zip || ''} ${quote.customer?.city || 'City'}</div>
                <div>${quote.customer?.country || 'CH'}</div>
              </div>
              <div class="quote-meta">
                <table>
                  <tr><td><strong>Quote Number:</strong></td><td>${quote.number}</td></tr>
                  <tr><td><strong>Date:</strong></td><td>${new Date(quote.date).toLocaleDateString('de-CH')}</td></tr>
                  <tr><td><strong>Valid Until:</strong></td><td>${new Date(quote.expiryDate).toLocaleDateString('de-CH')}</td></tr>
                </table>
              </div>
            </div>
            <table class="items-table">
              <thead><tr><th>Pos.</th><th>Description</th><th>Quantity</th><th>Unit</th><th>Price (CHF)</th><th>Amount (CHF)</th></tr></thead>
              <tbody>
                ${quote.items.map((item: any, index: number) => `
                  <tr><td>${index + 1}</td><td>${item.description}</td><td class="number">${item.quantity.toFixed(3)}</td><td>${item.unit}</td>
                  <td class="number">${item.unitPrice.toFixed(2)}</td><td class="number">${item.lineTotal.toFixed(2)}</td></tr>
                `).join('')}
              </tbody>
            </table>
            <div class="totals"><table>
              <tr><td>Subtotal:</td><td>CHF ${quote.subtotal.toFixed(2)}</td></tr>
              <tr><td>VAT:</td><td>CHF ${quote.vatAmount.toFixed(2)}</td></tr>
              <tr class="total-row"><td><strong>Total CHF:</strong></td><td><strong>${quote.total.toFixed(2)}</strong></td></tr>
            </table></div>
          </body></html>
        `
        
        // Generate both PDFs
        const quotePdfBuffer = await htmlPdfQuote.generatePdf(
          { content: quotePDFHTML },
          { format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' } }
        )
        
        const invoicePdfBuffer = await htmlPdf.generatePdf(
          { content: invoiceHTML },
          { format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' } }
        )
        
        // Send professional email with both PDF attachments
        const emailResult = await resend.emails.send({
          from: `${company?.name || config.email.fromName} <${config.email.fromEmail}>`,
          to: [customerEmailToUse],
          subject: `Invoice ${completeInvoice.number} - Payment Request`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Invoice ${completeInvoice.number}</h1>
                  <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 14px;">Payment Request</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                  <p style="font-size: 16px; margin-bottom: 20px;">Dear ${quote.customer?.name},</p>
                  
                  <p style="font-size: 16px; color: #555; margin-bottom: 30px;">
                    Thank you for accepting our quote! We're pleased to confirm that your order has been processed and your invoice is ready.
                  </p>
                  
                  <!-- Invoice Summary -->
                  <div style="background: #f8f9fa; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0; border-radius: 6px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
                      <div>
                        <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">Invoice Number:</strong></p>
                        <p style="margin: 8px 0; font-size: 18px; font-weight: bold; color: #2563eb;">${completeInvoice.number}</p>
                      </div>
                      <div>
                        <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">Total Amount:</strong></p>
                        <p style="margin: 8px 0; font-size: 18px; font-weight: bold; color: #22c55e;">CHF ${(completeInvoice.total / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">Issue Date:</strong></p>
                        <p style="margin: 8px 0;">${new Date(completeInvoice.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                      <div>
                        <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">Due Date:</strong></p>
                        <p style="margin: 8px 0; color: #dc2626;">${new Date(completeInvoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                    </div>
                  </div>
                  
                  <!-- PDF Attachment Info -->
                  <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px; margin: 30px 0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">
                      📎 Invoice PDF Attached
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #1e3a8a;">
                      Please find your detailed invoice in the attached PDF file. The PDF includes all line items, totals, and payment information including a Swiss QR code for easy payment.
                    </p>
                  </div>
                  
                  <!-- Payment Info -->
                  <div style="background: #fff7ed; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 6px;">
                    <h3 style="margin: 0 0 15px 0; color: #92400e;">Payment Information</h3>
                    <p style="margin: 8px 0; font-size: 14px;"><strong>QR Reference:</strong> ${completeInvoice.qr_reference}</p>
                    <p style="margin: 8px 0; font-size: 14px; color: #555;">
                      You can pay this invoice using the QR code in the attached PDF, or by bank transfer using the reference number above.
                    </p>
                  </div>
                  
                  <!-- Next Steps -->
                  <div style="margin: 30px 0;">
                    <h3 style="margin-bottom: 15px; color: #333;">Next Steps</h3>
                    <ol style="padding-left: 20px; color: #555;">
                      <li style="margin-bottom: 10px;">Review the attached invoice PDF</li>
                      <li style="margin-bottom: 10px;">Make payment by ${new Date(completeInvoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</li>
                      <li style="margin-bottom: 10px;">Use the QR code or reference number for payment</li>
                    </ol>
                  </div>
                  
                  <p style="font-size: 16px; margin-top: 30px;">
                    If you have any questions, please don't hesitate to contact us.
                  </p>
                  
                  <p style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                    Best regards,<br>
                    <strong style="color: #2563eb; font-size: 16px;">${company?.name || 'Your Team'}</strong><br>
                    ${company?.email || ''}
                  </p>
                </div>
                
                <!-- Footer -->
                <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; font-size: 12px; color: #999;">
                    This is an automated email. Please do not reply to this message.
                  </p>
                  <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                    © ${new Date().getFullYear()} ${company?.name || 'Company'}. All rights reserved.
                  </p>
                </div>
              </div>
            </body>
            </html>
          `,
          attachments: [
            {
              filename: `Quote-${quote.number}.pdf`,
              content: quotePdfBuffer
            },
            {
              filename: `Invoice-${completeInvoice.number}.pdf`,
              content: invoicePdfBuffer
            }
          ]
        })
        
        console.log('✅ Invoice email sent to:', customerEmailToUse)
      }
    } catch (emailError) {
      console.error('❌ Failed to send invoice email:', emailError)
      // Don't fail the acceptance if email fails
    }

    // Log audit event (public endpoint - use customer email as identifier)
    try {
      await createAuditLog(
        quoteData.company_id,
        '00000000-0000-0000-0000-000000000000' as any, // Placeholder UUID for public actions
        customerEmail || quote.customer?.email || 'Customer',
        'QUOTE_ACCEPTED',
        'QUOTE',
        quoteData.id,
        {
          quoteNumber: quote.number,
          invoiceNumber: completeInvoice.number,
          customerName: quote.customer?.name,
          customerEmail: customerEmail || quote.customer?.email,
          total: quote.total
        },
        req.ip,
        req.get('User-Agent')
      )
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
    }

    res.json({
      success: true,
      message: 'Quote accepted and converted to invoice successfully',
      data: {
        quote: quote,
        invoice: completeInvoice
      }
    })

  } catch (error) {
    handleSupabaseError(error, 'accept quote')
  }
})



