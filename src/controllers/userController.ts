import { Request, Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { AuthenticatedRequest } from '../types'
import { createAuditLog } from './auditController'
import { config } from '../config'
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
    const { companyId, role: inviterRole } = req.user!
    
    // Only admins can invite users
    if (inviterRole !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admins can invite users' 
      })
    }

    const { email, name, role = 'EMPLOYEE' } = req.body

    if (!email || !name) {
      return res.status(400).json({ success: false, message: 'Email and name are required' })
    }

    // Validate role
    if (!['ADMIN', 'EMPLOYEE'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' })
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' })
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabaseAdmin
      .from('user_invitations')
      .select('id, expires_at')
      .eq('company_id', companyId)
      .eq('email', email.toLowerCase())
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (existingInvitation) {
      return res.status(400).json({ 
        success: false, 
        message: 'An invitation has already been sent to this email address' 
      })
    }

    // Generate secure invitation token (using crypto for better uniqueness)
    const crypto = require('crypto')
    let token: string = ''
    let tokenExists = true
    let attempts = 0
    const maxAttempts = 5

    // Generate unique token with retry logic
    while (tokenExists && attempts < maxAttempts) {
      token = crypto.randomBytes(32).toString('base64url')
      
      // Check if token already exists
      const { data: existingToken } = await supabaseAdmin
        .from('user_invitations')
        .select('id')
        .eq('token', token)
        .single()
      
      tokenExists = !!existingToken
      attempts++
    }

    if (tokenExists || !token) {
      // Fallback to timestamp-based token with more entropy if all crypto attempts failed
      token = crypto.randomBytes(16).toString('hex') + '-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15)
    }

    // Token expires in 7 days
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Create invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('user_invitations')
      .insert({
        company_id: companyId,
        invited_by: req.user!.id,
        email: email.toLowerCase(),
        name,
        role,
        token,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Error creating invitation:', inviteError)
      return res.status(500).json({ success: false, message: 'Failed to create invitation' })
    }

    // Get company data for email
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    // Send invitation email
    try {
      const { Resend } = require('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { config } = require('../config')

      const frontendUrl = process.env.FRONTEND_URL || config.frontendUrl || 'http://localhost:5173'
      const invitationLink = `${frontendUrl}/invitations/accept/${token}`

      await resend.emails.send({
        from: `${config.email.fromName} <${config.email.fromEmail}>`,
        to: [email.toLowerCase()],
        subject: `Invitation to join ${company?.name || 'invoSmart'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>You've been invited!</h1>
              </div>
              <div class="content">
                <p>Hello ${name},</p>
                <p>You have been invited to join <strong>${company?.name || 'the company'}</strong> on invoSmart.</p>
                <p>You will be added as a <strong>${role}</strong>.</p>
                <p>Click the button below to accept the invitation and set up your account:</p>
                <div style="text-align: center;">
                  <a href="${invitationLink}" class="button">Accept Invitation</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666; font-size: 12px;">${invitationLink}</p>
                <p><strong>This invitation will expire in 7 days.</strong></p>
                <p>If you didn't expect this invitation, you can safely ignore this email.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} invoSmart. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Hello ${name},\n\nYou have been invited to join ${company?.name || 'the company'} on invoSmart as a ${role}.\n\nAccept your invitation by clicking this link: ${invitationLink}\n\nThis invitation will expire in 7 days.\n\nIf you didn't expect this invitation, you can safely ignore this email.`
      })

      console.log(`✅ Invitation email sent to ${email}`)
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError)
      // Don't fail the request if email fails - invitation is still created
    }

    // Log audit event
    try {
      await createAuditLog(
        req.user!.id,
        req.user!.name,
        'USER_INVITED',
        'USER_INVITATION',
        invitation.id,
        { email: email.toLowerCase(), name, role },
        req.ip,
        req.get('User-Agent')
      )
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
      // Continue even if audit log fails
    }

    return res.json({ 
      success: true, 
      message: 'Invitation sent successfully',
      data: {
        invitationId: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expires_at
      }
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





