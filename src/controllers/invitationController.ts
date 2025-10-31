import { Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { AuthenticatedRequest } from '../types'
import bcrypt from 'bcryptjs'
import { config } from '../config'

/**
 * @desc    Get invitation by token (public)
 * @route   GET /api/v1/invitations/:token
 * @access  Public
 */
export const getInvitationByToken = async (req: any, res: Response) => {
  try {
    const { token } = req.params

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      })
    }

    // Get invitation
    const { data: invitation, error } = await supabaseAdmin.from('user_invitations')
      .select(`
        *,
        companies (
          id,
          name
        )
      `)
      .eq('token', token)
      .single()

    if (error || !invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found or invalid'
      })
    }

    // Check if already accepted
    if (invitation.accepted_at) {
      return res.status(400).json({
        success: false,
        error: 'This invitation has already been accepted'
      })
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'This invitation has expired'
      })
    }

    return res.json({
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          company: invitation.companies,
          expiresAt: invitation.expires_at
        }
      }
    })
  } catch (error) {
    console.error('Error getting invitation:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * @desc    Accept invitation and create user account
 * @route   POST /api/v1/invitations/:token/accept
 * @access  Public
 */
export const acceptInvitation = async (req: any, res: Response) => {
  try {
    const { token } = req.params
    const { password, name } = req.body

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      })
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password is required and must be at least 8 characters'
      })
    }

    // Get invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin.from('user_invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (inviteError || !invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found or invalid'
      })
    }

    // Check if already accepted
    if (invitation.accepted_at) {
      return res.status(400).json({
        success: false,
        error: 'This invitation has already been accepted'
      })
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'This invitation has expired. Please request a new invitation.'
      })
    }

    // Check if user already exists with this email
    const { data: existingUser } = await supabaseAdmin.from('users')
      .select('id')
      .eq('email', invitation.email.toLowerCase())
      .single()

    if (existingUser) {
      // Mark invitation as accepted even if user exists (to prevent reuse)
      await supabaseAdmin.from('user_invitations')
        .update({
          accepted_at: new Date().toISOString(),
          accepted_by: existingUser.id
        })
        .eq('id', invitation.id)

      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists. Please log in instead.'
      })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const { data: newUser, error: userError } = await supabaseAdmin.from('users')
      .insert({
        email: invitation.email.toLowerCase(),
        password_hash: hashedPassword,
        name: name || invitation.name,
        role: invitation.role,
        company_id: invitation.company_id,
        is_active: true
      })
      .select()
      .single()

    if (userError || !newUser) {
      console.error('Error creating user:', userError)
      return res.status(500).json({
        success: false,
        error: 'Failed to create user account'
      })
    }

    // Mark invitation as accepted
    await supabaseAdmin.from('user_invitations')
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by: newUser.id
      })
      .eq('id', invitation.id)

    return res.json({
      success: true,
      message: 'Account created successfully. You can now log in.',
      data: {
        userId: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      }
    })
  } catch (error) {
    console.error('Error accepting invitation:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * @desc    Get all invitations for company (admin only)
 * @route   GET /api/v1/invitations
 * @access  Private (Admin only)
 */
export const getInvitations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, role } = req.user!

    if (role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can view invitations'
      })
    }

    const { data: invitations, error } = await supabaseAdmin.from('user_invitations')
      .select(`
        *,
        users!user_invitations_invited_by_fkey (
          id,
          name,
          email
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching invitations:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch invitations'
      })
    }

    return res.json({
      success: true,
      data: {
        invitations: invitations || []
      }
    })
  } catch (error) {
    console.error('Error in getInvitations:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * @desc    Cancel/Delete invitation (admin only)
 * @route   DELETE /api/v1/invitations/:id
 * @access  Private (Admin only)
 */
export const cancelInvitation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, role } = req.user!
    const { id } = req.params

    if (role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can cancel invitations'
      })
    }

    // Check if invitation belongs to company and is not accepted
    const { data: invitation, error: checkError } = await supabaseAdmin.from('user_invitations')
      .select('id, accepted_at')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (checkError || !invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found'
      })
    }

    if (invitation.accepted_at) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel an accepted invitation'
      })
    }

    // Delete invitation
    const { error: deleteError } = await supabaseAdmin.from('user_invitations')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting invitation:', deleteError)
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel invitation'
      })
    }

    return res.json({
      success: true,
      message: 'Invitation cancelled successfully'
    })
  } catch (error) {
    console.error('Error in cancelInvitation:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

