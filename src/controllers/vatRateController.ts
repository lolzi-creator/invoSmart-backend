import { Response } from 'express'
import { db, handleSupabaseError } from '../lib/supabase'
import { AuthenticatedRequest } from '../types'
import { asyncHandler } from '../middleware/errorHandler'

// Get VAT rates for company
export const getVatRates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Company ID required' 
    })
  }

  const { data: vatRates, error } = await db.vatRates()
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    handleSupabaseError(error, 'fetch VAT rates')
    return
  }

  // Convert rate from basis points to percentage for frontend
  const formattedRates = vatRates?.map(rate => ({
    id: rate.id,
    name: rate.name,
    rate: rate.rate / 100, // Convert from basis points (770) to percentage (7.7)
    isDefault: rate.is_default,
    isActive: rate.is_active
  })) || []

  return res.json({
    success: true,
    data: {
      vatRates: formattedRates
    }
  })
})

// Update VAT rates for company
export const updateVatRates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Company ID required' 
    })
  }

  const { vatRates } = req.body

  if (!Array.isArray(vatRates) || vatRates.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'VAT rates array is required' 
    })
  }

  if (vatRates.length > 3) {
    return res.status(400).json({ 
      success: false, 
      error: 'Maximum 3 VAT rates allowed' 
    })
  }

  // Validate rates
  for (const rate of vatRates) {
    if (!rate.name || typeof rate.name !== 'string' || rate.name.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'All VAT rates must have a name' 
      })
    }
    if (typeof rate.rate !== 'number' || rate.rate < 0 || rate.rate > 100) {
      return res.status(400).json({ 
        success: false, 
        error: 'VAT rates must be between 0 and 100' 
      })
    }
  }

  // Check that at least one is marked as default
  if (!vatRates.some(rate => rate.isDefault)) {
    return res.status(400).json({ 
      success: false, 
      error: 'At least one VAT rate must be marked as default' 
    })
  }

  // Get existing VAT rates to deactivate
  const { data: existingRates } = await db.vatRates()
    .select('id')
    .eq('company_id', companyId)

  // Deactivate all existing rates
  if (existingRates && existingRates.length > 0) {
    const { error: deactivateError } = await db.vatRates()
      .update({ is_active: false })
      .eq('company_id', companyId)

    if (deactivateError) {
      handleSupabaseError(deactivateError, 'deactivate existing VAT rates')
      return
    }
  }

  // Insert or update new rates
  const ratesToInsert = vatRates.map(rate => ({
    name: rate.name.trim(),
    rate: Math.round(rate.rate * 100), // Convert percentage (7.7) to basis points (770)
    is_default: rate.isDefault || false,
    is_active: true,
    company_id: companyId
  }))

  const { data: insertedRates, error: insertError } = await db.vatRates()
    .insert(ratesToInsert)
    .select()

  if (insertError) {
    handleSupabaseError(insertError, 'insert VAT rates')
    return
  }

  // Format response
  const formattedRates = insertedRates?.map(rate => ({
    id: rate.id,
    name: rate.name,
    rate: rate.rate / 100, // Convert back to percentage
    isDefault: rate.is_default,
    isActive: rate.is_active
  })) || []

  return res.json({
    success: true,
    data: {
      vatRates: formattedRates
    },
    message: 'VAT rates updated successfully'
  })
})

