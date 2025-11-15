import { Response } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { AuthenticatedRequest } from '../types'
import { db, handleSupabaseError } from '../lib/supabase'

// Generate a Swiss SIX-compliant QR from company data only (test mode)
export const generateTestQR = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  try {
    // Load company
    const { data: company, error: companyError } = await db.companies()
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      res.status(404).json({ success: false, error: 'Company not found' })
      return
    }

    // Optional body
    const amount = Number(req.body?.amount ?? 10).toFixed(2)
    const currency = (req.body?.currency ?? 'CHF') as 'CHF' | 'EUR'

    // Decide reference type based on availability of QR-IBAN
    // QR references (27-digit numeric) only with QR-IBAN
    // SCOR references (RF prefix) only with normal IBAN
    const hasQRIban = Boolean(company.qr_iban && company.qr_iban.trim())
    const hasNormalIban = Boolean(company.iban && company.iban.trim())
    
    let referenceType: 'QRR' | 'SCOR' | 'NON' = 'NON'
    let reference = ''
    let iban = ''
    
    if (hasQRIban) {
      // Use QR reference with QR-IBAN
      referenceType = 'QRR'
      reference = '000000000000000000000000000' // 27-digit test reference
      iban = company.qr_iban.replace(/\s/g, '')
    } else if (hasNormalIban) {
      // Use SCOR reference with normal IBAN
      referenceType = 'SCOR'
      reference = 'RF0000000000000000000000000' // Test SCOR reference
      iban = company.iban.replace(/\s/g, '')
    } else {
      // No IBAN configured
      referenceType = 'NON'
      reference = ''
      iban = ''
    }

    // Build SPC payload (31 lines)
    const payload = [
      'SPC',               // QR Type
      '0200',              // Version
      '1',                 // Coding UTF-8
      iban,
      'S',                 // Creditor address (structured)
      company.name || '',
      company.address || '',
      '',                  // house number
      company.zip || '',
      company.city || '',
      (company.country || 'CH'),
      '', '', '', '', '', '', '',      // Ultimate creditor (empty)
      amount,              // Amount
      currency,            // Currency
      'S',                 // Debtor address type (structured)
      req.body?.debtor?.name || '',
      req.body?.debtor?.address || '',
      '',
      req.body?.debtor?.zip || '',
      req.body?.debtor?.city || '',
      req.body?.debtor?.country || 'CH',
      referenceType,       // Reference type
      reference,           // Reference
      'InvoSmart QR Test', // Additional info
      'EPD'                // Trailer
    ].join('\n')

    // Generate PNG data URL
    const QRCode = require('qrcode')
    const dataUrl = await QRCode.toDataURL(payload, {
      type: 'image/png', width: 220, margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' }
    })

    res.json({ success: true, data: { dataUrl, payload, referenceType } })
  } catch (error) {
    handleSupabaseError(error, 'generate test qr')
  }
})

export default generateTestQR











