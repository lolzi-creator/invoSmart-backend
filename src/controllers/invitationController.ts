import { Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { AuthenticatedRequest } from '../types'
import bcrypt from 'bcryptjs'
import { config } from '../config'
import { Resend } from 'resend'

const resend = new Resend(config.email.resendApiKey)

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

    // Get company info for welcome email
    const { data: company } = await supabaseAdmin.from('companies')
      .select('id, name, email, logo_url')
      .eq('id', invitation.company_id)
      .single()

    // Fetch user's permissions based on their role
    const { data: rolePermissions } = await supabaseAdmin.from('role_permissions')
      .select(`
        *,
        permissions (
          id,
          name,
          description,
          module
        )
      `)
      .eq('company_id', invitation.company_id)
      .eq('role', newUser.role)
      .eq('is_granted', true)

    // Group permissions by module
    const permissionsByModule: { [key: string]: any[] } = {}
    rolePermissions?.forEach((rp: any) => {
      if (rp.permissions) {
        const module = rp.permissions.module || 'Other'
        if (!permissionsByModule[module]) {
          permissionsByModule[module] = []
        }
        permissionsByModule[module].push({
          name: rp.permissions.name,
          description: rp.permissions.description || rp.permissions.name
        })
      }
    })

    // Send welcome email
    try {
      const frontendUrl = process.env.FRONTEND_URL || config.frontendUrl || 'http://localhost:5173'
      
      // Generate logo HTML if company has logo
      let logoHTML = ''
      if (company?.logo_url) {
        logoHTML = `<img src="${company.logo_url}" alt="${company.name}" style="max-width: 200px; max-height: 100px; object-fit: contain; margin-bottom: 20px;" />`
      }

      // Build permissions HTML
      let permissionsHTML = ''
      const moduleNames: { [key: string]: string } = {
        'invoices': 'Invoices',
        'quotes': 'Quotes',
        'customers': 'Customers',
        'payments': 'Payments',
        'expenses': 'Expenses',
        'settings': 'Settings',
        'reports': 'Reports',
        'users': 'User Management'
      }

      Object.entries(permissionsByModule).forEach(([module, perms]) => {
        const moduleDisplayName = moduleNames[module] || module.charAt(0).toUpperCase() + module.slice(1)
        permissionsHTML += `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #2563eb; font-size: 16px; margin-bottom: 10px;">${moduleDisplayName}</h3>
            <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
              ${perms.map(p => `<li style="margin-bottom: 5px;">${p.description}</li>`).join('')}
            </ul>
          </div>
        `
      })

      const roleDisplayName = newUser.role === 'ADMIN' ? 'Administrator' : 'Employee'

      await resend.emails.send({
        from: `${config.email.fromName} <${config.email.fromEmail}>`,
        to: [newUser.email],
        subject: `Welcome to ${company?.name || 'invoSmart'}!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to ${company?.name || 'invoSmart'}</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                line-height: 1.6; 
                color: #1a1a1a; 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px; 
                background: #f8f9fa; 
              }
              .container { 
                background: white; 
                border-radius: 8px; 
                overflow: hidden; 
                box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
              }
              .header { 
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                color: white; 
                padding: 40px 24px; 
                text-align: center; 
              }
              .logo { margin-bottom: 20px; }
              .header h1 { 
                margin: 0; 
                font-size: 28px; 
                font-weight: 600; 
              }
              .content { padding: 32px 24px; }
              .greeting { 
                font-size: 18px; 
                margin-bottom: 24px; 
                color: #1a1a1a; 
              }
              .welcome-box { 
                background: #f0f9ff; 
                border-left: 4px solid #2563eb; 
                border-radius: 6px; 
                padding: 20px; 
                margin: 24px 0; 
              }
              .info-section {
                background: #f8f9fa;
                border-radius: 6px;
                padding: 20px;
                margin: 24px 0;
              }
              .info-section h2 {
                color: #1a1a1a;
                font-size: 20px;
                margin: 0 0 16px 0;
              }
              .info-row {
                display: flex;
                padding: 12px 0;
                border-bottom: 1px solid #e5e7eb;
              }
              .info-row:last-child {
                border-bottom: none;
              }
              .info-label {
                font-weight: 600;
                color: #6b7280;
                width: 140px;
              }
              .info-value {
                color: #1a1a1a;
                flex: 1;
              }
              .permissions-list {
                margin-top: 16px;
              }
              .login-button { 
                display: inline-block; 
                background: #2563eb; 
                color: white; 
                padding: 14px 28px; 
                text-decoration: none; 
                border-radius: 6px; 
                font-weight: 500; 
                margin: 24px 0;
                text-align: center;
              }
              .footer { 
                background: #f8f9fa; 
                padding: 24px; 
                border-top: 1px solid #e9ecef; 
                font-size: 14px; 
                color: #6c757d; 
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                ${logoHTML}
                <h1>Welcome to ${company?.name || 'invoSmart'}!</h1>
              </div>
              
              <div class="content">
                <div class="greeting">
                  Hello ${newUser.name || newUser.email.split('@')[0]},
                </div>
                
                <div class="welcome-box">
                  <p style="margin: 0; font-size: 16px; line-height: 1.6;">
                    Your account has been successfully created! You're now part of the <strong>${company?.name || 'invoSmart'}</strong> team.
                  </p>
                </div>

                <div class="info-section">
                  <h2>Your Account Details</h2>
                  <div class="info-row">
                    <div class="info-label">Email:</div>
                    <div class="info-value">${newUser.email}</div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">Role:</div>
                    <div class="info-value"><strong>${roleDisplayName}</strong></div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">Company:</div>
                    <div class="info-value">${company?.name || 'N/A'}</div>
                  </div>
                </div>

                <div class="info-section">
                  <h2>Your Permissions</h2>
                  <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px;">
                    As a <strong>${roleDisplayName}</strong>, you have access to the following features:
                  </p>
                  <div class="permissions-list">
                    ${permissionsHTML || '<p style="color: #6b7280;">No specific permissions assigned yet.</p>'}
                  </div>
                </div>

                <div style="text-align: center; margin: 32px 0;">
                  <a href="${frontendUrl}/login" class="login-button">Login to Your Account</a>
                </div>

                <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                  If you have any questions or need assistance, please don't hesitate to contact your administrator or reach out to us at <a href="mailto:${company?.email || config.email.fromEmail}" style="color: #2563eb;">${company?.email || config.email.fromEmail}</a>.
                </p>

                <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                  Best regards,<br>
                  <strong>The ${company?.name || 'invoSmart'} Team</strong>
                </p>
              </div>
              
              <div class="footer">
                <p style="margin: 0;">
                  © ${new Date().getFullYear()} ${company?.name || 'invoSmart'}. All rights reserved.
                </p>
                <p style="margin: 8px 0 0 0;">
                  This email was sent because an account was created for you. If you didn't expect this, please contact your administrator.
                </p>
              </div>
            </div>
          </body>
          </html>
        `
      })
      console.log(`Welcome email sent to ${newUser.email}`)
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError)
      // Don't fail the invitation acceptance if email fails
    }

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

