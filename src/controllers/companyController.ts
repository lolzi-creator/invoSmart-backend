import { Response } from 'express'
import { supabaseAdmin, db, handleSupabaseError } from '../lib/supabase'
import { AuthenticatedRequest } from '../types'
import { asyncHandler } from '../middleware/errorHandler'

// Helper function to sanitize names for file paths
const sanitizeForPath = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

// Get company information
export const getCompany = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Company ID required' 
    })
  }

  const { data: company, error } = await db.companies()
    .select('*')
    .eq('id', companyId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ 
        success: false, 
        error: 'Company not found' 
      })
    }
    handleSupabaseError(error, 'fetch company')
    return // handleSupabaseError throws, but TypeScript needs explicit return
  }

  // Generate signed URL for logo if it exists
  let logoUrl = company?.logo_url || null
  if (logoUrl && logoUrl.includes('logos/')) {
    try {
      // Extract path from full URL or use as-is if it's a path
      const path = logoUrl.includes('/storage/v1/object/public/') 
        ? logoUrl.split('/storage/v1/object/public/logos/')[1] 
        : logoUrl.replace('logos/', '')
      
      const { data: signedUrlData } = await supabaseAdmin.storage
        .from('logos')
        .createSignedUrl(path, 3600) // 1 hour expiry
      
      if (signedUrlData?.signedUrl) {
        logoUrl = signedUrlData.signedUrl
      }
    } catch (urlError) {
      console.error('Error generating signed URL for logo:', urlError)
      // Use original URL if signed URL generation fails
    }
  }

  return res.json({
    success: true,
    data: {
      ...company,
      logo_url: logoUrl
    }
  })
})

// Upload company logo
export const uploadLogo = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Company ID required' 
    })
  }

  if (!req.file) {
    return res.status(400).json({ 
      success: false, 
      error: 'No file uploaded' 
    })
  }

  // Validate file type (images only)
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid file type. Only images (JPEG, PNG, GIF, WebP, SVG) are allowed.' 
    })
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (req.file.size > maxSize) {
    return res.status(400).json({ 
      success: false, 
      error: 'File size exceeds 5MB limit.' 
    })
  }

  try {
    // Get company name for folder structure
    const { data: company, error: companyError } = await db.companies()
      .select('name')
      .eq('id', companyId)
      .single()

    if (companyError) {
      handleSupabaseError(companyError, 'fetch company')
      return // handleSupabaseError throws, but TypeScript needs explicit return
    }

    const companyName = sanitizeForPath(company?.name || 'Company')
    
    // Generate unique filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const extension = req.file.originalname.split('.').pop() || 'png'
    const filename = `logo_${timestamp}_${random}.${extension}`
    const filePath = `${companyName}/${filename}`

    // Delete old logo if exists
    const { data: oldCompany } = await db.companies()
      .select('logo_url')
      .eq('id', companyId)
      .single()

    if (oldCompany?.logo_url && oldCompany.logo_url.includes('logos/')) {
      try {
        const oldPath = oldCompany.logo_url.includes('/storage/v1/object/public/')
          ? oldCompany.logo_url.split('/storage/v1/object/public/logos/')[1]
          : oldCompany.logo_url.replace('logos/', '')
        
        await supabaseAdmin.storage
          .from('logos')
          .remove([oldPath])
      } catch (deleteError) {
        console.error('Error deleting old logo:', deleteError)
        // Continue even if old logo deletion fails
      }
    }

    // Upload new logo to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('logos')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading logo:', uploadError)
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to upload logo. Please try again.' 
      })
    }

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('logos')
      .getPublicUrl(uploadData.path)

    const logoUrl = publicUrlData.publicUrl

    // Update company with new logo URL
    const { data: updatedCompany, error: updateError } = await db.companies()
      .update({ 
        logo_url: logoUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyId)
      .select()
      .single()

    if (updateError) {
      handleSupabaseError(updateError, 'update company logo')
      return // handleSupabaseError throws, but TypeScript needs explicit return
    }

    return res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        logo_url: logoUrl
      }
    })

  } catch (error) {
    console.error('Error uploading logo:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'An error occurred while uploading the logo' 
    })
  }
})

// Delete company logo
export const deleteLogo = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Company ID required' 
    })
  }

  try {
    // Get current logo URL
    const { data: company, error: companyError } = await db.companies()
      .select('logo_url')
      .eq('id', companyId)
      .single()

    if (companyError) {
      handleSupabaseError(companyError, 'fetch company')
      return // handleSupabaseError throws, but TypeScript needs explicit return
    }

    if (!company?.logo_url) {
      return res.status(404).json({ 
        success: false, 
        error: 'No logo found' 
      })
    }

    // Delete logo from storage
    if (company.logo_url.includes('logos/')) {
      try {
        const path = company.logo_url.includes('/storage/v1/object/public/')
          ? company.logo_url.split('/storage/v1/object/public/logos/')[1]
          : company.logo_url.replace('logos/', '')
        
        await supabaseAdmin.storage
          .from('logos')
          .remove([path])
      } catch (deleteError) {
        console.error('Error deleting logo from storage:', deleteError)
        // Continue with database update even if storage deletion fails
      }
    }

    // Update company to remove logo URL
    const { error: updateError } = await db.companies()
      .update({ 
        logo_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyId)

    if (updateError) {
      handleSupabaseError(updateError, 'update company logo')
      return // handleSupabaseError throws, but TypeScript needs explicit return
    }

    return res.json({
      success: true,
      message: 'Logo deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting logo:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'An error occurred while deleting the logo' 
    })
  }
})

