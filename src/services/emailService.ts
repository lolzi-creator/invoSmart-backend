import { Resend } from 'resend'
import { config } from '../config'
import { DatabaseInvoice, DatabaseCustomer, DatabaseCompany } from '../types'

const resend = new Resend(config.email.resendApiKey)

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface InvoiceEmailData {
  invoice: DatabaseInvoice & { 
    customers?: DatabaseCustomer
    companies?: DatabaseCompany
  }
  customer: DatabaseCustomer
  company: DatabaseCompany
  reminderLevel?: number
}

export class EmailService {
  private static instance: EmailService
  private resend: Resend

  constructor() {
    this.resend = new Resend(config.email.resendApiKey)
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  async sendInvoiceReminder(data: InvoiceEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const template = this.getReminderTemplate(data.reminderLevel || 1)
      const emailData = this.prepareInvoiceEmailData(data, template)

      const result = await this.resend.emails.send({
        from: `${config.email.fromName} <${config.email.fromEmail}>`,
        to: [data.customer.email!],
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        replyTo: data.company.email
      })

      return {
        success: true,
        messageId: result.data?.id
      }
    } catch (error) {
      console.error('Error sending reminder email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async sendInvoiceNotification(data: InvoiceEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const template = this.getInvoiceNotificationTemplate()
      const emailData = this.prepareInvoiceEmailData(data, template)

      const result = await this.resend.emails.send({
        from: `${config.email.fromName} <${config.email.fromEmail}>`,
        to: [data.customer.email!],
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        replyTo: data.company.email
      })

      return {
        success: true,
        messageId: result.data?.id
      }
    } catch (error) {
      console.error('Error sending invoice notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private getReminderTemplate(level: number): EmailTemplate {
    const templates = {
      1: {
        subject: 'Friendly Reminder - Invoice Payment Due',
        html: this.getReminder1HTML(),
        text: this.getReminder1Text()
      },
      2: {
        subject: 'Second Reminder - Invoice Payment Overdue',
        html: this.getReminder2HTML(),
        text: this.getReminder2Text()
      },
      3: {
        subject: 'Final Notice - Immediate Payment Required',
        html: this.getReminder3HTML(),
        text: this.getReminder3Text()
      }
    }

    return templates[level as keyof typeof templates] || templates[1]
  }

  private getInvoiceNotificationTemplate(): EmailTemplate {
    return {
      subject: 'New Invoice - Payment Required',
      html: this.getInvoiceNotificationHTML(),
      text: this.getInvoiceNotificationText()
    }
  }

  private prepareInvoiceEmailData(data: InvoiceEmailData, template: EmailTemplate): EmailTemplate {
    const { invoice, customer, company } = data
    
    // Format amounts in Swiss Francs
    const formatAmount = (amount: number) => {
      return new Intl.NumberFormat('de-CH', {
        style: 'currency',
        currency: 'CHF'
      }).format(amount / 100)
    }

    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString('de-CH')
    }

    // Generate logo HTML if available
    const logoHTML = company.logo_url
      ? `<img src="${company.logo_url}" alt="${company.name}" style="max-width: 150px; max-height: 80px; object-fit: contain;" />`
      : `<div style="color: #666; font-size: 14px;">${company.name}</div>`

    // Replace placeholders in template
    const replacements = {
      '{{CUSTOMER_NAME}}': customer.name || customer.company || 'Valued Customer',
      '{{COMPANY_NAME}}': company.name,
      '{{COMPANY_LOGO}}': logoHTML,
      '{{INVOICE_NUMBER}}': invoice.number,
      '{{INVOICE_AMOUNT}}': formatAmount(invoice.total),
      '{{DUE_DATE}}': formatDate(invoice.due_date),
      '{{INVOICE_DATE}}': formatDate(invoice.date),
      '{{COMPANY_EMAIL}}': company.email,
      '{{COMPANY_PHONE}}': company.phone || '',
      '{{COMPANY_WEBSITE}}': company.website || '',
      '{{OVERDUE_DAYS}}': this.calculateOverdueDays(invoice.due_date).toString()
    }

    let html = template.html
    let text = template.text
    let subject = template.subject

    Object.entries(replacements).forEach(([placeholder, value]) => {
      html = html.replace(new RegExp(placeholder, 'g'), value)
      text = text.replace(new RegExp(placeholder, 'g'), value)
      subject = subject.replace(new RegExp(placeholder, 'g'), value)
    })

    return { subject, html, text }
  }

  private calculateOverdueDays(dueDate: string): number {
    const due = new Date(dueDate)
    const now = new Date()
    const diffTime = now.getTime() - due.getTime()
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  }

  // Template HTML methods
  private getReminder1HTML(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Friendly Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; }
          .header-content { flex: 1; }
          .header-logo { margin-left: 20px; text-align: right; }
          .content { background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; }
          .invoice-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .amount { font-size: 24px; font-weight: bold; color: #dc3545; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-content">
            <h2 style="margin: 0;">Friendly Reminder - Invoice Payment Due</h2>
          </div>
          <div class="header-logo">
            {{COMPANY_LOGO}}
          </div>
        </div>
        
        <div class="content">
          <p>Dear {{CUSTOMER_NAME}},</p>
          
          <p>We hope this message finds you well. This is a friendly reminder that payment for the following invoice is due:</p>
          
          <div class="invoice-details">
            <strong>Invoice Number:</strong> {{INVOICE_NUMBER}}<br>
            <strong>Amount Due:</strong> <span class="amount">{{INVOICE_AMOUNT}}</span><br>
            <strong>Due Date:</strong> {{DUE_DATE}}<br>
            <strong>Invoice Date:</strong> {{INVOICE_DATE}}
          </div>
          
          <p>If you have already made this payment, please disregard this notice. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to contact us.</p>
          
          <p>Thank you for your prompt attention to this matter.</p>
          
          <p>Best regards,<br>
          {{COMPANY_NAME}}</p>
        </div>
        
        <div class="footer">
          <p>If you have any questions, please contact us:</p>
          <p>Email: {{COMPANY_EMAIL}}<br>
          {{#COMPANY_PHONE}}Phone: {{COMPANY_PHONE}}<br>{{/COMPANY_PHONE}}
          {{#COMPANY_WEBSITE}}Website: {{COMPANY_WEBSITE}}{{/COMPANY_WEBSITE}}</p>
        </div>
      </body>
      </html>
    `
  }

  private getReminder2HTML(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Second Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107; display: flex; align-items: center; justify-content: space-between; }
          .header-content { flex: 1; }
          .header-logo { margin-left: 20px; text-align: right; }
          .content { background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; }
          .invoice-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .amount { font-size: 24px; font-weight: bold; color: #dc3545; }
          .overdue { color: #dc3545; font-weight: bold; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-content">
            <h2 style="margin: 0;">Second Reminder - Invoice Payment Overdue</h2>
          </div>
          <div class="header-logo">
            {{COMPANY_LOGO}}
          </div>
        </div>
        
        <div class="content">
          <p>Dear {{CUSTOMER_NAME}},</p>
          
          <p>We are writing to remind you that payment for the following invoice is now overdue by {{OVERDUE_DAYS}} days:</p>
          
          <div class="invoice-details">
            <strong>Invoice Number:</strong> {{INVOICE_NUMBER}}<br>
            <strong>Amount Due:</strong> <span class="amount">{{INVOICE_AMOUNT}}</span><br>
            <strong>Due Date:</strong> {{DUE_DATE}}<br>
            <strong>Days Overdue:</strong> <span class="overdue">{{OVERDUE_DAYS}} days</span>
          </div>
          
          <p>We understand that sometimes delays can occur, but we need to receive payment as soon as possible. If you have already made this payment, please disregard this notice.</p>
          
          <p>If you are experiencing any difficulties with payment, please contact us immediately to discuss possible arrangements.</p>
          
          <p>We appreciate your immediate attention to this matter.</p>
          
          <p>Best regards,<br>
          {{COMPANY_NAME}}</p>
        </div>
        
        <div class="footer">
          <p>If you have any questions, please contact us:</p>
          <p>Email: {{COMPANY_EMAIL}}<br>
          {{#COMPANY_PHONE}}Phone: {{COMPANY_PHONE}}<br>{{/COMPANY_PHONE}}
          {{#COMPANY_WEBSITE}}Website: {{COMPANY_WEBSITE}}{{/COMPANY_WEBSITE}}</p>
        </div>
      </body>
      </html>
    `
  }

  private getReminder3HTML(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Final Notice</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8d7da; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc3545; display: flex; align-items: center; justify-content: space-between; }
          .header-content { flex: 1; }
          .header-logo { margin-left: 20px; text-align: right; }
          .content { background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; }
          .invoice-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .amount { font-size: 24px; font-weight: bold; color: #dc3545; }
          .overdue { color: #dc3545; font-weight: bold; }
          .urgent { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-content">
            <h2 style="margin: 0;">Final Notice - Immediate Payment Required</h2>
          </div>
          <div class="header-logo">
            {{COMPANY_LOGO}}
          </div>
        </div>
        
        <div class="content">
          <p>Dear {{CUSTOMER_NAME}},</p>
          
          <div class="urgent">
            <strong>URGENT:</strong> This is our final notice regarding the overdue payment for invoice {{INVOICE_NUMBER}}.
          </div>
          
          <p>The following invoice is now significantly overdue by {{OVERDUE_DAYS}} days:</p>
          
          <div class="invoice-details">
            <strong>Invoice Number:</strong> {{INVOICE_NUMBER}}<br>
            <strong>Amount Due:</strong> <span class="amount">{{INVOICE_AMOUNT}}</span><br>
            <strong>Due Date:</strong> {{DUE_DATE}}<br>
            <strong>Days Overdue:</strong> <span class="overdue">{{OVERDUE_DAYS}} days</span>
          </div>
          
          <p>We have sent multiple reminders regarding this outstanding payment. If payment is not received within 7 days, we will be forced to take further action to recover this debt.</p>
          
          <p>If you have already made this payment, please contact us immediately with proof of payment. If you are experiencing financial difficulties, please contact us today to discuss payment arrangements.</p>
          
          <p>This matter requires your immediate attention.</p>
          
          <p>Best regards,<br>
          {{COMPANY_NAME}}</p>
        </div>
        
        <div class="footer">
          <p>If you have any questions, please contact us immediately:</p>
          <p>Email: {{COMPANY_EMAIL}}<br>
          {{#COMPANY_PHONE}}Phone: {{COMPANY_PHONE}}<br>{{/COMPANY_PHONE}}
          {{#COMPANY_WEBSITE}}Website: {{COMPANY_WEBSITE}}{{/COMPANY_WEBSITE}}</p>
        </div>
      </body>
      </html>
    `
  }

  private getInvoiceNotificationHTML(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Invoice</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #28a745; display: flex; align-items: center; justify-content: space-between; }
          .header-content { flex: 1; }
          .header-logo { margin-left: 20px; text-align: right; }
          .content { background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; }
          .invoice-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .amount { font-size: 24px; font-weight: bold; color: #28a745; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
          .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-content">
            <h2 style="margin: 0;">New Invoice - Payment Required</h2>
          </div>
          <div class="header-logo">
            {{COMPANY_LOGO}}
          </div>
        </div>
        
        <div class="content">
          <p>Dear {{CUSTOMER_NAME}},</p>
          
          <p>Thank you for your business! We have issued a new invoice for your recent purchase/service:</p>
          
          <div class="invoice-details">
            <strong>Invoice Number:</strong> {{INVOICE_NUMBER}}<br>
            <strong>Amount Due:</strong> <span class="amount">{{INVOICE_AMOUNT}}</span><br>
            <strong>Due Date:</strong> {{DUE_DATE}}<br>
            <strong>Invoice Date:</strong> {{INVOICE_DATE}}
          </div>
          
          <p>Please remit payment by the due date. If you have any questions about this invoice, please don't hesitate to contact us.</p>
          
          <p>Thank you for your prompt payment.</p>
          
          <p>Best regards,<br>
          {{COMPANY_NAME}}</p>
        </div>
        
        <div class="footer">
          <p>If you have any questions, please contact us:</p>
          <p>Email: {{COMPANY_EMAIL}}<br>
          {{#COMPANY_PHONE}}Phone: {{COMPANY_PHONE}}<br>{{/COMPANY_PHONE}}
          {{#COMPANY_WEBSITE}}Website: {{COMPANY_WEBSITE}}{{/COMPANY_WEBSITE}}</p>
        </div>
      </body>
      </html>
    `
  }

  // Text versions for email clients that don't support HTML
  private getReminder1Text(): string {
    return `
FRIENDLY REMINDER - INVOICE PAYMENT DUE

Dear {{CUSTOMER_NAME}},

We hope this message finds you well. This is a friendly reminder that payment for the following invoice is due:

Invoice Number: {{INVOICE_NUMBER}}
Amount Due: {{INVOICE_AMOUNT}}
Due Date: {{DUE_DATE}}
Invoice Date: {{INVOICE_DATE}}

If you have already made this payment, please disregard this notice. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to contact us.

Thank you for your prompt attention to this matter.

Best regards,
{{COMPANY_NAME}}

---
If you have any questions, please contact us:
Email: {{COMPANY_EMAIL}}
{{#COMPANY_PHONE}}Phone: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
{{#COMPANY_WEBSITE}}Website: {{COMPANY_WEBSITE}}{{/COMPANY_WEBSITE}}
    `.trim()
  }

  private getReminder2Text(): string {
    return `
SECOND REMINDER - INVOICE PAYMENT OVERDUE

Dear {{CUSTOMER_NAME}},

We are writing to remind you that payment for the following invoice is now overdue by {{OVERDUE_DAYS}} days:

Invoice Number: {{INVOICE_NUMBER}}
Amount Due: {{INVOICE_AMOUNT}}
Due Date: {{DUE_DATE}}
Days Overdue: {{OVERDUE_DAYS}} days

We understand that sometimes delays can occur, but we need to receive payment as soon as possible. If you have already made this payment, please disregard this notice.

If you are experiencing any difficulties with payment, please contact us immediately to discuss possible arrangements.

We appreciate your immediate attention to this matter.

Best regards,
{{COMPANY_NAME}}

---
If you have any questions, please contact us:
Email: {{COMPANY_EMAIL}}
{{#COMPANY_PHONE}}Phone: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
{{#COMPANY_WEBSITE}}Website: {{COMPANY_WEBSITE}}{{/COMPANY_WEBSITE}}
    `.trim()
  }

  private getReminder3Text(): string {
    return `
FINAL NOTICE - IMMEDIATE PAYMENT REQUIRED

Dear {{CUSTOMER_NAME}},

URGENT: This is our final notice regarding the overdue payment for invoice {{INVOICE_NUMBER}}.

The following invoice is now significantly overdue by {{OVERDUE_DAYS}} days:

Invoice Number: {{INVOICE_NUMBER}}
Amount Due: {{INVOICE_AMOUNT}}
Due Date: {{DUE_DATE}}
Days Overdue: {{OVERDUE_DAYS}} days

We have sent multiple reminders regarding this outstanding payment. If payment is not received within 7 days, we will be forced to take further action to recover this debt.

If you have already made this payment, please contact us immediately with proof of payment. If you are experiencing financial difficulties, please contact us today to discuss payment arrangements.

This matter requires your immediate attention.

Best regards,
{{COMPANY_NAME}}

---
If you have any questions, please contact us immediately:
Email: {{COMPANY_EMAIL}}
{{#COMPANY_PHONE}}Phone: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
{{#COMPANY_WEBSITE}}Website: {{COMPANY_WEBSITE}}{{/COMPANY_WEBSITE}}
    `.trim()
  }

  private getInvoiceNotificationText(): string {
    return `
NEW INVOICE - PAYMENT REQUIRED

Dear {{CUSTOMER_NAME}},

Thank you for your business! We have issued a new invoice for your recent purchase/service:

Invoice Number: {{INVOICE_NUMBER}}
Amount Due: {{INVOICE_AMOUNT}}
Due Date: {{DUE_DATE}}
Invoice Date: {{INVOICE_DATE}}

Please remit payment by the due date. If you have any questions about this invoice, please don't hesitate to contact us.

Thank you for your prompt payment.

Best regards,
{{COMPANY_NAME}}

---
If you have any questions, please contact us:
Email: {{COMPANY_EMAIL}}
{{#COMPANY_PHONE}}Phone: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
{{#COMPANY_WEBSITE}}Website: {{COMPANY_WEBSITE}}{{/COMPANY_WEBSITE}}
    `.trim()
  }
}

export default EmailService






