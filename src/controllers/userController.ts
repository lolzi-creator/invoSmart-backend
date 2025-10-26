import { Request, Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { AuthenticatedRequest } from '../types'
import { createAuditLog } from './auditController'
import bcrypt from 'bcryptjs'

// Get all users in the company
export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.user!

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, is_active, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return res.status(500).json({ success: false, message: 'Failed to fetch users' })
    }

    return res.json({ success: true, data: users })
  } catch (error) {
    console.error('Error in getUsers:', error)
    return res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

// Invite a new user
export const inviteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.user!
    const { email, name, role = 'EMPLOYEE' } = req.body

    if (!email || !name) {
      return res.status(400).json({ success: false, message: 'Email and name are required' })
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' })
    }

    // Generate a temporary password for the invited user
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)
    const hashedPassword = await bcrypt.hash(tempPassword, 12)

    // Create new user
    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        name,
        role,
        password_hash: hashedPassword,
        company_id: companyId,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select('id, name, email, role, created_at')
      .single()

    if (error) {
      console.error('Error creating user:', error)
      return res.status(500).json({ success: false, message: 'Failed to create user' })
    }

    // Log audit event
    await createAuditLog(
      req.user!.id,
      req.user!.name,
      'USER_INVITED',
      'USER',
      newUser.id,
      { email, name, role },
      req.ip,
      req.get('User-Agent')
    )

    return res.json({ 
      success: true, 
      data: { 
        ...newUser, 
        tempPassword // Include temp password for admin to share
      }, 
      message: 'User invited successfully. Please share the temporary password with the user.' 
    })
  } catch (error) {
    console.error('Error in inviteUser:', error)
    return res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

// Update user role
export const updateUserRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.user!
    const { userId } = req.params
    const { role } = req.body

    if (!['ADMIN', 'EMPLOYEE'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' })
    }

    // Check if user belongs to the same company
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, company_id')
      .eq('id', userId)
      .eq('company_id', companyId)
      .single()

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    // Update user role
    const { error } = await supabaseAdmin
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      console.error('Error updating user role:', error)
      return res.status(500).json({ success: false, message: 'Failed to update user role' })
    }

    // Log audit event
    await createAuditLog(
      req.user!.id,
      req.user!.name,
      'USER_ROLE_UPDATED',
      'USER',
      userId,
      { newRole: role },
      req.ip,
      req.get('User-Agent')
    )

    return res.json({ success: true, message: 'User role updated successfully' })
  } catch (error) {
    console.error('Error in updateUserRole:', error)
    return res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

// Deactivate user
export const deactivateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.user!
    const { userId } = req.params

    // Check if user belongs to the same company
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, company_id')
      .eq('id', userId)
      .eq('company_id', companyId)
      .single()

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    // Deactivate user
    const { error } = await supabaseAdmin
      .from('users')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId)

    if (error) {
      console.error('Error deactivating user:', error)
      return res.status(500).json({ success: false, message: 'Failed to deactivate user' })
    }

    return res.json({ success: true, message: 'User deactivated successfully' })
  } catch (error) {
    console.error('Error in deactivateUser:', error)
    return res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

// Reactivate user
export const reactivateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.user!
    const { userId } = req.params

    // Check if user belongs to the same company
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, company_id')
      .eq('id', userId)
      .eq('company_id', companyId)
      .single()

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    // Reactivate user
    const { error } = await supabaseAdmin
      .from('users')
      .update({ 
        is_active: true, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId)

    if (error) {
      console.error('Error reactivating user:', error)
      return res.status(500).json({ success: false, message: 'Failed to reactivate user' })
    }

    return res.json({ success: true, message: 'User reactivated successfully' })
  } catch (error) {
    console.error('Error in reactivateUser:', error)
    return res.status(500).json({ success: false, message: 'Internal server error' })
  }
}


