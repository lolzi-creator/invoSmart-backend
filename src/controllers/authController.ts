import { Request, Response } from 'express'
import * as jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { asyncHandler } from '../middleware/errorHandler'
import { AuthenticatedRequest } from '../middleware/auth'
import { config } from '../config'
import {
  User,
  Company,
  UserRole,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ApiResponse
} from '../types'
import { 
  db, 
  supabaseAdmin,
  handleSupabaseError, 
  DatabaseUser, 
  DatabaseCompany 
} from '../lib/supabase'

// Helper function to generate JWT token
const generateToken = (user: User, company: Company): string => {
  const payload = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive
    },
    company: {
      id: company.id,
      name: company.name,
      email: company.email,
      country: company.country,
      defaultLanguage: company.defaultLanguage
    }
  }

  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' })
}

// Helper function to create user response (without password)
const createUserResponse = (dbUser: DatabaseUser): User => {
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as UserRole,
    isActive: dbUser.is_active,
    companyId: dbUser.company_id,
    createdAt: new Date(dbUser.created_at),
    updatedAt: new Date(dbUser.updated_at)
  }
}

// Helper function to convert DB company to API company
const createCompanyResponse = (dbCompany: DatabaseCompany): Company => {
  return {
    id: dbCompany.id,
    name: dbCompany.name,
    address: dbCompany.address,
    zip: dbCompany.zip,
    city: dbCompany.city,
    country: dbCompany.country,
    phone: dbCompany.phone,
    email: dbCompany.email,
    website: dbCompany.website,
    uid: dbCompany.uid,
    vatNumber: dbCompany.vat_number,
    iban: dbCompany.iban,
    qrIban: dbCompany.qr_iban,
    logoUrl: dbCompany.logo_url,
    defaultPaymentTerms: dbCompany.default_payment_terms,
    defaultLanguage: dbCompany.default_language,
    createdAt: new Date(dbCompany.created_at),
    updatedAt: new Date(dbCompany.updated_at)
  }
}

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password }: LoginRequest = req.body

  try {
    // Find user by email
    const { data: users, error: userError } = await db.users()
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single()

    if (userError || !users) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      })
      return
    }

    const user = users as DatabaseUser

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      })
      return
    }

    // Get company data
    const { data: companyData, error: companyError } = await db.companies()
      .select('*')
      .eq('id', user.company_id)
      .single()

    if (companyError || !companyData) {
      res.status(500).json({
        success: false,
        error: 'Company not found'
      })
      return
    }

    const company = createCompanyResponse(companyData as DatabaseCompany)
    const userResponse = createUserResponse(user)

    // Generate JWT token
    const token = generateToken(userResponse, company)

    const response: LoginResponse = {
      token,
      user: userResponse,
      company
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: response
    })

  } catch (error) {
    handleSupabaseError(error, 'login')
  }
})

/**
 * @desc    Register user and company
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    email,
    password,
    companyName,
    address,
    zip,
    city,
    phone,
    companyEmail,
    uid,
    vatNumber,
    iban
  }: RegisterRequest = req.body

  try {
    // Check if user already exists
    const { data: existingUser } = await db.users()
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      })
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create company first
    const { data: companyData, error: companyError } = await db.companies()
      .insert({
        name: companyName,
        address,
        zip,
        city,
        country: 'CH',
        phone: phone || null,
        email: companyEmail,
        uid: uid || null,
        vat_number: vatNumber || null,
        iban: iban || null,
        default_payment_terms: 30,
        default_language: 'de'
      })
      .select()
      .single()

    if (companyError || !companyData) {
      handleSupabaseError(companyError, 'create company')
      return
    }

    const company = companyData as DatabaseCompany

    // Create user
    const { data: userData, error: userError } = await db.users()
      .insert({
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        name,
        role: 'ADMIN',
        is_active: true,
        company_id: company.id
      })
      .select()
      .single()

    if (userError || !userData) {
      // Cleanup: delete company if user creation fails
      await db.companies().delete().eq('id', company.id)
      handleSupabaseError(userError, 'create user')
      return
    }

    const user = userData as DatabaseUser

    // Create default VAT rates and email templates
    try {
      await Promise.all([
        supabaseAdmin.rpc('create_default_vat_rates', { company_uuid: company.id }),
        supabaseAdmin.rpc('create_default_email_templates', { company_uuid: company.id })
      ])
    } catch (rpcError) {
      console.warn('Failed to create default data:', rpcError)
      // Continue without failing registration
    }

    const userResponse = createUserResponse(user)
    const companyResponse = createCompanyResponse(company)

    // Generate JWT token
    const token = generateToken(userResponse, companyResponse)

    const response: LoginResponse = {
      token,
      user: userResponse,
      company: companyResponse
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: response
    })

  } catch (error) {
    handleSupabaseError(error, 'register')
  }
})

/**
 * @desc    Get user profile
 * @route   GET /api/v1/auth/profile
 * @access  Private
 */
export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get user with company data
    const { data: userData, error: userError } = await db.users()
      .select(`
        *,
        companies (*)
      `)
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      })
      return
    }

    const user = userData as DatabaseUser & { companies: DatabaseCompany }
    const userResponse = createUserResponse(user)
    const companyResponse = createCompanyResponse(user.companies)

    res.json({
      success: true,
      data: {
        user: userResponse,
        company: companyResponse
      }
    })

  } catch (error) {
    handleSupabaseError(error, 'get profile')
  }
})

/**
 * @desc    Refresh token
 * @route   POST /api/v1/auth/refresh
 * @access  Private
 */
export const refreshToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get user with company data
    const { data: userData, error: userError } = await db.users()
      .select(`
        *,
        companies (*)
      `)
      .eq('id', userId)
      .eq('is_active', true)
      .single()

    if (userError || !userData) {
      res.status(404).json({
        success: false,
        error: 'User not found or inactive'
      })
      return
    }

    const user = userData as DatabaseUser & { companies: DatabaseCompany }
    const userResponse = createUserResponse(user)
    const companyResponse = createCompanyResponse(user.companies)

    // Generate new JWT token
    const token = generateToken(userResponse, companyResponse)

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token,
        user: userResponse,
        company: companyResponse
      }
    })

  } catch (error) {
    handleSupabaseError(error, 'refresh token')
  }
})

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/auth/profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { name, email } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    const updates: Partial<DatabaseUser> = {}

    if (name) updates.name = name
    if (email) {
      // Check if new email is already taken
      const { data: existingUser } = await db.users()
        .select('id')
        .eq('email', email.toLowerCase())
        .neq('id', userId)
        .single()

      if (existingUser) {
        res.status(409).json({
          success: false,
          error: 'Email already in use'
        })
        return
      }

      updates.email = email.toLowerCase()
    }

    // Update user
    const { data: userData, error: userError } = await db.users()
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (userError || !userData) {
      handleSupabaseError(userError, 'update profile')
      return
    }

    const user = userData as DatabaseUser
    const userResponse = createUserResponse(user)

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: userResponse
      }
    })

  } catch (error) {
    handleSupabaseError(error, 'update profile')
  }
})

/**
 * @desc    Change password
 * @route   PUT /api/v1/auth/password
 * @access  Private
 */
export const changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id
  const { currentPassword, newPassword } = req.body

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get current user
    const { data: userData, error: userError } = await db.users()
      .select('password_hash')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      })
      return
    }

    const user = userData as DatabaseUser

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash)
    
    if (!isCurrentPasswordValid) {
      res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      })
      return
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // Update password
    const { error: updateError } = await db.users()
      .update({ password_hash: hashedNewPassword })
      .eq('id', userId)

    if (updateError) {
      handleSupabaseError(updateError, 'change password')
      return
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    })

  } catch (error) {
    handleSupabaseError(error, 'change password')
  }
})
