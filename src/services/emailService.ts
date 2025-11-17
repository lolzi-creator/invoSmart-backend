import { Resend } from 'resend'
import { config } from '../config'
import { DatabaseInvoice, DatabaseCustomer, DatabaseCompany } from '../types'
import { supabaseAdmin } from '../lib/supabase'

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

export interface QuoteEmailData {
  quote: {
    id: string
    number: string
    date: string | Date
    expiryDate: string | Date
    subtotal: number
    vatAmount: number
    total: number
    acceptanceLink?: string | null
  }
  customer: DatabaseCustomer
  company: DatabaseCompany
}

// Language support: de, en, it, fr
type SupportedLanguage = 'de' | 'en' | 'it' | 'fr'

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

  // Get customer's preferred language or default to German
  private getCustomerLanguage(customer: DatabaseCustomer): SupportedLanguage {
    const lang = customer.language?.toLowerCase()
    if (lang === 'en' || lang === 'it' || lang === 'fr' || lang === 'de') {
      return lang as SupportedLanguage
    }
    return 'de' // Default to German
  }

  async sendInvoiceReminder(data: InvoiceEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const lang = this.getCustomerLanguage(data.customer)
      const template = this.getReminderTemplate(data.reminderLevel || 1, lang)
      const emailData = this.prepareInvoiceEmailData(data, template)

      // Try to attach the reminder PDF if available
      let attachments: Array<{ filename: string; content: string; contentType?: string }> | undefined
      try {
        const notesRaw = (data.invoice as any).internal_notes as string | undefined
        if (notesRaw) {
          const notes = JSON.parse(notesRaw)
          const reminderKey = `reminder_${data.reminderLevel || 1}`
          const filePath = notes?.files?.[reminderKey]
          
          if (filePath) {
            console.log('📎 Fetching reminder PDF from storage:', filePath)
            const { data: dl, error } = await supabaseAdmin.storage.from('invoices').download(filePath)
            if (!error && dl) {
              const arrayBuf = await dl.arrayBuffer()
              const base64 = Buffer.from(arrayBuf).toString('base64')
              const fileName = `Mahnung-${data.reminderLevel}-${data.invoice.number}.pdf`
              attachments = [{ filename: fileName, content: base64, contentType: 'application/pdf' }]
              console.log('✅ Reminder PDF attached:', fileName)
            } else {
              console.error('❌ Error downloading reminder PDF:', error)
            }
          } else {
            console.warn('⚠️ No reminder PDF path found in invoice notes')
          }
        }
      } catch (attachErr) {
        console.warn('⚠️ Email attachment unavailable:', attachErr)
      }

      const result = await this.resend.emails.send({
        from: `${config.email.fromName} <${config.email.fromEmail}>`,
        to: [data.customer.email!],
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        replyTo: data.company.email,
        attachments
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
      const lang = this.getCustomerLanguage(data.customer)
      const template = this.getInvoiceNotificationTemplate(lang)
      const emailData = this.prepareInvoiceEmailData(data, template)
      
      // Try to attach the generated invoice PDF if available
      let attachments: Array<{ filename: string; content: string; contentType?: string }> | undefined
      try {
        const notesRaw = (data.invoice as any).internal_notes as string | undefined
        if (notesRaw) {
          const notes = JSON.parse(notesRaw)
          const file = Array.isArray(notes?.files) ? notes.files.find((f: any) => f.fileType === 'invoice_pdf') : undefined
          if (file?.filePath) {
            const { data: dl, error } = await supabaseAdmin.storage.from('invoices').download(file.filePath)
            if (!error && dl) {
              const arrayBuf = await dl.arrayBuffer()
              const base64 = Buffer.from(arrayBuf).toString('base64')
              attachments = [{ filename: file.fileName || 'invoice.pdf', content: base64, contentType: 'application/pdf' }]
            }
          }
        }
      } catch (attachErr) {
        console.warn('Email attachment unavailable:', attachErr)
      }

      const result = await this.resend.emails.send({
        from: `${config.email.fromName} <${config.email.fromEmail}>`,
        to: [data.customer.email!],
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        replyTo: data.company.email,
        attachments
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

  private getReminderTemplate(level: number, lang: SupportedLanguage): EmailTemplate {
    const templates: Record<number, Record<SupportedLanguage, EmailTemplate>> = {
      1: {
        de: {
          subject: '1. Zahlungserinnerung - Rechnung {{INVOICE_NUMBER}}',
          html: this.getReminder1HTML('de'),
          text: this.getReminder1Text('de')
        },
        en: {
          subject: '1st Payment Reminder - Invoice {{INVOICE_NUMBER}}',
          html: this.getReminder1HTML('en'),
          text: this.getReminder1Text('en')
        },
        it: {
          subject: '1° Sollecito di Pagamento - Fattura {{INVOICE_NUMBER}}',
          html: this.getReminder1HTML('it'),
          text: this.getReminder1Text('it')
        },
        fr: {
          subject: '1er Rappel de Paiement - Facture {{INVOICE_NUMBER}}',
          html: this.getReminder1HTML('fr'),
          text: this.getReminder1Text('fr')
        }
      },
      2: {
        de: {
          subject: '2. Mahnung - Rechnung {{INVOICE_NUMBER}}',
          html: this.getReminder2HTML('de'),
          text: this.getReminder2Text('de')
        },
        en: {
          subject: '2nd Payment Reminder - Invoice {{INVOICE_NUMBER}}',
          html: this.getReminder2HTML('en'),
          text: this.getReminder2Text('en')
        },
        it: {
          subject: '2° Sollecito di Pagamento - Fattura {{INVOICE_NUMBER}}',
          html: this.getReminder2HTML('it'),
          text: this.getReminder2Text('it')
        },
        fr: {
          subject: '2ème Rappel de Paiement - Facture {{INVOICE_NUMBER}}',
          html: this.getReminder2HTML('fr'),
          text: this.getReminder2Text('fr')
        }
      },
      3: {
        de: {
          subject: '3. und letzte Mahnung - Rechnung {{INVOICE_NUMBER}}',
          html: this.getReminder3HTML('de'),
          text: this.getReminder3Text('de')
        },
        en: {
          subject: 'Final Notice - Invoice {{INVOICE_NUMBER}}',
          html: this.getReminder3HTML('en'),
          text: this.getReminder3Text('en')
        },
        it: {
          subject: 'Ultimo Avviso - Fattura {{INVOICE_NUMBER}}',
          html: this.getReminder3HTML('it'),
          text: this.getReminder3Text('it')
        },
        fr: {
          subject: 'Dernier Avis - Facture {{INVOICE_NUMBER}}',
          html: this.getReminder3HTML('fr'),
          text: this.getReminder3Text('fr')
        }
      }
    }

    return templates[level]?.[lang] || templates[1]['de']
  }

  private getInvoiceNotificationTemplate(lang: SupportedLanguage): EmailTemplate {
    const templates: Record<SupportedLanguage, EmailTemplate> = {
      de: {
        subject: 'Neue Rechnung - {{INVOICE_NUMBER}}',
        html: this.getInvoiceNotificationHTML('de'),
        text: this.getInvoiceNotificationText('de')
      },
      en: {
        subject: 'New Invoice - {{INVOICE_NUMBER}}',
        html: this.getInvoiceNotificationHTML('en'),
        text: this.getInvoiceNotificationText('en')
      },
      it: {
        subject: 'Nuova Fattura - {{INVOICE_NUMBER}}',
        html: this.getInvoiceNotificationHTML('it'),
        text: this.getInvoiceNotificationText('it')
      },
      fr: {
        subject: 'Nouvelle Facture - {{INVOICE_NUMBER}}',
        html: this.getInvoiceNotificationHTML('fr'),
        text: this.getInvoiceNotificationText('fr')
      }
    }

    return templates[lang] || templates['de']
  }

  private getQuoteNotificationTemplate(lang: SupportedLanguage): EmailTemplate {
    const templates: Record<SupportedLanguage, EmailTemplate> = {
      de: {
        subject: 'Neue Offerte - {{QUOTE_NUMBER}}',
        html: this.getQuoteNotificationHTML('de'),
        text: this.getQuoteNotificationText('de')
      },
      en: {
        subject: 'New Quote - {{QUOTE_NUMBER}}',
        html: this.getQuoteNotificationHTML('en'),
        text: this.getQuoteNotificationText('en')
      },
      it: {
        subject: 'Nuovo Preventivo - {{QUOTE_NUMBER}}',
        html: this.getQuoteNotificationHTML('it'),
        text: this.getQuoteNotificationText('it')
      },
      fr: {
        subject: 'Nouveau Devis - {{QUOTE_NUMBER}}',
        html: this.getQuoteNotificationHTML('fr'),
        text: this.getQuoteNotificationText('fr')
    }
    }

    return templates[lang] || templates['de']
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

    const formatSwissMwst = (vatNumber?: string | null): string | null => {
      if (!vatNumber) return null
      const digits = (vatNumber.match(/\d/g) || []).join('')
      if (digits.length < 9) return null
      const d = digits.slice(0, 9)
      return `CHE-${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)} MWST`
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
      '{{COMPANY_VAT}}': formatSwissMwst(company.vat_number) || '',
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

    // Handle simple conditional blocks for optional fields
    const phoneBlockRegex = /\{\{#COMPANY_PHONE\}\}([\s\S]*?)\{\{\/COMPANY_PHONE\}\}/g
    const websiteBlockRegex = /\{\{#COMPANY_WEBSITE\}\}([\s\S]*?)\{\{\/COMPANY_WEBSITE\}\}/g
    const vatBlockRegex = /\{\{#COMPANY_VAT\}\}([\s\S]*?)\{\{\/COMPANY_VAT\}\}/g
    if (company.phone) {
      html = html.replace(phoneBlockRegex, `$1`)
      text = text.replace(phoneBlockRegex, `$1`)
    } else {
      html = html.replace(phoneBlockRegex, '')
      text = text.replace(phoneBlockRegex, '')
    }
    if (company.website) {
      html = html.replace(websiteBlockRegex, `$1`)
      text = text.replace(websiteBlockRegex, `$1`)
    } else {
      html = html.replace(websiteBlockRegex, '')
      text = text.replace(websiteBlockRegex, '')
    }
    if (formatSwissMwst(company.vat_number)) {
      html = html.replace(vatBlockRegex, `$1`)
      text = text.replace(vatBlockRegex, `$1`)
    } else {
      html = html.replace(vatBlockRegex, '')
      text = text.replace(vatBlockRegex, '')
    }

    return { subject, html, text }
  }

  private calculateOverdueDays(dueDate: string): number {
    const due = new Date(dueDate)
    const now = new Date()
    const diffTime = now.getTime() - due.getTime()
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  }

  // Translation helper for email content
  private getTranslations(lang: SupportedLanguage) {
    const translations = {
      de: {
        // Invoice
        newInvoice: 'Neue Rechnung',
        thankYou: 'Vielen Dank für Ihr Vertrauen! Wir haben folgende Rechnung für Sie erstellt:',
        invoiceNumber: 'Rechnungsnummer',
        amount: 'Betrag',
        invoiceDate: 'Rechnungsdatum',
        dueDate: 'Zahlbar bis',
        pdfAttached: 'Rechnung als PDF angehängt',
        pdfDescription: 'Die vollständige Rechnung mit allen Details und Zahlungsinformationen (QR-Code) finden Sie im angehängten PDF.',
        paymentRequest: 'Bitte begleichen Sie den Betrag bis zum Fälligkeitsdatum. Bei Fragen zur Rechnung stehen wir Ihnen jederzeit gerne zur Verfügung.',
        greetings: 'Freundliche Grüsse',
        // Reminder 1
        reminder1Title: '1. Zahlungserinnerung',
        reminder1Subtitle: 'Freundliche Erinnerung',
        reminder1Message: 'Unser System zeigt, dass die nachstehende Rechnung noch nicht beglichen wurde. Wir bitten Sie höflich, den offenen Betrag innerhalb der nächsten 10 Tage zu begleichen.',
        openAmount: 'Offener Betrag',
        dueSince: 'Fällig seit',
        overdue: 'Überfällig',
        days: 'Tage',
        reminderPdfAttached: 'Mahnung als PDF angehängt',
        reminderPdfDescription: 'Die vollständige Zahlungserinnerung mit allen Details und einem neuen QR-Code finden Sie im angehängten PDF.',
        alreadyPaid: 'Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben als gegenstandslos.',
        // Reminder 2
        reminder2Title: '2. Mahnung',
        reminder2Subtitle: 'Dringende Zahlungsaufforderung',
        reminder2Message: 'Trotz unserer ersten Mahnung ist die nachstehende Rechnung noch immer offen. Wir bitten Sie dringend, den Betrag inklusive Mahngebühren innerhalb von 5 Tagen zu begleichen.',
        warningNotice: 'Wichtiger Hinweis',
        warningMessage: 'Bei weiterem Zahlungsverzug sehen wir uns leider veranlasst, weitere Massnahmen zu ergreifen.',
        // Reminder 3
        reminder3Title: '3. und letzte Mahnung',
        reminder3Subtitle: 'Letzte Zahlungsaufforderung',
        urgent: 'DRINGEND',
        reminder3Message: 'Dies ist unsere letzte Mahnung für die nachstehende Rechnung. Sollte der offene Betrag nicht innerhalb von 3 Tagen beglichen werden, werden wir ohne weitere Vorankündigung rechtliche Schritte einleiten.',
        additionalCosts: 'Dies kann zusätzliche Kosten zur Folge haben, die wir Ihnen in Rechnung stellen werden.',
        proofRequired: 'Sollten Sie die Zahlung bereits veranlasst haben, kontaktieren Sie uns bitte umgehend mit einem Zahlungsnachweis.',
        // Quote
        newQuote: 'Neue Offerte',
        quoteThankYou: 'Vielen Dank für Ihre Anfrage! Wir freuen uns, Ihnen folgende Offerte zu unterbreiten:',
        quoteNumber: 'Offerten-Nr.',
        totalAmount: 'Gesamtbetrag',
        date: 'Datum',
        validUntil: 'Gültig bis',
        quotePdfAttached: 'Offerte als PDF angehängt',
        quotePdfDescription: 'Die detaillierte Offerte finden Sie im angehängten PDF. Bitte prüfen Sie alle Positionen und Bedingungen sorgfältig.',
        acceptQuote: 'Offerte akzeptieren'
      },
      en: {
        // Invoice
        newInvoice: 'New Invoice',
        thankYou: 'Thank you for your business! We have created the following invoice for you:',
        invoiceNumber: 'Invoice Number',
        amount: 'Amount',
        invoiceDate: 'Invoice Date',
        dueDate: 'Due Date',
        pdfAttached: 'Invoice PDF Attached',
        pdfDescription: 'The complete invoice with all details and payment information (QR code) can be found in the attached PDF.',
        paymentRequest: 'Please remit payment by the due date. If you have any questions about this invoice, please don\'t hesitate to contact us.',
        greetings: 'Best regards',
        // Reminder 1
        reminder1Title: '1st Payment Reminder',
        reminder1Subtitle: 'Friendly Reminder',
        reminder1Message: 'Our system shows that the following invoice has not yet been paid. We kindly ask you to settle the outstanding amount within the next 10 days.',
        openAmount: 'Outstanding Amount',
        dueSince: 'Due Since',
        overdue: 'Overdue',
        days: 'days',
        reminderPdfAttached: 'Reminder PDF Attached',
        reminderPdfDescription: 'The complete payment reminder with all details and a new QR code can be found in the attached PDF.',
        alreadyPaid: 'If you have already made this payment, please disregard this notice.',
        // Reminder 2
        reminder2Title: '2nd Payment Reminder',
        reminder2Subtitle: 'Urgent Payment Request',
        reminder2Message: 'Despite our first reminder, the following invoice is still outstanding. We urgently request you to settle the amount including reminder fees within 5 days.',
        warningNotice: 'Important Notice',
        warningMessage: 'If payment continues to be delayed, we will unfortunately be forced to take further action.',
        // Reminder 3
        reminder3Title: 'Final Notice',
        reminder3Subtitle: 'Last Payment Request',
        urgent: 'URGENT',
        reminder3Message: 'This is our final reminder for the following invoice. If the outstanding amount is not paid within 3 days, we will initiate legal proceedings without further notice.',
        additionalCosts: 'This may result in additional costs that we will charge to you.',
        proofRequired: 'If you have already made this payment, please contact us immediately with proof of payment.',
        // Quote
        newQuote: 'New Quote',
        quoteThankYou: 'Thank you for your inquiry! We are pleased to present you with the following quote:',
        quoteNumber: 'Quote Number',
        totalAmount: 'Total Amount',
        date: 'Date',
        validUntil: 'Valid Until',
        quotePdfAttached: 'Quote PDF Attached',
        quotePdfDescription: 'The detailed quote can be found in the attached PDF. Please review all items and terms carefully.',
        acceptQuote: 'Accept Quote'
      },
      it: {
        // Invoice
        newInvoice: 'Nuova Fattura',
        thankYou: 'Grazie per la Sua fiducia! Abbiamo creato la seguente fattura per Lei:',
        invoiceNumber: 'Numero Fattura',
        amount: 'Importo',
        invoiceDate: 'Data Fattura',
        dueDate: 'Scadenza',
        pdfAttached: 'Fattura PDF Allegata',
        pdfDescription: 'La fattura completa con tutti i dettagli e le informazioni di pagamento (codice QR) si trova nel PDF allegato.',
        paymentRequest: 'La preghiamo di effettuare il pagamento entro la data di scadenza. Per qualsiasi domanda sulla fattura, non esiti a contattarci.',
        greetings: 'Cordiali saluti',
        // Reminder 1
        reminder1Title: '1° Sollecito di Pagamento',
        reminder1Subtitle: 'Promemoria Amichevole',
        reminder1Message: 'Il nostro sistema mostra che la seguente fattura non è ancora stata pagata. La preghiamo cortesemente di saldare l\'importo dovuto entro i prossimi 10 giorni.',
        openAmount: 'Importo Dovuto',
        dueSince: 'Scaduto dal',
        overdue: 'In Ritardo',
        days: 'giorni',
        reminderPdfAttached: 'Sollecito PDF Allegato',
        reminderPdfDescription: 'Il sollecito di pagamento completo con tutti i dettagli e un nuovo codice QR si trova nel PDF allegato.',
        alreadyPaid: 'Se ha già effettuato questo pagamento, La preghiamo di considerare questa lettera come non pervenuta.',
        // Reminder 2
        reminder2Title: '2° Sollecito di Pagamento',
        reminder2Subtitle: 'Richiesta Urgente di Pagamento',
        reminder2Message: 'Nonostante il nostro primo sollecito, la seguente fattura è ancora in sospeso. La preghiamo urgentemente di saldare l\'importo incluse le spese di sollecito entro 5 giorni.',
        warningNotice: 'Avviso Importante',
        warningMessage: 'In caso di ulteriore ritardo nel pagamento, saremo purtroppo costretti ad intraprendere ulteriori azioni.',
        // Reminder 3
        reminder3Title: 'Ultimo Avviso',
        reminder3Subtitle: 'Ultima Richiesta di Pagamento',
        urgent: 'URGENTE',
        reminder3Message: 'Questo è il nostro ultimo sollecito per la seguente fattura. Se l\'importo dovuto non viene pagato entro 3 giorni, inizieremo azioni legali senza ulteriore preavviso.',
        additionalCosts: 'Ciò può comportare costi aggiuntivi che Le addebiteremo.',
        proofRequired: 'Se ha già effettuato questo pagamento, La preghiamo di contattarci immediatamente con prova di pagamento.',
        // Quote
        newQuote: 'Nuovo Preventivo',
        quoteThankYou: 'Grazie per la Sua richiesta! Siamo lieti di presentarLe il seguente preventivo:',
        quoteNumber: 'Numero Preventivo',
        totalAmount: 'Importo Totale',
        date: 'Data',
        validUntil: 'Valido fino a',
        quotePdfAttached: 'Preventivo PDF Allegato',
        quotePdfDescription: 'Il preventivo dettagliato si trova nel PDF allegato. La preghiamo di esaminare attentamente tutte le voci e le condizioni.',
        acceptQuote: 'Accetta Preventivo'
      },
      fr: {
        // Invoice
        newInvoice: 'Nouvelle Facture',
        thankYou: 'Merci pour votre confiance! Nous avons créé la facture suivante pour vous:',
        invoiceNumber: 'Numéro de Facture',
        amount: 'Montant',
        invoiceDate: 'Date de Facture',
        dueDate: 'Date d\'Échéance',
        pdfAttached: 'Facture PDF Jointe',
        pdfDescription: 'La facture complète avec tous les détails et les informations de paiement (code QR) se trouve dans le PDF joint.',
        paymentRequest: 'Veuillez effectuer le paiement avant la date d\'échéance. Si vous avez des questions concernant cette facture, n\'hésitez pas à nous contacter.',
        greetings: 'Meilleures salutations',
        // Reminder 1
        reminder1Title: '1er Rappel de Paiement',
        reminder1Subtitle: 'Rappel Amical',
        reminder1Message: 'Notre système indique que la facture suivante n\'a pas encore été payée. Nous vous prions de bien vouloir régler le montant dû dans les 10 prochains jours.',
        openAmount: 'Montant Dû',
        dueSince: 'En Retard Depuis',
        overdue: 'En Retard',
        days: 'jours',
        reminderPdfAttached: 'Rappel PDF Joint',
        reminderPdfDescription: 'Le rappel de paiement complet avec tous les détails et un nouveau code QR se trouve dans le PDF joint.',
        alreadyPaid: 'Si vous avez déjà effectué ce paiement, veuillez considérer cette lettre comme nulle et non avenue.',
        // Reminder 2
        reminder2Title: '2ème Rappel de Paiement',
        reminder2Subtitle: 'Demande Urgente de Paiement',
        reminder2Message: 'Malgré notre premier rappel, la facture suivante est toujours en suspens. Nous vous prions instamment de régler le montant y compris les frais de rappel dans les 5 jours.',
        warningNotice: 'Avis Important',
        warningMessage: 'En cas de retard supplémentaire du paiement, nous serons malheureusement contraints de prendre d\'autres mesures.',
        // Reminder 3
        reminder3Title: 'Dernier Avis',
        reminder3Subtitle: 'Dernière Demande de Paiement',
        urgent: 'URGENT',
        reminder3Message: 'Ceci est notre dernier rappel pour la facture suivante. Si le montant dû n\'est pas payé dans les 3 jours, nous engagerons des poursuites judiciaires sans autre préavis.',
        additionalCosts: 'Cela peut entraîner des frais supplémentaires que nous vous facturerons.',
        proofRequired: 'Si vous avez déjà effectué ce paiement, veuillez nous contacter immédiatement avec une preuve de paiement.',
        // Quote
        newQuote: 'Nouveau Devis',
        quoteThankYou: 'Merci pour votre demande! Nous sommes heureux de vous présenter le devis suivant:',
        quoteNumber: 'Numéro de Devis',
        totalAmount: 'Montant Total',
        date: 'Date',
        validUntil: 'Valable jusqu\'au',
        quotePdfAttached: 'Devis PDF Joint',
        quotePdfDescription: 'Le devis détaillé se trouve dans le PDF joint. Veuillez examiner attentivement tous les éléments et conditions.',
        acceptQuote: 'Accepter le Devis'
      }
    }

    return translations[lang]
  }

  // Template HTML methods
  private getReminder1HTML(lang: SupportedLanguage): string {
    const t = this.getTranslations(lang)
    return `
      <!DOCTYPE html>
      <html>
      <head>
  <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px;">${t.reminder1Title}</h1>
      <p style="color: #fff8f0; margin: 10px 0 0 0; font-size: 14px;">${t.reminder1Subtitle}</p>
        </div>
        
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="font-size: 16px; margin-bottom: 20px;">${lang === 'it' ? 'Gentile' : lang === 'fr' ? 'Madame, Monsieur' : lang === 'en' ? 'Dear' : 'Sehr geehrte/r'} {{CUSTOMER_NAME}},</p>
          
      <p style="font-size: 16px; color: #555; margin-bottom: 30px;">
        ${t.reminder1Message}
      </p>
      
      <!-- Invoice Summary -->
      <div style="background: #fff8f0; border-left: 4px solid #ff6b35; padding: 20px; margin: 30px 0; border-radius: 6px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.invoiceNumber}</strong></p>
            <p style="margin: 8px 0; font-size: 18px; font-weight: bold; color: #ff6b35;">{{INVOICE_NUMBER}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.openAmount}</strong></p>
            <p style="margin: 8px 0; font-size: 18px; font-weight: bold; color: #dc2626;">{{INVOICE_AMOUNT}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.dueSince}</strong></p>
            <p style="margin: 8px 0; color: #dc2626;">{{DUE_DATE}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.overdue}</strong></p>
            <p style="margin: 8px 0; color: #dc2626; font-weight: 600;">{{OVERDUE_DAYS}} ${t.days}</p>
          </div>
        </div>
          </div>
          
      <!-- PDF Attachment Info -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">
          📎 ${t.reminderPdfAttached}
        </p>
        <p style="margin: 0; font-size: 14px; color: #1e3a8a;">
          ${t.reminderPdfDescription}
        </p>
      </div>
      
      <p style="font-size: 16px; margin-top: 30px; color: #555;">
        ${t.alreadyPaid}
      </p>
          
      <p style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
        ${t.greetings},<br>
        <strong style="color: #ff6b35; font-size: 16px;">{{COMPANY_NAME}}</strong><br>
        {{COMPANY_EMAIL}}
      </p>
        </div>
        
    <!-- Footer -->
    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        {{COMPANY_NAME}}
      </p>
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        E-Mail: {{COMPANY_EMAIL}}
        {{#COMPANY_PHONE}} | Tel: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
      </p>
      {{#COMPANY_WEBSITE}}
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        Web: {{COMPANY_WEBSITE}}
      </p>
      {{/COMPANY_WEBSITE}}
      {{#COMPANY_VAT}}
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        {{COMPANY_VAT}}
      </p>
      {{/COMPANY_VAT}}
    </div>
        </div>
      </body>
      </html>
    `.trim()
  }

  private getReminder2HTML(lang: SupportedLanguage): string {
    const t = this.getTranslations(lang)
    return `
      <!DOCTYPE html>
      <html>
      <head>
  <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px;">${t.reminder2Title}</h1>
      <p style="color: #fff8f0; margin: 10px 0 0 0; font-size: 14px;">${t.reminder2Subtitle}</p>
        </div>
        
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="font-size: 16px; margin-bottom: 20px;">${lang === 'it' ? 'Gentile' : lang === 'fr' ? 'Madame, Monsieur' : lang === 'en' ? 'Dear' : 'Sehr geehrte/r'} {{CUSTOMER_NAME}},</p>
          
      <p style="font-size: 16px; color: #555; margin-bottom: 30px;">
        ${t.reminder2Message}
      </p>
      
      <!-- Invoice Summary -->
      <div style="background: #fff3cd; border-left: 4px solid #d97706; padding: 20px; margin: 30px 0; border-radius: 6px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.invoiceNumber}</strong></p>
            <p style="margin: 8px 0; font-size: 18px; font-weight: bold; color: #d97706;">{{INVOICE_NUMBER}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.openAmount}</strong></p>
            <p style="margin: 8px 0; font-size: 18px; font-weight: bold; color: #dc2626;">{{INVOICE_AMOUNT}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.dueSince}</strong></p>
            <p style="margin: 8px 0; color: #dc2626;">{{DUE_DATE}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.overdue}</strong></p>
            <p style="margin: 8px 0; color: #dc2626; font-weight: 600;">{{OVERDUE_DAYS}} ${t.days}</p>
          </div>
        </div>
          </div>
          
      <!-- Warning Notice -->
      <div style="background: #fef3c7; border: 2px solid #d97706; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #92400e; font-size: 16px;">
          ⚠️ ${t.warningNotice}
        </p>
        <p style="margin: 0; font-size: 14px; color: #92400e;">
          ${t.warningMessage}
        </p>
      </div>
      
      <!-- PDF Attachment Info -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">
          📎 ${t.reminderPdfAttached}
        </p>
        <p style="margin: 0; font-size: 14px; color: #1e3a8a;">
          ${t.reminderPdfDescription}
        </p>
      </div>
      
      <p style="font-size: 16px; margin-top: 30px; color: #555;">
        ${t.alreadyPaid}
      </p>
          
      <p style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
        ${t.greetings},<br>
        <strong style="color: #d97706; font-size: 16px;">{{COMPANY_NAME}}</strong><br>
        {{COMPANY_EMAIL}}
      </p>
        </div>
        
    <!-- Footer -->
    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        {{COMPANY_NAME}}
      </p>
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        E-Mail: {{COMPANY_EMAIL}}
        {{#COMPANY_PHONE}} | Tel: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
      </p>
      {{#COMPANY_WEBSITE}}
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        Web: {{COMPANY_WEBSITE}}
      </p>
      {{/COMPANY_WEBSITE}}
      {{#COMPANY_VAT}}
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        {{COMPANY_VAT}}
      </p>
      {{/COMPANY_VAT}}
    </div>
        </div>
      </body>
      </html>
    `.trim()
  }

  private getReminder3HTML(lang: SupportedLanguage): string {
    const t = this.getTranslations(lang)
    return `
      <!DOCTYPE html>
      <html>
      <head>
  <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px;">${t.reminder3Title}</h1>
      <p style="color: #fef2f2; margin: 10px 0 0 0; font-size: 14px;">${t.reminder3Subtitle}</p>
        </div>
        
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="font-size: 16px; margin-bottom: 20px;">${lang === 'it' ? 'Gentile' : lang === 'fr' ? 'Madame, Monsieur' : lang === 'en' ? 'Dear' : 'Sehr geehrte/r'} {{CUSTOMER_NAME}},</p>
          
      <!-- Urgent Notice -->
      <div style="background: #fee2e2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #7f1d1d; font-size: 18px;">
          🚨 ${t.urgent}
        </p>
        <p style="margin: 0; font-size: 14px; color: #7f1d1d;">
          ${t.reminder3Message}
        </p>
          </div>
          
      <!-- Invoice Summary -->
      <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; margin: 30px 0; border-radius: 6px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.invoiceNumber}</strong></p>
            <p style="margin: 8px 0; font-size: 18px; font-weight: bold; color: #dc2626;">{{INVOICE_NUMBER}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.openAmount}</strong></p>
            <p style="margin: 8px 0; font-size: 18px; font-weight: bold; color: #dc2626;">{{INVOICE_AMOUNT}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.dueSince}</strong></p>
            <p style="margin: 8px 0; color: #dc2626;">{{DUE_DATE}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.overdue}</strong></p>
            <p style="margin: 8px 0; color: #dc2626; font-weight: 600;">{{OVERDUE_DAYS}} ${t.days}</p>
          </div>
        </div>
      </div>
      
      <!-- PDF Attachment Info -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">
          📎 ${t.reminderPdfAttached}
        </p>
        <p style="margin: 0; font-size: 14px; color: #1e3a8a;">
          ${t.reminderPdfDescription}
        </p>
          </div>
          
      <p style="font-size: 16px; margin-top: 30px; color: #555;">
        ${t.additionalCosts}
      </p>
      
      <p style="font-size: 16px; margin-top: 20px; color: #555;">
        ${t.proofRequired}
      </p>
          
      <p style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
        ${t.greetings},<br>
        <strong style="color: #dc2626; font-size: 16px;">{{COMPANY_NAME}}</strong><br>
        {{COMPANY_EMAIL}}
      </p>
        </div>
        
    <!-- Footer -->
    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        {{COMPANY_NAME}}
      </p>
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        E-Mail: {{COMPANY_EMAIL}}
        {{#COMPANY_PHONE}} | Tel: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
      </p>
      {{#COMPANY_WEBSITE}}
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        Web: {{COMPANY_WEBSITE}}
      </p>
      {{/COMPANY_WEBSITE}}
      {{#COMPANY_VAT}}
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        {{COMPANY_VAT}}
      </p>
      {{/COMPANY_VAT}}
    </div>
        </div>
      </body>
      </html>
    `.trim()
  }

  private getInvoiceNotificationHTML(lang: SupportedLanguage): string {
    const t = this.getTranslations(lang)
    return `
      <!DOCTYPE html>
      <html>
      <head>
  <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">${t.newInvoice}</h1>
      <p style="color: #fff8f0; margin: 10px 0 0 0; font-size: 14px;">{{INVOICE_NUMBER}}</p>
        </div>
        
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="font-size: 16px; margin-bottom: 20px;">${lang === 'it' ? 'Gentile' : lang === 'fr' ? 'Madame, Monsieur' : lang === 'en' ? 'Dear' : 'Sehr geehrte/r'} {{CUSTOMER_NAME}},</p>
          
      <p style="font-size: 16px; color: #555; margin-bottom: 30px;">
        ${t.thankYou}
      </p>
      
      <!-- Invoice Summary -->
      <div style="background: #f8f9fa; border-left: 4px solid #ff6b35; padding: 20px; margin: 30px 0; border-radius: 6px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.invoiceNumber}</strong></p>
            <p style="margin: 8px 0; font-size: 18px; font-weight: bold; color: #ff6b35;">{{INVOICE_NUMBER}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.amount}</strong></p>
            <p style="margin: 8px 0; font-size: 18px; font-weight: bold; color: #22c55e;">{{INVOICE_AMOUNT}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.invoiceDate}</strong></p>
            <p style="margin: 8px 0;">{{INVOICE_DATE}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.dueDate}</strong></p>
            <p style="margin: 8px 0; color: #dc2626; font-weight: 600;">{{DUE_DATE}}</p>
          </div>
        </div>
          </div>
          
      <!-- PDF Attachment Info -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">
          📎 ${t.pdfAttached}
        </p>
        <p style="margin: 0; font-size: 14px; color: #1e3a8a;">
          ${t.pdfDescription}
        </p>
      </div>
      
      <p style="font-size: 16px; margin-top: 30px; color: #555;">
        ${t.paymentRequest}
      </p>
          
      <p style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
        ${t.greetings},<br>
        <strong style="color: #ff6b35; font-size: 16px;">{{COMPANY_NAME}}</strong><br>
        {{COMPANY_EMAIL}}
      </p>
        </div>
        
    <!-- Footer -->
    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        {{COMPANY_NAME}}
      </p>
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        E-Mail: {{COMPANY_EMAIL}}
        {{#COMPANY_PHONE}} | Tel: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
      </p>
      {{#COMPANY_WEBSITE}}
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        Web: {{COMPANY_WEBSITE}}
      </p>
      {{/COMPANY_WEBSITE}}
      {{#COMPANY_VAT}}
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        {{COMPANY_VAT}}
      </p>
      {{/COMPANY_VAT}}
    </div>
        </div>
      </body>
      </html>
    `.trim()
  }

  // Text versions for email clients that don't support HTML
  private getReminder1Text(lang: SupportedLanguage): string {
    const t = this.getTranslations(lang)
    return `
1. Zahlungserinnerung - Rechnung {{INVOICE_NUMBER}}

Sehr geehrte/r {{CUSTOMER_NAME}},

Unser System zeigt, dass die nachstehende Rechnung noch nicht beglichen wurde. Wir bitten Sie höflich, den offenen Betrag innerhalb der nächsten 10 Tage zu begleichen.

Rechnungsnummer: {{INVOICE_NUMBER}}
Offener Betrag: {{INVOICE_AMOUNT}}
Fällig seit: {{DUE_DATE}}
Überfällig: {{OVERDUE_DAYS}} Tage

Die vollständige Zahlungserinnerung mit allen Details und einem neuen QR-Code finden Sie im angehängten PDF.

Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben als gegenstandslos.

Freundliche Grüsse,
{{COMPANY_NAME}}

---
Kontakt:
E-Mail: {{COMPANY_EMAIL}}
{{#COMPANY_PHONE}}Tel: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
{{#COMPANY_WEBSITE}}Web: {{COMPANY_WEBSITE}}{{/COMPANY_WEBSITE}}
{{#COMPANY_VAT}}{{COMPANY_VAT}}{{/COMPANY_VAT}}
    `.trim()
  }

  private getReminder2Text(lang: SupportedLanguage): string {
    const t = this.getTranslations(lang)
    return `
2. Mahnung - Rechnung {{INVOICE_NUMBER}}

Sehr geehrte/r {{CUSTOMER_NAME}},

Trotz unserer ersten Mahnung ist die nachstehende Rechnung noch immer offen. Wir bitten Sie dringend, den Betrag inklusive Mahngebühren innerhalb von 5 Tagen zu begleichen.

Rechnungsnummer: {{INVOICE_NUMBER}}
Offener Betrag: {{INVOICE_AMOUNT}}
Fällig seit: {{DUE_DATE}}
Überfällig: {{OVERDUE_DAYS}} Tage

⚠️ WICHTIGER HINWEIS:
Bei weiterem Zahlungsverzug sehen wir uns leider veranlasst, weitere Massnahmen zu ergreifen.

Die vollständige Mahnung mit allen Details, Mahngebühren und einem aktualisierten QR-Code finden Sie im angehängten PDF.

Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben als gegenstandslos.

Freundliche Grüsse,
{{COMPANY_NAME}}

---
Kontakt:
E-Mail: {{COMPANY_EMAIL}}
{{#COMPANY_PHONE}}Tel: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
{{#COMPANY_WEBSITE}}Web: {{COMPANY_WEBSITE}}{{/COMPANY_WEBSITE}}
{{#COMPANY_VAT}}{{COMPANY_VAT}}{{/COMPANY_VAT}}
    `.trim()
  }

  private getReminder3Text(lang: SupportedLanguage): string {
    const t = this.getTranslations(lang)
    return `
3. und letzte Mahnung - Rechnung {{INVOICE_NUMBER}}

Sehr geehrte/r {{CUSTOMER_NAME}},

🚨 DRINGEND:
Dies ist unsere letzte Mahnung für die nachstehende Rechnung. Sollte der offene Betrag nicht innerhalb von 3 Tagen beglichen werden, werden wir ohne weitere Vorankündigung rechtliche Schritte einleiten.

Rechnungsnummer: {{INVOICE_NUMBER}}
Offener Betrag: {{INVOICE_AMOUNT}}
Fällig seit: {{DUE_DATE}}
Überfällig: {{OVERDUE_DAYS}} Tage

Die vollständige Mahnung mit allen Details, Mahngebühren und einem aktualisierten QR-Code finden Sie im angehängten PDF.

Dies kann zusätzliche Kosten zur Folge haben, die wir Ihnen in Rechnung stellen werden.

Sollten Sie die Zahlung bereits veranlasst haben, kontaktieren Sie uns bitte umgehend mit einem Zahlungsnachweis.

Mit freundlichen Grüssen,
{{COMPANY_NAME}}

---
Kontakt:
E-Mail: {{COMPANY_EMAIL}}
{{#COMPANY_PHONE}}Tel: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
{{#COMPANY_WEBSITE}}Web: {{COMPANY_WEBSITE}}{{/COMPANY_WEBSITE}}
{{#COMPANY_VAT}}{{COMPANY_VAT}}{{/COMPANY_VAT}}
    `.trim()
  }

  private getInvoiceNotificationText(lang: SupportedLanguage): string {
    const t = this.getTranslations(lang)
    return `
Neue Rechnung - {{INVOICE_NUMBER}}

Sehr geehrte/r {{CUSTOMER_NAME}},

Vielen Dank für Ihr Vertrauen! Wir haben folgende Rechnung für Sie erstellt:

Rechnungsnummer: {{INVOICE_NUMBER}}
Betrag: {{INVOICE_AMOUNT}}
Rechnungsdatum: {{INVOICE_DATE}}
Zahlbar bis: {{DUE_DATE}}

Die vollständige Rechnung mit allen Details und Zahlungsinformationen (QR-Code) finden Sie im angehängten PDF.

Bitte begleichen Sie den Betrag bis zum Fälligkeitsdatum. Bei Fragen zur Rechnung stehen wir Ihnen jederzeit gerne zur Verfügung.

Freundliche Grüsse,
{{COMPANY_NAME}}

---
Kontakt:
E-Mail: {{COMPANY_EMAIL}}
{{#COMPANY_PHONE}}Tel: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
{{#COMPANY_WEBSITE}}Web: {{COMPANY_WEBSITE}}{{/COMPANY_WEBSITE}}
{{#COMPANY_VAT}}{{COMPANY_VAT}}{{/COMPANY_VAT}}
    `.trim()
  }

  // ==================== QUOTE EMAIL ====================

  async sendQuoteNotification(data: QuoteEmailData, pdfPath?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const lang = this.getCustomerLanguage(data.customer)
      const template = this.getQuoteNotificationTemplate(lang)
      const emailData = this.prepareQuoteEmailData(data, template)
      
      // Try to attach the generated quote PDF if available
      let attachments: Array<{ filename: string; content: string; contentType?: string }> | undefined
      if (pdfPath) {
        try {
          console.log('📎 Fetching quote PDF from storage:', pdfPath)
          const { data: dl, error } = await supabaseAdmin.storage.from('quotes').download(pdfPath)
          if (!error && dl) {
            const arrayBuf = await dl.arrayBuffer()
            const base64 = Buffer.from(arrayBuf).toString('base64')
            attachments = [{ filename: `Offerte-${data.quote.number}.pdf`, content: base64, contentType: 'application/pdf' }]
            console.log('✅ Quote PDF attached')
          } else {
            console.error('❌ Error downloading quote PDF:', error)
          }
        } catch (attachErr) {
          console.warn('⚠️ Quote PDF attachment unavailable:', attachErr)
        }
      }

      const result = await this.resend.emails.send({
        from: `${config.email.fromName} <${config.email.fromEmail}>`,
        to: [data.customer.email!],
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        replyTo: data.company.email,
        attachments
      })

      return {
        success: true,
        messageId: result.data?.id
      }
    } catch (error) {
      console.error('Error sending quote notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private prepareQuoteEmailData(data: QuoteEmailData, template: EmailTemplate): EmailTemplate {
    const formatSwissMwst = (vatNumber?: string | null): string | null => {
      if (!vatNumber) return null
      const digits = (vatNumber.match(/\d/g) || []).join('')
      if (digits.length < 9) return null
      const d = digits.slice(0, 9)
      return `CHE-${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)} MWST`
    }

    const formatDate = (date: string | Date) => {
      return new Date(date).toLocaleDateString('de-CH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    const formatCurrency = (amount: number) => {
      return `CHF ${(amount / 100).toFixed(2)}`
    }

    const replacements: Record<string, string> = {
      '{{CUSTOMER_NAME}}': data.customer.name || 'Customer',
      '{{QUOTE_NUMBER}}': data.quote.number,
      '{{QUOTE_AMOUNT}}': formatCurrency(data.quote.total),
      '{{QUOTE_DATE}}': formatDate(data.quote.date),
      '{{EXPIRY_DATE}}': formatDate(data.quote.expiryDate),
      '{{COMPANY_NAME}}': data.company.name || '',
      '{{COMPANY_EMAIL}}': data.company.email || '',
      '{{COMPANY_LOGO}}': data.company.logo_url || '',
      '{{ACCEPTANCE_LINK}}': data.quote.acceptanceLink || '#'
    }

    // Optional replacements
    const formattedMwst = formatSwissMwst(data.company.vat_number)
    if (formattedMwst) {
      replacements['{{COMPANY_VAT}}'] = formattedMwst
    }
    if (data.company.phone) {
      replacements['{{COMPANY_PHONE}}'] = data.company.phone
    }
    if (data.company.website) {
      replacements['{{COMPANY_WEBSITE}}'] = data.company.website
    }

    let html = template.html
    let text = template.text
    let subject = template.subject

    // Handle conditional sections
    if (formattedMwst) {
      html = html.replace(/{{#COMPANY_VAT}}(.*?){{\/COMPANY_VAT}}/gs, '$1')
      text = text.replace(/{{#COMPANY_VAT}}(.*?){{\/COMPANY_VAT}}/gs, '$1')
    } else {
      html = html.replace(/{{#COMPANY_VAT}}.*?{{\/COMPANY_VAT}}/gs, '')
      text = text.replace(/{{#COMPANY_VAT}}.*?{{\/COMPANY_VAT}}/gs, '')
    }

    if (data.company.phone) {
      html = html.replace(/{{#COMPANY_PHONE}}(.*?){{\/COMPANY_PHONE}}/gs, '$1')
      text = text.replace(/{{#COMPANY_PHONE}}(.*?){{\/COMPANY_PHONE}}/gs, '$1')
    } else {
      html = html.replace(/{{#COMPANY_PHONE}}.*?{{\/COMPANY_PHONE}}/gs, '')
      text = text.replace(/{{#COMPANY_PHONE}}.*?{{\/COMPANY_PHONE}}/gs, '')
    }

    if (data.company.website) {
      html = html.replace(/{{#COMPANY_WEBSITE}}(.*?){{\/COMPANY_WEBSITE}}/gs, '$1')
      text = text.replace(/{{#COMPANY_WEBSITE}}(.*?){{\/COMPANY_WEBSITE}}/gs, '$1')
    } else {
      html = html.replace(/{{#COMPANY_WEBSITE}}.*?{{\/COMPANY_WEBSITE}}/gs, '')
      text = text.replace(/{{#COMPANY_WEBSITE}}.*?{{\/COMPANY_WEBSITE}}/gs, '')
    }

    if (data.quote.acceptanceLink) {
      html = html.replace(/{{#ACCEPTANCE_LINK}}(.*?){{\/ACCEPTANCE_LINK}}/gs, '$1')
      text = text.replace(/{{#ACCEPTANCE_LINK}}(.*?){{\/ACCEPTANCE_LINK}}/gs, '$1')
    } else {
      html = html.replace(/{{#ACCEPTANCE_LINK}}.*?{{\/ACCEPTANCE_LINK}}/gs, '')
      text = text.replace(/{{#ACCEPTANCE_LINK}}.*?{{\/ACCEPTANCE_LINK}}/gs, '')
    }

    // Replace all placeholders
    Object.entries(replacements).forEach(([key, value]) => {
      html = html.replace(new RegExp(key, 'g'), value)
      text = text.replace(new RegExp(key, 'g'), value)
      subject = subject.replace(new RegExp(key, 'g'), value)
    })

    return { subject, html, text }
  }

  private getQuoteNotificationHTML(lang: SupportedLanguage): string {
    const t = this.getTranslations(lang)
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">${t.newQuote}</h1>
      <p style="color: #fff8f0; margin: 10px 0 0 0; font-size: 14px;">{{QUOTE_NUMBER}}</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="font-size: 16px; margin-bottom: 20px;">${lang === 'it' ? 'Gentile' : lang === 'fr' ? 'Madame, Monsieur' : lang === 'en' ? 'Dear' : 'Sehr geehrte/r'} {{CUSTOMER_NAME}},</p>
      
      <p style="font-size: 16px; color: #555; margin-bottom: 30px;">
        ${t.quoteThankYou}
      </p>
      
      <!-- Quote Summary -->
      <div style="background: #f8f9fa; border-left: 4px solid #ff6b35; padding: 20px; margin: 30px 0; border-radius: 6px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.quoteNumber}</strong></p>
            <p style="margin: 8px 0; font-size: 18px; font-weight: bold; color: #ff6b35;">{{QUOTE_NUMBER}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.totalAmount}</strong></p>
            <p style="margin: 8px 0; font-size: 18px; font-weight: bold; color: #22c55e;">{{QUOTE_AMOUNT}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.date}</strong></p>
            <p style="margin: 8px 0;">{{QUOTE_DATE}}</p>
          </div>
          <div>
            <p style="margin: 8px 0; color: #666;"><strong style="color: #333;">${t.validUntil}</strong></p>
            <p style="margin: 8px 0; color: #dc2626;">{{EXPIRY_DATE}}</p>
          </div>
        </div>
      </div>
      
      <!-- PDF Attachment Info -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">
          📎 ${t.quotePdfAttached}
        </p>
        <p style="margin: 0; font-size: 14px; color: #1e3a8a;">
          ${t.quotePdfDescription}
        </p>
      </div>
      
      {{#ACCEPTANCE_LINK}}
      <!-- Accept Quote Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{ACCEPTANCE_LINK}}" style="display: inline-block; background: #ff6b35; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
          ${t.acceptQuote}
        </a>
        <p style="margin: 15px 0 0 0; font-size: 12px; color: #666;">
          ${lang === 'en' ? 'Or copy this link into your browser:' : lang === 'it' ? 'O copi questo link nel suo browser:' : lang === 'fr' ? 'Ou copiez ce lien dans votre navigateur:' : 'Oder kopieren Sie diesen Link in Ihren Browser:'}<br>
          <span style="color: #ff6b35; word-break: break-all;">{{ACCEPTANCE_LINK}}</span>
        </p>
      </div>
      {{/ACCEPTANCE_LINK}}
      
      <p style="font-size: 16px; margin-top: 30px;">
        ${lang === 'en' ? 'If you have any questions, please don\'t hesitate to contact us.' : lang === 'it' ? 'Per qualsiasi domanda, non esiti a contattarci.' : lang === 'fr' ? 'N\'hésitez pas à nous contacter si vous avez des questions.' : 'Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.'}
      </p>
      
      <p style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
        ${t.greetings},<br>
        <strong style="color: #ff6b35; font-size: 16px;">{{COMPANY_NAME}}</strong><br>
        {{COMPANY_EMAIL}}
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        {{COMPANY_NAME}}
      </p>
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        E-Mail: {{COMPANY_EMAIL}}
        {{#COMPANY_PHONE}} | Tel: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
      </p>
      {{#COMPANY_WEBSITE}}
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        Web: {{COMPANY_WEBSITE}}
      </p>
      {{/COMPANY_WEBSITE}}
      {{#COMPANY_VAT}}
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
        {{COMPANY_VAT}}
      </p>
      {{/COMPANY_VAT}}
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  private getQuoteNotificationText(lang: SupportedLanguage): string {
    const t = this.getTranslations(lang)
    return `
Neue Offerte - {{QUOTE_NUMBER}}

Sehr geehrte/r {{CUSTOMER_NAME}},

Vielen Dank für Ihre Anfrage! Wir freuen uns, Ihnen folgende Offerte zu unterbreiten:

Offerten-Nr.: {{QUOTE_NUMBER}}
Gesamtbetrag: {{QUOTE_AMOUNT}}
Datum: {{QUOTE_DATE}}
Gültig bis: {{EXPIRY_DATE}}

Die detaillierte Offerte finden Sie im angehängten PDF. Bitte prüfen Sie alle Positionen und Bedingungen sorgfältig.

{{#ACCEPTANCE_LINK}}
Um diese Offerte zu akzeptieren, besuchen Sie bitte folgenden Link:
{{ACCEPTANCE_LINK}}
{{/ACCEPTANCE_LINK}}

Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.

Freundliche Grüsse,
{{COMPANY_NAME}}

---
Kontakt:
E-Mail: {{COMPANY_EMAIL}}
{{#COMPANY_PHONE}}Tel: {{COMPANY_PHONE}}{{/COMPANY_PHONE}}
{{#COMPANY_WEBSITE}}Web: {{COMPANY_WEBSITE}}{{/COMPANY_WEBSITE}}
{{#COMPANY_VAT}}{{COMPANY_VAT}}{{/COMPANY_VAT}}
    `.trim()
  }
}

export default EmailService






