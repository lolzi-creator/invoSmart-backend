export type Language = 'de' | 'fr' | 'en' | 'it'

export interface EmailTranslations {
  quote: {
    subject: (number: string, customerName: string) => string
    greeting: (name: string) => string
    intro: string
    quoteNumber: string
    quoteDate: string
    validUntil: string
    totalAmount: string
    reviewAttached: string
    validUntilDate: string
    acceptButton: string
    questions: string
    bestRegards: string
    footer: string
  }
  invoice: {
    subject: (number: string, customerName: string) => string
    greeting: (name: string) => string
    intro: string
    invoiceNumber: string
    invoiceDate: string
    dueDate: string
    totalAmount: string
    paymentInfo: string
    qrReference: string
    nextSteps: string[]
    reviewPDF: string
    makePayment: string
    useQRCode: string
    questions: string
    bestRegards: string
  }
  reminder: {
    subject: (level: number, number: string) => string
    greeting: (name: string) => string
    intro: (level: number) => string
    invoiceNumber: string
    dueDate: string
    outstandingAmount: string
    paymentStatus: string
    paidAmount: string
    totalAmount: string
    remainingAmount: string
    paymentInfo: string
    qrReference: string
    urgency: string
    contact: string
    bestRegards: string
  }
}

export const emailTranslations: Record<Language, EmailTranslations> = {
  de: {
    quote: {
      subject: (number: string, customerName: string) => `Angebot ${number} - ${customerName}`,
      greeting: (name: string) => `Sehr geehrte/r ${name},`,
      intro: 'Vielen Dank für Ihr Interesse an unseren Dienstleistungen. Wir freuen uns, Ihnen das folgende Angebot zu unterbreiten.',
      quoteNumber: 'Angebotsnummer',
      quoteDate: 'Angebotsdatum',
      validUntil: 'Gültig bis',
      totalAmount: 'Gesamtbetrag',
      reviewAttached: 'Bitte überprüfen Sie das angehängte AngebotspDF für vollständige Details. Das Angebot bleibt gültig bis',
      validUntilDate: '',
      acceptButton: 'Angebot annehmen',
      questions: 'Falls Sie Fragen haben oder Klärungsbedarf besteht, zögern Sie bitte nicht, uns zu kontaktieren.',
      bestRegards: 'Mit freundlichen Grüssen',
      footer: ''
    },
    invoice: {
      subject: (number: string, customerName: string) => `Rechnung ${number} - ${customerName}`,
      greeting: (name: string) => `Sehr geehrte/r ${name},`,
      intro: 'anbei erhalten Sie Ihre Rechnung.',
      invoiceNumber: 'Rechnungsnummer',
      invoiceDate: 'Rechnungsdatum',
      dueDate: 'Fälligkeitsdatum',
      totalAmount: 'Gesamtbetrag',
      paymentInfo: 'Zahlungsinformationen',
      qrReference: 'QR-Referenz',
      nextSteps: [
        'Überprüfen Sie das angehängte Rechnungs-PDF',
        'Bezahlen Sie bis zum Fälligkeitsdatum',
        'Verwenden Sie den QR-Code oder die Referenznummer für die Zahlung'
      ],
      reviewPDF: 'Überprüfen Sie das angehängte Rechnungs-PDF',
      makePayment: 'Bezahlen Sie bis zum Fälligkeitsdatum',
      useQRCode: 'Verwenden Sie den QR-Code oder die Referenznummer für die Zahlung',
      questions: 'Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
      bestRegards: 'Mit freundlichen Grüssen'
    },
    reminder: {
      subject: (level: number, number: string) => `Mahnung ${level} - Rechnung ${number}`,
      greeting: (name: string) => `Sehr geehrte/r ${name},`,
      intro: (level: number) => {
        if (level === 1) return 'Wir möchten Sie freundlich daran erinnern, dass die folgende Rechnung noch aussteht.'
        if (level === 2) return 'Wir möchten Sie erneut daran erinnern, dass die folgende Rechnung weiterhin aussteht.'
        return 'Wir müssen Sie eindringlich daran erinnern, dass die folgende Rechnung dringend beglichen werden muss.'
      },
      invoiceNumber: 'Rechnungsnummer',
      dueDate: 'Fälligkeitsdatum',
      outstandingAmount: 'Ausstehender Betrag',
      paymentStatus: 'Zahlungsstatus',
      paidAmount: 'Bezahlter Betrag',
      totalAmount: 'Gesamtbetrag',
      remainingAmount: 'Verbleibender Betrag',
      paymentInfo: 'Zahlungsinformationen',
      qrReference: 'QR-Referenz',
      urgency: 'Bitte begleichen Sie den ausstehenden Betrag umgehend.',
      contact: 'Falls Sie Fragen haben oder bereits Zahlung geleistet haben, kontaktieren Sie uns bitte.',
      bestRegards: 'Mit freundlichen Grüssen'
    }
  },
  
  fr: {
    quote: {
      subject: (number: string, customerName: string) => `Devis ${number} - ${customerName}`,
      greeting: (name: string) => `Cher/Chère ${name},`,
      intro: 'Merci de votre intérêt pour nos services. Nous avons le plaisir de vous présenter le devis suivant pour votre considération.',
      quoteNumber: 'Numéro de devis',
      quoteDate: 'Date du devis',
      validUntil: 'Valable jusqu\'au',
      totalAmount: 'Montant total',
      reviewAttached: 'Veuillez consulter le PDF du devis joint pour tous les détails. Le devis restera valable jusqu\'au',
      validUntilDate: '',
      acceptButton: 'Accepter le devis',
      questions: 'Si vous avez des questions ou besoin de clarifications, n\'hésitez pas à nous contacter.',
      bestRegards: 'Meilleures salutations',
      footer: ''
    },
    invoice: {
      subject: (number: string, customerName: string) => `Facture ${number} - ${customerName}`,
      greeting: (name: string) => `Cher/Chère ${name},`,
      intro: 'vous trouverez ci-joint votre facture.',
      invoiceNumber: 'Numéro de facture',
      invoiceDate: 'Date de facture',
      dueDate: 'Date d\'échéance',
      totalAmount: 'Montant total',
      paymentInfo: 'Informations de paiement',
      qrReference: 'Référence QR',
      nextSteps: [
        'Consultez le PDF de la facture joint',
        'Effectuez le paiement avant la date d\'échéance',
        'Utilisez le code QR ou le numéro de référence pour le paiement'
      ],
      reviewPDF: 'Consultez le PDF de la facture joint',
      makePayment: 'Effectuez le paiement avant la date d\'échéance',
      useQRCode: 'Utilisez le code QR ou le numéro de référence pour le paiement',
      questions: 'Si vous avez des questions, n\'hésitez pas à nous contacter.',
      bestRegards: 'Meilleures salutations'
    },
    reminder: {
      subject: (level: number, number: string) => `Rappel ${level} - Facture ${number}`,
      greeting: (name: string) => `Cher/Chère ${name},`,
      intro: (level: number) => {
        if (level === 1) return 'Nous aimerions vous rappeler que la facture suivante est toujours en attente de paiement.'
        if (level === 2) return 'Nous aimerions vous rappeler à nouveau que la facture suivante est toujours en attente de paiement.'
        return 'Nous devons vous rappeler avec insistance que la facture suivante doit être réglée de toute urgence.'
      },
      invoiceNumber: 'Numéro de facture',
      dueDate: 'Date d\'échéance',
      outstandingAmount: 'Montant impayé',
      paymentStatus: 'Statut du paiement',
      paidAmount: 'Montant payé',
      totalAmount: 'Montant total',
      remainingAmount: 'Montant restant',
      paymentInfo: 'Informations de paiement',
      qrReference: 'Référence QR',
      urgency: 'Veuillez régler le montant impayé immédiatement.',
      contact: 'Si vous avez des questions ou si vous avez déjà effectué le paiement, veuillez nous contacter.',
      bestRegards: 'Meilleures salutations'
    }
  },
  
  en: {
    quote: {
      subject: (number: string, customerName: string) => `Quote ${number} - ${customerName}`,
      greeting: (name: string) => `Dear ${name},`,
      intro: 'Thank you for your interest in our services. We are pleased to present you with the following quote for your consideration.',
      quoteNumber: 'Quote Number',
      quoteDate: 'Quote Date',
      validUntil: 'Valid Until',
      totalAmount: 'Total Amount',
      reviewAttached: 'Please review the attached quote PDF for complete details. The quote will remain valid until',
      validUntilDate: '',
      acceptButton: 'Accept Quote',
      questions: 'If you have any questions or need clarification on any aspect of this quote, please don\'t hesitate to contact us.',
      bestRegards: 'Best regards',
      footer: ''
    },
    invoice: {
      subject: (number: string, customerName: string) => `Invoice ${number} - ${customerName}`,
      greeting: (name: string) => `Dear ${name},`,
      intro: 'please find your invoice attached.',
      invoiceNumber: 'Invoice Number',
      invoiceDate: 'Invoice Date',
      dueDate: 'Due Date',
      totalAmount: 'Total Amount',
      paymentInfo: 'Payment Information',
      qrReference: 'QR Reference',
      nextSteps: [
        'Review the attached invoice PDF',
        'Make payment by the due date',
        'Use the QR code or reference number for payment'
      ],
      reviewPDF: 'Review the attached invoice PDF',
      makePayment: 'Make payment by the due date',
      useQRCode: 'Use the QR code or reference number for payment',
      questions: 'If you have any questions, please don\'t hesitate to contact us.',
      bestRegards: 'Best regards'
    },
    reminder: {
      subject: (level: number, number: string) => `Reminder ${level} - Invoice ${number}`,
      greeting: (name: string) => `Dear ${name},`,
      intro: (level: number) => {
        if (level === 1) return 'We would like to remind you that the following invoice is still outstanding.'
        if (level === 2) return 'We would like to remind you again that the following invoice is still outstanding.'
        return 'We must urgently remind you that the following invoice needs to be settled immediately.'
      },
      invoiceNumber: 'Invoice Number',
      dueDate: 'Due Date',
      outstandingAmount: 'Outstanding Amount',
      paymentStatus: 'Payment Status',
      paidAmount: 'Paid Amount',
      totalAmount: 'Total Amount',
      remainingAmount: 'Remaining Amount',
      paymentInfo: 'Payment Information',
      qrReference: 'QR Reference',
      urgency: 'Please settle the outstanding amount immediately.',
      contact: 'If you have any questions or have already made the payment, please contact us.',
      bestRegards: 'Best regards'
    }
  },
  
  it: {
    quote: {
      subject: (number: string, customerName: string) => `Preventivo ${number} - ${customerName}`,
      greeting: (name: string) => `Gentile ${name},`,
      intro: 'Grazie per il vostro interesse per i nostri servizi. Siamo lieti di presentarvi il seguente preventivo per la vostra considerazione.',
      quoteNumber: 'Numero preventivo',
      quoteDate: 'Data preventivo',
      validUntil: 'Valido fino al',
      totalAmount: 'Importo totale',
      reviewAttached: 'Si prega di consultare il PDF del preventivo allegato per tutti i dettagli. Il preventivo rimarrà valido fino al',
      validUntilDate: '',
      acceptButton: 'Accetta preventivo',
      questions: 'Se avete domande o bisogno di chiarimenti, non esitate a contattarci.',
      bestRegards: 'Cordiali saluti',
      footer: ''
    },
    invoice: {
      subject: (number: string, customerName: string) => `Fattura ${number} - ${customerName}`,
      greeting: (name: string) => `Gentile ${name},`,
      intro: 'in allegato trovate la vostra fattura.',
      invoiceNumber: 'Numero fattura',
      invoiceDate: 'Data fattura',
      dueDate: 'Data di scadenza',
      totalAmount: 'Importo totale',
      paymentInfo: 'Informazioni di pagamento',
      qrReference: 'Riferimento QR',
      nextSteps: [
        'Consultate il PDF della fattura allegato',
        'Effettuate il pagamento entro la data di scadenza',
        'Utilizzate il codice QR o il numero di riferimento per il pagamento'
      ],
      reviewPDF: 'Consultate il PDF della fattura allegato',
      makePayment: 'Effettuate il pagamento entro la data di scadenza',
      useQRCode: 'Utilizzate il codice QR o il numero di riferimento per il pagamento',
      questions: 'Se avete domande, non esitate a contattarci.',
      bestRegards: 'Cordiali saluti'
    },
    reminder: {
      subject: (level: number, number: string) => `Promemoria ${level} - Fattura ${number}`,
      greeting: (name: string) => `Gentile ${name},`,
      intro: (level: number) => {
        if (level === 1) return 'Vorremmo ricordarvi che la seguente fattura è ancora in sospeso.'
        if (level === 2) return 'Vorremmo ricordarvi nuovamente che la seguente fattura è ancora in sospeso.'
        return 'Dobbiamo ricordarvi con urgenza che la seguente fattura deve essere saldata immediatamente.'
      },
      invoiceNumber: 'Numero fattura',
      dueDate: 'Data di scadenza',
      outstandingAmount: 'Importo in sospeso',
      paymentStatus: 'Stato del pagamento',
      paidAmount: 'Importo pagato',
      totalAmount: 'Importo totale',
      remainingAmount: 'Importo residuo',
      paymentInfo: 'Informazioni di pagamento',
      qrReference: 'Riferimento QR',
      urgency: 'Si prega di saldare l\'importo in sospeso immediatamente.',
      contact: 'Se avete domande o avete già effettuato il pagamento, contattateci.',
      bestRegards: 'Cordiali saluti'
    }
  }
}

// Helper function to get customer language or default to 'de'
export const getCustomerLanguage = (customerLanguage?: string): Language => {
  if (!customerLanguage) return 'de'
  const lang = customerLanguage.toLowerCase().slice(0, 2) as Language
  return ['de', 'fr', 'en', 'it'].includes(lang) ? lang : 'de'
}

