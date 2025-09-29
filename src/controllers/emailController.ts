import { Request, Response } from 'express'
import nodemailer from 'nodemailer'
import { asyncHandler } from '../middleware/errorHandler'
import { AuthenticatedRequest } from '../middleware/auth'
import {
  EmailTemplate,
  EmailType,
  ApiResponse
} from '../types'
import { 
  db, 
  handleSupabaseError, 
  DatabaseEmailTemplate,
  DatabaseInvoice,
  DatabaseCustomer,
  DatabaseCompany
} from '../lib/supabase'
import { config } from '../config'

// Helper function to convert DB email template to API email template
const createEmailTemplateResponse = (dbTemplate: DatabaseEmailTemplate): EmailTemplate => {
  return {
    id: dbTemplate.id,
    companyId: dbTemplate.company_id,
    name: dbTemplate.name,
    subject: dbTemplate.subject,
    body: dbTemplate.body,
    type: dbTemplate.type as EmailType,
    language: dbTemplate.language,
    isActive: dbTemplate.is_active,
    createdAt: new Date(dbTemplate.created_at),
    updatedAt: new Date(dbTemplate.updated_at)
  }
}

// Helper function to create nodemailer transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  })
}

// Helper function to replace template variables
const replaceTemplateVariables = (
  template: string,
  data: {
    invoice?: DatabaseInvoice
    customer?: DatabaseCustomer
    company?: DatabaseCompany
    [key: string]: any
  }
): string => {
  let result = template

  if (data.invoice) {
    result = result
      .replace(/{{invoiceNumber}}/g, data.invoice.number)
      .replace(/{{invoiceDate}}/g, new Date(data.invoice.date).toLocaleDateString('de-CH'))
      .replace(/{{dueDate}}/g, new Date(data.invoice.due_date).toLocaleDateString('de-CH'))
      .replace(/{{total}}/g, (data.invoice.total / 100).toFixed(2))
      .replace(/{{subtotal}}/g, (data.invoice.subtotal / 100).toFixed(2))
      .replace(/{{vatAmount}}/g, (data.invoice.vat_amount / 100).toFixed(2))
      .replace(/{{qrReference}}/g, data.invoice.qr_reference)
  }

  if (data.customer) {
    result = result
      .replace(/{{customerName}}/g, data.customer.name)
      .replace(/{{customerCompany}}/g, data.customer.company || '')
      .replace(/{{customerAddress}}/g, data.customer.address)
      .replace(/{{customerZip}}/g, data.customer.zip)
      .replace(/{{customerCity}}/g, data.customer.city)
  }

  if (data.company) {
    result = result
      .replace(/{{companyName}}/g, data.company.name)
      .replace(/{{companyAddress}}/g, data.company.address)
      .replace(/{{companyZip}}/g, data.company.zip)
      .replace(/{{companyCity}}/g, data.company.city)
      .replace(/{{companyPhone}}/g, data.company.phone || '')
      .replace(/{{companyEmail}}/g, data.company.email)
      .replace(/{{companyWebsite}}/g, data.company.website || '')
  }

  return result
}

/**
 * @desc    Get all email templates
 * @route   GET /api/v1/emails/templates
 * @access  Private
 */
export const getEmailTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  
  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    const { data, error } = await db.emailTemplates()
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true })

    if (error) {
      handleSupabaseError(error, 'get email templates')
      return
    }

    const templates = (data as DatabaseEmailTemplate[]).map(createEmailTemplateResponse)

    res.json({
      success: true,
      data: { templates }
    })

  } catch (error) {
    handleSupabaseError(error, 'get email templates')
  }
})

/**
 * @desc    Create email template
 * @route   POST /api/v1/emails/templates
 * @access  Private
 */
export const createEmailTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  const {
    name,
    subject,
    body,
    type,
    language = 'de'
  } = req.body

  try {
    const templateData = {
      company_id: companyId,
      name,
      subject,
      body,
      type,
      language,
      is_active: true
    }

    const { data, error } = await db.emailTemplates()
      .insert(templateData)
      .select()
      .single()

    if (error || !data) {
      handleSupabaseError(error, 'create email template')
      return
    }

    const template = createEmailTemplateResponse(data as DatabaseEmailTemplate)

    res.status(201).json({
      success: true,
      message: 'Email template created successfully',
      data: { template }
    })

  } catch (error) {
    handleSupabaseError(error, 'create email template')
  }
})

/**
 * @desc    Update email template
 * @route   PUT /api/v1/emails/templates/:id
 * @access  Private
 */
export const updateEmailTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const templateId = req.params.id

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  const {
    name,
    subject,
    body,
    type,
    language,
    isActive
  } = req.body

  try {
    // Prepare update data
    const updateData: Partial<DatabaseEmailTemplate> = {}
    
    if (name !== undefined) updateData.name = name
    if (subject !== undefined) updateData.subject = subject
    if (body !== undefined) updateData.body = body
    if (type !== undefined) updateData.type = type
    if (language !== undefined) updateData.language = language
    if (isActive !== undefined) updateData.is_active = isActive

    const { data, error } = await db.emailTemplates()
      .update(updateData)
      .eq('id', templateId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error || !data) {
      res.status(404).json({
        success: false,
        error: 'Email template not found'
      })
      return
    }

    const template = createEmailTemplateResponse(data as DatabaseEmailTemplate)

    res.json({
      success: true,
      message: 'Email template updated successfully',
      data: { template }
    })

  } catch (error) {
    handleSupabaseError(error, 'update email template')
  }
})

/**
 * @desc    Delete email template
 * @route   DELETE /api/v1/emails/templates/:id
 * @access  Private
 */
export const deleteEmailTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const templateId = req.params.id

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    const { error } = await db.emailTemplates()
      .delete()
      .eq('id', templateId)
      .eq('company_id', companyId)

    if (error) {
      handleSupabaseError(error, 'delete email template')
      return
    }

    res.json({
      success: true,
      message: 'Email template deleted successfully'
    })

  } catch (error) {
    handleSupabaseError(error, 'delete email template')
  }
})

/**
 * @desc    Send invoice email
 * @route   POST /api/v1/emails/invoice/:invoiceId
 * @access  Private
 */
export const sendInvoiceEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const invoiceId = req.params.invoiceId
  const { templateId, recipientEmail } = req.body

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get invoice with customer and company data
    const { data: invoiceData, error: invoiceError } = await db.invoices()
      .select(`
        *,
        customers (*),
        companies (*)
      `)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()

    if (invoiceError || !invoiceData) {
      res.status(404).json({
        success: false,
        error: 'Invoice not found'
      })
      return
    }

    // Get email template
    const { data: template, error: templateError } = await db.emailTemplates()
      .select('*')
      .eq('id', templateId)
      .eq('company_id', companyId)
      .single()

    if (templateError || !template) {
      res.status(404).json({
        success: false,
        error: 'Email template not found'
      })
      return
    }

    // Replace template variables
    const emailSubject = replaceTemplateVariables(template.subject, {
      invoice: invoiceData,
      customer: invoiceData.customers,
      company: invoiceData.companies
    })

    const emailBody = replaceTemplateVariables(template.body, {
      invoice: invoiceData,
      customer: invoiceData.customers,
      company: invoiceData.companies
    })

    // Send email
    const transporter = createTransporter()
    const recipient = recipientEmail || invoiceData.customers.email

    if (!recipient) {
      res.status(400).json({
        success: false,
        error: 'No recipient email address provided'
      })
      return
    }

    const mailOptions = {
      from: `"${invoiceData.companies.name}" <${config.smtp.user}>`,
      to: recipient,
      subject: emailSubject,
      text: emailBody,
      html: emailBody.replace(/\n/g, '<br>')
    }

    try {
      await transporter.sendMail(mailOptions)

      // Update invoice email sent count
      await db.invoices()
        .update({ 
          email_sent_count: invoiceData.email_sent_count + 1,
          sent_at: new Date().toISOString()
        })
        .eq('id', invoiceId)

      res.json({
        success: true,
        message: 'Invoice email sent successfully',
        data: {
          recipient,
          subject: emailSubject
        }
      })

    } catch (emailError) {
      console.error('Failed to send email:', emailError)
      res.status(500).json({
        success: false,
        error: 'Failed to send email'
      })
    }

  } catch (error) {
    handleSupabaseError(error, 'send invoice email')
  }
})

/**
 * @desc    Send reminder email
 * @route   POST /api/v1/emails/reminder/:invoiceId
 * @access  Private
 */
export const sendReminderEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const invoiceId = req.params.invoiceId
  const { templateId, recipientEmail } = req.body

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get invoice with customer and company data
    const { data: invoiceData, error: invoiceError } = await db.invoices()
      .select(`
        *,
        customers (*),
        companies (*)
      `)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()

    if (invoiceError || !invoiceData) {
      res.status(404).json({
        success: false,
        error: 'Invoice not found'
      })
      return
    }

    // Check if invoice is overdue or open
    if (!['OPEN', 'PARTIAL_PAID', 'OVERDUE'].includes(invoiceData.status)) {
      res.status(400).json({
        success: false,
        error: 'Cannot send reminder for paid or cancelled invoice'
      })
      return
    }

    // Get reminder template
    const { data: template, error: templateError } = await db.emailTemplates()
      .select('*')
      .eq('id', templateId)
      .eq('company_id', companyId)
      .single()

    if (templateError || !template) {
      res.status(404).json({
        success: false,
        error: 'Email template not found'
      })
      return
    }

    // Replace template variables
    const emailSubject = replaceTemplateVariables(template.subject, {
      invoice: invoiceData,
      customer: invoiceData.customers,
      company: invoiceData.companies
    })

    const emailBody = replaceTemplateVariables(template.body, {
      invoice: invoiceData,
      customer: invoiceData.customers,
      company: invoiceData.companies
    })

    // Send email
    const transporter = createTransporter()
    const recipient = recipientEmail || invoiceData.customers.email

    if (!recipient) {
      res.status(400).json({
        success: false,
        error: 'No recipient email address provided'
      })
      return
    }

    const mailOptions = {
      from: `"${invoiceData.companies.name}" <${config.smtp.user}>`,
      to: recipient,
      subject: emailSubject,
      text: emailBody,
      html: emailBody.replace(/\n/g, '<br>')
    }

    try {
      await transporter.sendMail(mailOptions)

      // Update invoice reminder level and timestamp
      await db.invoices()
        .update({ 
          reminder_level: invoiceData.reminder_level + 1,
          last_reminder_at: new Date().toISOString(),
          status: 'OVERDUE' // Mark as overdue after reminder
        })
        .eq('id', invoiceId)

      res.json({
        success: true,
        message: 'Reminder email sent successfully',
        data: {
          recipient,
          subject: emailSubject,
          reminderLevel: invoiceData.reminder_level + 1
        }
      })

    } catch (emailError) {
      console.error('Failed to send reminder email:', emailError)
      res.status(500).json({
        success: false,
        error: 'Failed to send reminder email'
      })
    }

  } catch (error) {
    handleSupabaseError(error, 'send reminder email')
  }
})

/**
 * @desc    Preview email content
 * @route   GET /api/v1/emails/preview/:invoiceId
 * @access  Private
 */
export const previewEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const invoiceId = req.params.invoiceId
  const { templateId } = req.query

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get invoice with customer and company data
    const { data: invoiceData, error: invoiceError } = await db.invoices()
      .select(`
        *,
        customers (*),
        companies (*)
      `)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()

    if (invoiceError || !invoiceData) {
      res.status(404).json({
        success: false,
        error: 'Invoice not found'
      })
      return
    }

    // Get email template
    const { data: template, error: templateError } = await db.emailTemplates()
      .select('*')
      .eq('id', templateId)
      .eq('company_id', companyId)
      .single()

    if (templateError || !template) {
      res.status(404).json({
        success: false,
        error: 'Email template not found'
      })
      return
    }

    // Replace template variables
    const previewSubject = replaceTemplateVariables(template.subject, {
      invoice: invoiceData,
      customer: invoiceData.customers,
      company: invoiceData.companies
    })

    const previewBody = replaceTemplateVariables(template.body, {
      invoice: invoiceData,
      customer: invoiceData.customers,
      company: invoiceData.companies
    })

    res.json({
      success: true,
      data: {
        template: createEmailTemplateResponse(template),
        preview: {
          subject: previewSubject,
          body: previewBody,
          recipient: invoiceData.customers.email || 'Keine E-Mail-Adresse hinterlegt'
        }
      }
    })

  } catch (error) {
    handleSupabaseError(error, 'preview email')
  }
})
