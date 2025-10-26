import { Response } from 'express'
import { supabase } from '../lib/supabase'
import EmailService from '../services/emailService'
import { DatabaseInvoice, DatabaseCustomer, DatabaseCompany, AuthenticatedRequest } from '../types'

export const sendInvoiceReminder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { invoiceId, reminderLevel = 1 } = req.body
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID required' })
    }

    if (!invoiceId) {
      return res.status(400).json({ error: 'Invoice ID required' })
    }

    // Get invoice with customer and company data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        customers (*),
        companies (*)
      `)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()

    if (invoiceError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    const invoiceData = invoice as DatabaseInvoice & { 
      customers: DatabaseCustomer
      companies: DatabaseCompany 
    }

    // Send reminder email
    const emailService = new EmailService()
    const result = await emailService.sendInvoiceReminder({
      invoice: invoiceData,
      customer: invoiceData.customers,
      company: invoiceData.companies,
      reminderLevel
    })

    if (result.success) {
      // Update reminder level and last reminder date
      await supabase
        .from('invoices')
        .update({
          reminder_level: reminderLevel,
          last_reminder_at: new Date().toISOString()
        })
        .eq('id', invoiceId)

      return res.json({ 
        success: true, 
        message: 'Reminder sent successfully',
        data: result 
      })
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send reminder',
        details: result.error 
      })
    }

  } catch (error) {
    console.error('Error sending reminder:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
}

export const sendInvoiceNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { invoiceId } = req.body
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID required' })
    }

    if (!invoiceId) {
      return res.status(400).json({ error: 'Invoice ID required' })
    }

    // Get invoice with customer and company data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        customers (*),
        companies (*)
      `)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()

    if (invoiceError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    const invoiceData = invoice as DatabaseInvoice & { 
      customers: DatabaseCustomer
      companies: DatabaseCompany 
    }

    // Send notification email
    const emailService = new EmailService()
    const result = await emailService.sendInvoiceNotification({
      invoice: invoiceData,
      customer: invoiceData.customers,
      company: invoiceData.companies
    })

    if (result.success) {
      // Update sent_at timestamp
      await supabase
        .from('invoices')
        .update({
          sent_at: new Date().toISOString(),
          email_sent_count: (invoiceData.email_sent_count || 0) + 1
        })
        .eq('id', invoiceId)

      return res.json({ 
        success: true, 
        message: 'Notification sent successfully',
        data: result 
      })
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send notification',
        details: result.error 
      })
    }

  } catch (error) {
    console.error('Error sending notification:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
}

export const sendBulkReminders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reminderLevel = 1 } = req.body
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID required' })
    }

    // Get all overdue invoices
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select(`
        *,
        customers (*),
        companies (*)
      `)
      .eq('company_id', companyId)
      .in('status', ['OPEN', 'PARTIAL_PAID'])
      .lt('due_date', new Date().toISOString().split('T')[0])

    if (invoicesError) {
      return res.status(500).json({ error: 'Failed to fetch invoices' })
    }

    if (!invoices || invoices.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No overdue invoices found',
        sent: 0 
      })
    }

    const emailService = new EmailService()
    let sentCount = 0
    const errors: string[] = []

    // Send reminders for each invoice
    for (const invoice of invoices) {
      try {
        const invoiceData = invoice as DatabaseInvoice & { 
          customers: DatabaseCustomer
          companies: DatabaseCompany 
        }

        const result = await emailService.sendInvoiceReminder({
          invoice: invoiceData,
          customer: invoiceData.customers,
          company: invoiceData.companies,
          reminderLevel
        })
        
        if (result.success) {
          // Update reminder level and last reminder date
          await supabase
            .from('invoices')
            .update({
              reminder_level: reminderLevel,
              last_reminder_at: new Date().toISOString()
            })
            .eq('id', invoice.id)

          sentCount++
        } else {
          errors.push(`Invoice ${invoice.number}: ${result.error}`)
        }
      } catch (error) {
        errors.push(`Invoice ${invoice.number}: ${error}`)
      }
    }

    return res.json({ 
      success: true, 
      message: `Bulk reminders sent: ${sentCount}/${invoices.length}`,
      sent: sentCount,
      total: invoices.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Error sending bulk reminders:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
}

export const testEmail = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.body
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID required' })
    }

    if (!email) {
      return res.status(400).json({ error: 'Email address required' })
    }

    // Get company data
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Create test invoice data
    const testInvoiceData = {
      id: 'test',
      number: 'TEST-2025-001',
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      subtotal: 100000, // 1000.00 CHF in Rappen
      vat_amount: 8000, // 80.00 CHF in Rappen
      total: 108000, // 1080.00 CHF in Rappen
      status: 'OPEN',
      customers: {
        name: 'Test Customer',
        email: email,
        company: 'Test Company Ltd.',
        language: 'de'
      },
      companies: company as DatabaseCompany
    } as DatabaseInvoice & { 
      customers: DatabaseCustomer
      companies: DatabaseCompany 
    }

    // Send test email
    const emailService = new EmailService()
    const result = await emailService.sendInvoiceReminder({
      invoice: testInvoiceData,
      customer: testInvoiceData.customers,
      company: testInvoiceData.companies,
      reminderLevel: 1
    })

    if (result.success) {
      return res.json({ 
        success: true, 
        message: 'Test email sent successfully',
        data: result 
      })
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send test email',
        details: result.error 
      })
    }

  } catch (error) {
    console.error('Error sending test email:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
}