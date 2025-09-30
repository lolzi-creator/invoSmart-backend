import { Request, Response } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { AuthenticatedRequest } from '../middleware/auth'
import {
  Payment,
  MatchConfidence,
  ApiResponse
} from '../types'
import { 
  db, 
  handleSupabaseError, 
  DatabasePayment,
  DatabaseInvoice
} from '../lib/supabase'

// Helper function to convert DB payment to API payment
const createPaymentResponse = (dbPayment: DatabasePayment): Payment => {
  return {
    id: dbPayment.id,
    invoiceId: dbPayment.invoice_id || undefined,
    companyId: dbPayment.company_id,
    amount: dbPayment.amount,
    valueDate: new Date(dbPayment.value_date),
    reference: dbPayment.reference || undefined,
    description: dbPayment.description || undefined,
    confidence: dbPayment.confidence as MatchConfidence,
    isMatched: dbPayment.is_matched,
    importBatch: dbPayment.import_batch || undefined,
    rawData: dbPayment.raw_data,
    notes: dbPayment.notes || undefined,
    createdAt: new Date(dbPayment.created_at),
    updatedAt: new Date(dbPayment.updated_at)
  }
}

// Helper function for payment matching
const findMatchingInvoice = async (
  payment: DatabasePayment, 
  companyId: string
): Promise<{ invoice?: DatabaseInvoice, confidence: MatchConfidence }> => {
  // 1. Try exact QR reference match (highest confidence)
  if (payment.reference) {
    const cleanReference = payment.reference.replace(/\s/g, '')
    console.log('Looking for QR match:', {
      paymentReference: cleanReference,
      companyId: companyId
    })

    // Debug: Let's see what invoices exist
    const { data: allInvoices } = await db.invoices()
      .select('id, number, qr_reference, total')
      .eq('company_id', companyId)
    
    console.log('Available invoices for matching:', allInvoices?.map(inv => ({
      number: inv.number,
      qr_reference: inv.qr_reference,
      total: inv.total
    })))
    
    const { data: qrInvoices, error: qrError } = await db.invoices()
      .select('*')
      .eq('company_id', companyId)
      .eq('qr_reference', cleanReference)

    console.log('QR search result:', {
      found: qrInvoices && qrInvoices.length > 0,
      error: qrError?.message,
      count: qrInvoices?.length || 0,
      invoiceNumbers: qrInvoices?.map(inv => inv.number) || []
    })

    if (qrInvoices && qrInvoices.length > 0) {
      const qrInvoice = qrInvoices[0] // Take the first match
      console.log('HIGH confidence match found:', qrInvoice.number)
      return { invoice: qrInvoice as DatabaseInvoice, confidence: 'HIGH' as MatchConfidence }
    }
  }

  // 2. Try amount + date match (medium confidence)
  const dayBefore = new Date(payment.value_date)
  dayBefore.setDate(dayBefore.getDate() - 1)
  const dayAfter = new Date(payment.value_date)
  dayAfter.setDate(dayAfter.getDate() + 1)

  const { data: amountDateInvoices } = await db.invoices()
    .select('*')
    .eq('company_id', companyId)
    .eq('total', payment.amount)
    .gte('due_date', dayBefore.toISOString().split('T')[0])
    .lte('due_date', dayAfter.toISOString().split('T')[0])
    .in('status', ['OPEN', 'PARTIAL_PAID', 'OVERDUE'])

  if (amountDateInvoices && amountDateInvoices.length === 1) {
    return { 
      invoice: amountDateInvoices[0] as DatabaseInvoice, 
      confidence: 'MEDIUM' as MatchConfidence
    }
  }

  // 3. Try amount-only match (low confidence)
  const { data: amountInvoices } = await db.invoices()
    .select('*')
    .eq('company_id', companyId)
    .eq('total', payment.amount)
    .in('status', ['OPEN', 'PARTIAL_PAID', 'OVERDUE'])

  if (amountInvoices && amountInvoices.length === 1) {
    return { 
      invoice: amountInvoices[0] as DatabaseInvoice, 
      confidence: 'LOW' as MatchConfidence
    }
  }

  return { confidence: 'MANUAL' as MatchConfidence }
}

// Helper function to update invoice status after payment
const updateInvoiceAfterPayment = async (invoiceId: string) => {
  // Get current invoice
  const { data: invoice } = await db.invoices()
    .select('total, paid_amount')
    .eq('id', invoiceId)
    .single()

  if (!invoice) return

  // Calculate new paid amount
  const { data: payments } = await db.payments()
    .select('amount')
    .eq('invoice_id', invoiceId)
    .eq('is_matched', true)

  const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0

  // Determine new status
  let newStatus = 'OPEN'
  if (totalPaid >= invoice.total) {
    newStatus = 'PAID'
  } else if (totalPaid > 0) {
    newStatus = 'PARTIAL_PAID'
  }

  // Update invoice
  await db.invoices()
    .update({ 
      paid_amount: totalPaid,
      status: newStatus
    })
    .eq('id', invoiceId)
}

/**
 * @desc    Get all payments
 * @route   GET /api/v1/payments
 * @access  Private
 */
export const getPayments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
  const limit = parseInt(req.query.limit as string) || 10
  const isMatched = req.query.isMatched === 'true' ? true : req.query.isMatched === 'false' ? false : undefined
  const confidence = req.query.confidence as MatchConfidence
  const sortBy = req.query.sortBy as string || 'value_date'
  const sortOrder = req.query.sortOrder as string || 'desc'

  try {
    // Build query
    let query = db.payments()
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)

    // Apply filters
    if (isMatched !== undefined) {
      query = query.eq('is_matched', isMatched)
    }

    if (confidence) {
      query = query.eq('confidence', confidence)
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
      handleSupabaseError(error, 'get payments')
      return
    }

    const payments = (data as DatabasePayment[]).map(createPaymentResponse)

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    })

  } catch (error) {
    handleSupabaseError(error, 'get payments')
  }
})

/**
 * @desc    Get single payment
 * @route   GET /api/v1/payments/:id
 * @access  Private
 */
export const getPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const paymentId = req.params.id

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    const { data, error } = await db.payments()
      .select('*')
      .eq('id', paymentId)
      .eq('company_id', companyId)
      .single()

    if (error || !data) {
      res.status(404).json({
        success: false,
        error: 'Payment not found'
      })
      return
    }

    const payment = createPaymentResponse(data as DatabasePayment)

    res.json({
      success: true,
      data: { payment }
    })

  } catch (error) {
    handleSupabaseError(error, 'get payment')
  }
})

/**
 * @desc    Create new payment
 * @route   POST /api/v1/payments
 * @access  Private
 */
export const createPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  const {
    amount,
    valueDate = new Date(),
    reference,
    description,
    notes
  } = req.body

  try {
    // Create payment data
    const paymentData = {
      company_id: companyId,
      amount,
      value_date: new Date(valueDate).toISOString().split('T')[0],
      reference: reference || null,
      description: description || null,
      confidence: 'MANUAL' as MatchConfidence,
      is_matched: false,
      notes: notes || null,
      raw_data: null
    }

    // Create payment
    const { data: newPayment, error: createError } = await db.payments()
      .insert(paymentData)
      .select()
      .single()

    if (createError || !newPayment) {
      handleSupabaseError(createError, 'create payment')
      return
    }

    // Try automatic matching
    const matchResult = await findMatchingInvoice(newPayment as DatabasePayment, companyId)
    
    if (matchResult.invoice) {
      // Update payment with match
      const { data: updatedPayment } = await db.payments()
        .update({
          invoice_id: matchResult.invoice.id,
          confidence: matchResult.confidence,
          is_matched: true
        })
        .eq('id', newPayment.id)
        .select()
        .single()

      // Update invoice status
      await updateInvoiceAfterPayment(matchResult.invoice.id)

      const payment = createPaymentResponse(updatedPayment as DatabasePayment)

      res.status(201).json({
        success: true,
        message: `Payment created and automatically matched with ${matchResult.confidence.toLowerCase()} confidence`,
        data: { payment }
      })
    } else {
      const payment = createPaymentResponse(newPayment as DatabasePayment)

      res.status(201).json({
        success: true,
        message: 'Payment created but no automatic match found',
        data: { payment }
      })
    }

  } catch (error) {
    handleSupabaseError(error, 'create payment')
  }
})

/**
 * @desc    Match payment to invoice
 * @route   POST /api/v1/payments/:id/match
 * @access  Private
 */
export const matchPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const paymentId = req.params.id
  const { invoiceId } = req.body

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Verify payment exists and belongs to company
    const { data: payment, error: paymentError } = await db.payments()
      .select('*')
      .eq('id', paymentId)
      .eq('company_id', companyId)
      .single()

    if (paymentError || !payment) {
      res.status(404).json({
        success: false,
        error: 'Payment not found'
      })
      return
    }

    // Verify invoice exists and belongs to company
    const { data: invoice, error: invoiceError } = await db.invoices()
      .select('*')
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

    // Update payment with manual match
    const { data: updatedPayment, error: updateError } = await db.payments()
      .update({
        invoice_id: invoiceId,
        confidence: 'MANUAL',
        is_matched: true
      })
      .eq('id', paymentId)
      .select()
      .single()

    if (updateError || !updatedPayment) {
      handleSupabaseError(updateError, 'match payment')
      return
    }

    // Update invoice status
    await updateInvoiceAfterPayment(invoiceId)

    const matchedPayment = createPaymentResponse(updatedPayment as DatabasePayment)

    res.json({
      success: true,
      message: 'Payment matched successfully',
      data: { payment: matchedPayment }
    })

  } catch (error) {
    handleSupabaseError(error, 'match payment')
  }
})

/**
 * @desc    Import payments from CSV
 * @route   POST /api/v1/payments/import
 * @access  Private
 */
export const importPayments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  const { payments } = req.body

  if (!Array.isArray(payments) || payments.length === 0) {
    res.status(400).json({
      success: false,
      error: 'No payments provided for import'
    })
    return
  }

  try {
    const importBatch = Date.now().toString()
    const importedPayments: Payment[] = []
    const matchedCount = { automatic: 0, manual: 0 }

    for (const paymentData of payments) {
      const {
        amount,
        valueDate,
        reference,
        description,
        rawData
      } = paymentData

      // Create payment (amount should already be in Rappen from frontend)
      const newPaymentData = {
        company_id: companyId,
        amount: amount, // Already converted to Rappen in frontend
        value_date: new Date(valueDate).toISOString().split('T')[0],
        reference: reference || null,
        description: description || null,
        confidence: 'MANUAL' as MatchConfidence,
        is_matched: false,
        import_batch: importBatch,
        raw_data: rawData || null
      }

      console.log('Creating payment:', {
        amount: amount,
        amountCHF: amount / 100,
        reference: reference,
        valueDate: valueDate
      })

      const { data: newPayment, error: createError } = await db.payments()
        .insert(newPaymentData)
        .select()
        .single()

      if (createError || !newPayment) {
        console.error('Failed to create payment:', createError)
        continue
      }

      // Try automatic matching
      console.log('Attempting to match payment:', newPayment.id, 'with reference:', newPayment.reference)
      const matchResult = await findMatchingInvoice(newPayment as DatabasePayment, companyId)
      
      console.log('Match result:', {
        found: !!matchResult.invoice,
        confidence: matchResult.confidence,
        invoiceId: matchResult.invoice?.id,
        invoiceNumber: matchResult.invoice?.number
      })
      
      if (matchResult.invoice) {
        // Update payment with match
        const { data: updatedPayment } = await db.payments()
          .update({
            invoice_id: matchResult.invoice.id,
            confidence: matchResult.confidence,
            is_matched: true
          })
          .eq('id', newPayment.id)
          .select()
          .single()

        console.log('Payment matched successfully:', {
          paymentId: newPayment.id,
          invoiceId: matchResult.invoice.id,
          confidence: matchResult.confidence
        })

        // Update invoice status
        await updateInvoiceAfterPayment(matchResult.invoice.id)

        importedPayments.push(createPaymentResponse(updatedPayment as DatabasePayment))
        matchedCount.automatic++
      } else {
        console.log('No match found for payment:', newPayment.id)
        importedPayments.push(createPaymentResponse(newPayment as DatabasePayment))
      }
    }

    res.status(201).json({
      success: true,
      message: `Imported ${importedPayments.length} payments. ${matchedCount.automatic} automatically matched.`,
      data: {
        payments: importedPayments,
        summary: {
          total: importedPayments.length,
          automaticallyMatched: matchedCount.automatic,
          needsManualReview: importedPayments.length - matchedCount.automatic,
          importBatch
        }
      }
    })

  } catch (error) {
    handleSupabaseError(error, 'import payments')
  }
})

/**
 * @desc    Import payments from CSV
 * @route   POST /api/v1/payments/import/csv
 * @access  Private
 */
export const importPaymentsCSV = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const { csvData } = req.body

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  if (!csvData) {
    res.status(400).json({
      success: false,
      error: 'CSV data is required'
    })
    return
  }

  try {
    // Parse CSV data
    const lines = csvData.trim().split('\n')
    const headers = lines[0].split(',').map((h: string) => h.trim())
    const payments = []

    console.log('CSV Headers:', headers)
    console.log('CSV Lines count:', lines.length)

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue // Skip empty lines
      
      const values = line.split(',').map((v: string) => v.trim())
      console.log(`Line ${i}:`, values)
      
      if (values.length >= 2) {
        const amountStr = values[0]
        const amount = parseFloat(amountStr)
        console.log(`Amount string: "${amountStr}", parsed: ${amount}, isNaN: ${isNaN(amount)}`)
        
        if (!isNaN(amount) && amount > 0) {
          const payment = {
            amount: Math.round(amount * 100), // Convert CHF to Rappen
            valueDate: values[1],
            reference: values[2] || null,
            description: values[3] || null
          }
          console.log('Valid payment:', payment)
          payments.push(payment)
        } else {
          console.log(`Skipping invalid amount: "${amountStr}"`)
        }
      } else {
        console.log(`Skipping line with insufficient columns: ${values.length}`)
      }
    }

    console.log('Total valid payments parsed:', payments.length)

    if (payments.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No valid payments found in CSV data'
      })
      return
    }

    // Import payments using existing import function
    const importBatch = Date.now().toString()
    const importedPayments: Payment[] = []
    const matchedCount = { automatic: 0, manual: 0 }

    for (const paymentData of payments) {
      console.log('Processing payment data:', paymentData)
      
      // Validate payment data
      if (!paymentData.amount || paymentData.amount <= 0) {
        console.error('Invalid amount:', paymentData.amount)
        continue
      }
      
      if (!paymentData.valueDate) {
        console.error('Missing value date:', paymentData)
        continue
      }

      const newPaymentData = {
        company_id: companyId,
        amount: paymentData.amount,
        value_date: new Date(paymentData.valueDate).toISOString().split('T')[0],
        reference: paymentData.reference,
        description: paymentData.description,
        confidence: 'MANUAL' as MatchConfidence,
        is_matched: false,
        import_batch: importBatch,
        raw_data: null
      }

      console.log('Creating payment with data:', newPaymentData)

      const { data: newPayment, error: createError } = await db.payments()
        .insert(newPaymentData)
        .select()
        .single()

      if (createError || !newPayment) {
        console.error('Failed to create payment:', createError)
        continue
      }

      // Try automatic matching
      const matchResult = await findMatchingInvoice(newPayment as DatabasePayment, companyId)
      
      if (matchResult.invoice) {
        await db.payments()
          .update({
            invoice_id: matchResult.invoice.id,
            confidence: matchResult.confidence,
            is_matched: true
          })
          .eq('id', newPayment.id)

        await updateInvoiceAfterPayment(matchResult.invoice.id)
        matchedCount.automatic++
      }

      importedPayments.push(createPaymentResponse(newPayment as DatabasePayment))
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedPayments.length} payments`,
      data: {
        payments: importedPayments,
        matchedCount
      }
    })

  } catch (error) {
    console.error('Error importing CSV payments:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to import CSV payments'
    })
  }
})

/**
 * @desc    Import payments from MT940
 * @route   POST /api/v1/payments/import/mt940
 * @access  Private
 */
export const importPaymentsMT940 = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const { mt940Data } = req.body

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  if (!mt940Data) {
    res.status(400).json({
      success: false,
      error: 'MT940 data is required'
    })
    return
  }

  try {
    // Basic MT940 parsing (simplified implementation)
    // In production, use a proper MT940 parser library
    const lines = mt940Data.split('\n')
    const payments = []
    let currentPayment: any = null

    for (const line of lines) {
      if (line.startsWith(':61:')) {
        // Transaction line
        if (currentPayment) {
          payments.push(currentPayment)
        }
        currentPayment = {
          amount: 0,
          valueDate: '',
          reference: '',
          description: ''
        }
        
        // Parse transaction data (simplified)
        const match = line.match(/:61:(\d{6})(\d{4})([CD])(\d+),(\d+)/)
        if (match) {
          const [, date, time, dc, amount, ref] = match
          currentPayment.valueDate = `20${date.substring(0, 2)}-${date.substring(2, 4)}-${date.substring(4, 6)}`
          currentPayment.amount = parseInt(amount) * (dc === 'C' ? 1 : -1) // Credit/Debit
          currentPayment.reference = ref
        }
      } else if (line.startsWith(':86:') && currentPayment) {
        // Description line
        currentPayment.description = line.substring(4).trim()
      }
    }

    if (currentPayment) {
      payments.push(currentPayment)
    }

    // Import payments
    const importBatch = Date.now().toString()
    const importedPayments: Payment[] = []
    const matchedCount = { automatic: 0, manual: 0 }

    for (const paymentData of payments) {
      if (paymentData.amount === 0) continue

      const newPaymentData = {
        company_id: companyId,
        amount: Math.abs(paymentData.amount), // Store as positive amount
        value_date: paymentData.valueDate,
        reference: paymentData.reference || null,
        description: paymentData.description || null,
        confidence: 'MANUAL' as MatchConfidence,
        is_matched: false,
        import_batch: importBatch,
        raw_data: { mt940: true }
      }

      const { data: newPayment, error: createError } = await db.payments()
        .insert(newPaymentData)
        .select()
        .single()

      if (createError || !newPayment) {
        console.error('Failed to create payment:', createError)
        continue
      }

      // Try automatic matching
      const matchResult = await findMatchingInvoice(newPayment as DatabasePayment, companyId)
      
      if (matchResult.invoice) {
        await db.payments()
          .update({
            invoice_id: matchResult.invoice.id,
            confidence: matchResult.confidence,
            is_matched: true
          })
          .eq('id', newPayment.id)

        await updateInvoiceAfterPayment(matchResult.invoice.id)
        matchedCount.automatic++
      }

      importedPayments.push(createPaymentResponse(newPayment as DatabasePayment))
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedPayments.length} payments from MT940`,
      data: {
        payments: importedPayments,
        matchedCount
      }
    })

  } catch (error) {
    console.error('Error importing MT940 payments:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to import MT940 payments'
    })
  }
})

/**
 * @desc    Import payments from CAMT.053
 * @route   POST /api/v1/payments/import/camt053
 * @access  Private
 */
export const importPaymentsCAMT053 = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const { camt053Data } = req.body

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  if (!camt053Data) {
    res.status(400).json({
      success: false,
      error: 'CAMT.053 data is required'
    })
    return
  }

  try {
    // Basic CAMT.053 parsing (simplified implementation)
    // In production, use a proper XML parser for CAMT.053
    const payments = []
    
    // Simple XML parsing for demonstration
    // In production, use a proper XML parser
    const entryMatches = camt053Data.match(/<Ntry>[\s\S]*?<\/Ntry>/g) || []
    
    for (const entry of entryMatches) {
      const amountMatch = entry.match(/<Amt Ccy="CHF">([\d.]+)<\/Amt>/)
      const dateMatch = entry.match(/<Dt>(\d{4}-\d{2}-\d{2})<\/Dt>/)
      const refMatch = entry.match(/<RmtInf>[\s\S]*?<Ustrd>([^<]+)<\/Ustrd>/)
      
      if (amountMatch && dateMatch) {
        payments.push({
          amount: Math.round(parseFloat(amountMatch[1]) * 100), // Convert CHF to Rappen
          valueDate: dateMatch[1],
          reference: refMatch ? refMatch[1].trim() : null,
          description: 'CAMT.053 Import'
        })
      }
    }

    // Import payments
    const importBatch = Date.now().toString()
    const importedPayments: Payment[] = []
    const matchedCount = { automatic: 0, manual: 0 }

    for (const paymentData of payments) {
      const newPaymentData = {
        company_id: companyId,
        amount: paymentData.amount,
        value_date: paymentData.valueDate,
        reference: paymentData.reference,
        description: paymentData.description,
        confidence: 'MANUAL' as MatchConfidence,
        is_matched: false,
        import_batch: importBatch,
        raw_data: { camt053: true }
      }

      const { data: newPayment, error: createError } = await db.payments()
        .insert(newPaymentData)
        .select()
        .single()

      if (createError || !newPayment) {
        console.error('Failed to create payment:', createError)
        continue
      }

      // Try automatic matching
      const matchResult = await findMatchingInvoice(newPayment as DatabasePayment, companyId)
      
      if (matchResult.invoice) {
        await db.payments()
          .update({
            invoice_id: matchResult.invoice.id,
            confidence: matchResult.confidence,
            is_matched: true
          })
          .eq('id', newPayment.id)

        await updateInvoiceAfterPayment(matchResult.invoice.id)
        matchedCount.automatic++
      }

      importedPayments.push(createPaymentResponse(newPayment as DatabasePayment))
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedPayments.length} payments from CAMT.053`,
      data: {
        payments: importedPayments,
        matchedCount
      }
    })

  } catch (error) {
    console.error('Error importing CAMT.053 payments:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to import CAMT.053 payments'
    })
  }
})

/**
 * @desc    Run automatic payment matching
 * @route   POST /api/v1/payments/auto-match
 * @access  Private
 */
export const runAutoMatch = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get all unmatched payments
    const { data: unmatchedPayments, error: paymentsError } = await db.payments()
      .select('*')
      .eq('company_id', companyId)
      .eq('is_matched', false)

    if (paymentsError) {
      res.status(400).json({
        success: false,
        error: 'Failed to fetch unmatched payments'
      })
      return
    }

    let matchedCount = 0
    const results = []

    for (const payment of unmatchedPayments || []) {
      const matchResult = await findMatchingInvoice(payment as DatabasePayment, companyId)
      
      if (matchResult.invoice) {
        // Update payment with match
        const { error: updateError } = await db.payments()
          .update({
            invoice_id: matchResult.invoice.id,
            confidence: matchResult.confidence,
            is_matched: true
          })
          .eq('id', payment.id)

        if (!updateError) {
          await updateInvoiceAfterPayment(matchResult.invoice.id)
          matchedCount++
          results.push({
            paymentId: payment.id,
            invoiceId: matchResult.invoice.id,
            confidence: matchResult.confidence
          })
        }
      }
    }

    res.json({
      success: true,
      message: `Auto-matching completed. ${matchedCount} payments matched.`,
      data: {
        matchedCount,
        totalProcessed: unmatchedPayments?.length || 0,
        results
      }
    })

  } catch (error) {
    console.error('Error running auto-match:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to run auto-matching'
    })
  }
})

/**
 * @desc    Debug payment matching
 * @route   GET /api/v1/payments/debug
 * @access  Private
 */
export const debugPaymentMatching = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get all invoices and payments for debugging
    const { data: invoices } = await db.invoices()
      .select('id, number, qr_reference, total, status')
      .eq('company_id', companyId)

    const { data: payments } = await db.payments()
      .select('id, amount, reference, value_date, is_matched, confidence')
      .eq('company_id', companyId)

    // Test matching for each payment
    const debugResults = []
    
    for (const payment of payments || []) {
      const matchResult = await findMatchingInvoice(payment as DatabasePayment, companyId)
      
      debugResults.push({
        payment: {
          id: payment.id,
          amount: payment.amount,
          amountCHF: (payment.amount / 100).toFixed(2),
          reference: payment.reference,
          valueDate: payment.value_date,
          isMatched: payment.is_matched,
          confidence: payment.confidence
        },
        matching: {
          found: !!matchResult.invoice,
          confidence: matchResult.confidence,
          invoiceId: matchResult.invoice?.id,
          invoiceNumber: matchResult.invoice?.number,
          invoiceTotal: matchResult.invoice?.total,
          invoiceTotalCHF: matchResult.invoice ? (matchResult.invoice.total / 100).toFixed(2) : null
        }
      })
    }

    res.json({
      success: true,
      data: {
        companyId,
        invoices: (invoices || []).map(inv => ({
          id: inv.id,
          number: inv.number,
          qrReference: inv.qr_reference,
          total: inv.total,
          totalCHF: (inv.total / 100).toFixed(2),
          status: inv.status
        })),
        debugResults
      }
    })

  } catch (error) {
    handleSupabaseError(error, 'debug payment matching')
  }
})

/**
 * @desc    Get payment statistics
 * @route   GET /api/v1/payments/stats
 * @access  Private
 */
export const getPaymentStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get all payments
    const { data: payments, error } = await db.payments()
      .select('amount, confidence, is_matched, value_date')
      .eq('company_id', companyId)

    if (error) {
      handleSupabaseError(error, 'get payment stats')
      return
    }

    // Calculate statistics
    const totalPayments = payments?.length || 0
    const totalAmount = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
    const matchedPayments = payments?.filter(p => p.is_matched).length || 0
    const unmatchedPayments = totalPayments - matchedPayments

    const confidenceCounts = payments?.reduce((acc, p) => {
      acc[p.confidence] = (acc[p.confidence] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const stats = {
      totalPayments,
      totalAmount,
      matchedPayments,
      unmatchedPayments,
      matchingRate: totalPayments > 0 ? Math.round((matchedPayments / totalPayments) * 100) : 0,
      confidenceCounts,
      averagePaymentAmount: totalPayments > 0 ? Math.round(totalAmount / totalPayments) : 0
    }

    res.json({
      success: true,
      data: { stats }
    })

  } catch (error) {
    handleSupabaseError(error, 'get payment stats')
  }
})

/**
 * @desc    Update payment
 * @route   PUT /api/v1/payments/:id
 * @access  Private
 */
export const updatePayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Payment update logic would be implemented here
  res.status(501).json({
    success: false,
    error: 'Payment update not implemented yet'
  })
})

/**
 * @desc    Delete payment
 * @route   DELETE /api/v1/payments/:id
 * @access  Private
 */
export const deletePayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Payment deletion logic would be implemented here
  res.status(501).json({
    success: false,
    error: 'Payment deletion not implemented yet'
  })
})
