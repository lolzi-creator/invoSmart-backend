/**
 * Unified PDF template generator for invoices
 * Modern, compact design with brand colors
 */

// Swiss flag as base64 (for QR code center)
const SWISS_CROSS_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAdCAYAAAC5UQwxAAAAAXNSR0IArs4c6QAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHKADAAQAAAABAAAAHQAAAAB6Ff8oAAAGKElEQVRIDb1WS48UVRQ+VV1dXdXvnqEHRmBwcKEmgisFArgxGUIUVurPMCTzU4h/AFcmujZBIkSI7nDlQoMJIUgPM/2Yfj/qcf2+U13tzLTERBPPTHXduo/zPt+51s0bN0ylUhbP9yUKAnFzOcn5nli2SDiLZDabShxFIpYluZyLJyd2JiMGf3Esgm1iYiOzMJDJZCqObet6bGE+xAbs6/f3pd3uyaULFwTTmPmf6OzZTXEoy3Wzks26EoehSMaCMdAbWlMd287Aypk+r9LLg9WOk1VP0PIMzaYpIGMyMp1OJISXSqUSPABXra5UpVatyQQLxhgVaGGexPXxeCS7zQ7c7omJYgngvmw2izVb1+qrVfH9vBjsjeMIiiMEIPLIIVTNvT1ptvalitA51AQyJIIGQQALlSLJME5Y6PZ6Mp1M5N3z5+Ta9euIVyyDQU+KpbLkHE/u3v1WHv/8WPzxVJgLpJDBpcI4b0M5C3FlsEMooi6lVkEUQDsGOdGMmyNsGA7HUCSQq1euyPb2tlqlFjoOXOdIDd559ONPsDoWP5+HaxNFyYs+SnhamlwxeELgPGYmcSHdwCcDhgxjSiVYVK1U08/Fe+P1Mzrm6YyNc/BMiFzgt4YFPBhSkoX4OmCvQ13EyIb5DoS5rktVNIbcPB6P+VqiOJjpHM9ncYYCGR6GQx+sJsWBAYQ7MT9N4koK4yZmpWUZjSndQJpME8b6ceBnNEkUYXaGcD1rNkTcWKskJl2EkJENOTngC4IrIGw0GiEhRlABwcZcDEUYaFKr3VQQcN2cfqc/L140dMiEa+y8VDdG4E73lQsFKVUqmmiJOAhUzeJQ/T4cDBH8EIFOrEqZ8k2GEUriKHW7XZ2iZ6azYLGcQTGyzIqmrKWi5kENzdJBf4jUn8na8XXZ2vpQykiOAIcnKIfxdAp3RPLxRzfF8w5bR+5bW9fk+fM/NG5+zpOc54mLeh0Nh/Lg/ve6NoHbaQLdS+JYn4vvv2f29nYNBJnBoG/a7ZZp7OyYRuOFGQ4HMGKZUDJmd/el2dlpmE6rZQb9vpkGM9PudMwnn3264E0ZVy9fNmohpZK6vY5UV1YAPxkFaYTgH4kZXa+vLe1zq1WxEKpDBAPTEtH5bndf9ju9Q3v+7UeIcun2k/gueBwVeGy1LsdWa4v1/zJw0AxqlSO8gD6HLMwXi4sCR7Q0KwNoSrRPYe+oEtzHuiXcESLNvKZnSDoC+kGKIBBIg9oA/rENvUQd3fnyjryxuYkiDmWMLO10Wkj3qVy5+oGce+f8wfM6fvb0qXx3755kso6sALyZpVnUaqvVlie/P9GmTUCIUGpUjp3d1Cpls3HqpCkX8+b48TVzZuOU2Th90pxYqxvf94zveebWrc8NLFlK0y9u3zbFYhH7fHMCZzdOnzJnN8+YjY3TZrVWMSdfWwdfn53LXLp4wQBpLFwrXCmUCrgK9HAVaGlNWRagCQoRlkiNRgPzofZBnZj/9FBvg8FAv6aAPyIM3W8DyPN5H90kh5CgfgcT3TPvh8TBUPKoA95taHoWLiKsNZttRZ9jK6sA9OXCX19PSoL76/UVJIWtoIEq1wZA2NQbRFLzCdJQNBGexE5O5OdliQlj4SDJ9/LaSfTjwA97IIlMvZyPtpZcopI5APec7xxkkqRhG9KAYleajWy6IZoq40wqVA5nXDIrUszP0QEbibcx7jApD/Jkm2PLIqxRKJqC/qfnF+9Egbk0zObBmDFk2rPB8qpBymSy+k52skssE72kWYMlQBvTdXlTOuMiNkyEh/cfyFtvvg0A95BcfSkWcANDOX3z9VewArc+QBwtSD2Vnk/eXMAIj8MfxoyYSDdyTAV4kGNejNhUf3j0UH755Tf0TV77pklCYE+ruYsbX0XPs5bpTp4j8c1sNQoI6LH4VoEcMFn+EpgesvXaEMGFvFU/f/YMDHEQd9c4okJwdSGPhPK08FPlVWF8sKm7gLiBDNU8JpbDrt7t9cHE1jJwEGA25RjNVmEK1vIaz+D4fg5zuCARLSCYFvBq3x30JYtz/NYEYWajvgNIngGtet2eKkrP0HawTMzXdzrBj78lbuexVxMtJ1dlzCFNBhEy/wTzTE2cFJCAIwAAAABJRU5ErkJggg=='

export type SupportedLanguage = 'de' | 'en' | 'it' | 'fr'

interface CommonTexts {
  country: string
  phoneLabel: string
  emailLabel: string
  webLabel: string
  salutation: string
  reminderSalutation: string
  greetings: string
  daySingular: string
  dayPlural: string
  overdueSuffix: string
  acceptancePoint: string
  qrScissors: string
  qrScanCaption: string
  copyLinkInstruction: string
  questionsText: string
}

interface InvoiceTexts {
  title: string
  pageTitlePrefix: string
  metaNumber: string
  metaDate: string
  metaServiceDate: string
  metaDueDate: string
  metaReference: string
  metaAmount: string
  itemsHeader: string
  noItems: string
  totalIncludingVat: string
  qrReceiptTitle: string
  qrPaymentTitle: string
  qrAccountLabelReceipt: string
  qrAccountLabelPayment: string
  qrReferenceLabel: string
  qrAdditionalInfoLabel: string
  qrPayableByLabel: string
  qrCurrencyLabel: string
  qrAmountLabel: string
}

interface ReminderLevelTexts {
  title: string
  urgencyText: string
  message: string
  closing: string
  dueInDays: number
  additionalCosts?: string
  proofRequired?: string
}

interface ReminderTexts {
  pageTitlePrefix: string
  levels: Record<1 | 2 | 3, ReminderLevelTexts>
  greeting: string
  newDeadlineLabel: string
  originalInvoiceTitle: string
  originalInvoiceNumber: string
  originalInvoiceDate: string
  dueSinceLabel: string
  daysOverdueLabel: string
  amountOverviewTitle: string
  originalAmountLabel: string
  alreadyPaidLabel: string
  outstandingAmountLabel: string
  reminderFeeLabel: string
  totalDuePrefix: string
}

interface QuoteTexts {
  title: string
  pageTitlePrefix: string
  intro: string
  metaNumber: string
  metaDate: string
  metaValidUntil: string
  tableDescription: string
  tableQuantity: string
  tableUnit: string
  tablePrice: string
  tableVat: string
  tableTotal: string
  subtotalLabel: string
  vatLabel: string
  grandTotalLabel: string
  acceptanceTitle: string
  validityText: string
  acceptanceInstructions: string
  acceptanceNote: string
}

interface PdfTranslation {
  locale: string
  months: string[]
  common: CommonTexts
  invoice: InvoiceTexts
  reminder: ReminderTexts
  quote: QuoteTexts
}

const pdfTranslations: Record<SupportedLanguage, PdfTranslation> = {
  de: {
    locale: 'de-CH',
    months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    common: {
      country: 'Schweiz',
      phoneLabel: 'Tel',
      emailLabel: 'E-Mail',
      webLabel: 'Web',
      salutation: 'Sehr geehrte/r',
      reminderSalutation: 'Sehr geehrte Damen und Herren',
      greetings: 'Freundliche Grüsse',
      daySingular: 'Tag',
      dayPlural: 'Tage',
      overdueSuffix: 'überfällig',
      acceptancePoint: 'Annahmestelle',
      qrScissors: '✂ Hier abtrennen / Détacher ici / Staccare qui',
      qrScanCaption: 'QR-Code scannen',
      copyLinkInstruction: 'Oder kopieren Sie diesen Link in Ihren Browser:',
      questionsText: 'Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.'
    },
    invoice: {
      title: 'Rechnung',
      pageTitlePrefix: 'Rechnung',
      metaNumber: 'Rechnungsnummer',
      metaDate: 'Rechnungsdatum',
      metaServiceDate: 'Leistungsdatum',
      metaDueDate: 'Zahlbar bis',
      metaReference: 'Referenz',
      metaAmount: 'Betrag',
      itemsHeader: 'Leistungen',
      noItems: 'Keine Positionen',
      totalIncludingVat: 'Total inkl. MWST',
      qrReceiptTitle: 'Empfangsschein',
      qrPaymentTitle: 'Zahlteil',
      qrAccountLabelReceipt: 'Konto / Payable to',
      qrAccountLabelPayment: 'Konto / Zahlbar an',
      qrReferenceLabel: 'Referenz',
      qrAdditionalInfoLabel: 'Zusätzliche Informationen',
      qrPayableByLabel: 'Zahlbar durch',
      qrCurrencyLabel: 'Währung',
      qrAmountLabel: 'Betrag'
    },
    reminder: {
      pageTitlePrefix: 'Mahnung',
      levels: {
        1: {
          title: '1. Zahlungserinnerung',
          urgencyText: 'Freundliche Erinnerung',
          message: 'Unser System zeigt, dass die nachstehende Rechnung noch nicht beglichen wurde. Wir bitten Sie höflich, den offenen Betrag innerhalb der nächsten 10 Tage zu begleichen.',
          closing: 'Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben als gegenstandslos.',
          dueInDays: 10
        },
        2: {
          title: '2. Mahnung',
          urgencyText: 'Dringende Zahlungsaufforderung',
          message: 'Trotz unserer ersten Mahnung ist die nachstehende Rechnung noch immer offen. Wir bitten Sie dringend, den Betrag inklusive Mahngebühren innerhalb von 5 Tagen zu begleichen.',
          closing: 'Bei weiterem Zahlungsverzug sehen wir uns leider veranlasst, weitere Massnahmen zu ergreifen.',
          dueInDays: 5
        },
        3: {
          title: '3. und letzte Mahnung',
          urgencyText: 'Letzte Zahlungsaufforderung',
          message: 'Dies ist unsere letzte Mahnung für die nachstehende Rechnung. Sollte der offene Betrag nicht innerhalb von 3 Tagen beglichen werden, werden wir ohne weitere Vorankündigung rechtliche Schritte einleiten.',
          closing: 'Bitte begleichen Sie den offenen Betrag umgehend.',
          dueInDays: 3,
          additionalCosts: 'Dies kann zusätzliche Kosten zur Folge haben, die wir Ihnen in Rechnung stellen werden.',
          proofRequired: 'Sollten Sie die Zahlung bereits veranlasst haben, kontaktieren Sie uns bitte umgehend mit einem Zahlungsnachweis.'
        }
      },
      greeting: 'Sehr geehrte Damen und Herren,',
      newDeadlineLabel: 'Neue Zahlungsfrist',
      originalInvoiceTitle: 'Ursprüngliche Rechnung',
      originalInvoiceNumber: 'Rechnungsnummer',
      originalInvoiceDate: 'Rechnungsdatum',
      dueSinceLabel: 'Fällig seit',
      daysOverdueLabel: 'Tage überfällig',
      amountOverviewTitle: 'Offener Betrag',
      originalAmountLabel: 'Ursprünglicher Rechnungsbetrag',
      alreadyPaidLabel: 'Bereits bezahlt',
      outstandingAmountLabel: 'Offener Betrag',
      reminderFeeLabel: 'Mahngebühr',
      totalDuePrefix: 'Zu zahlen bis'
    },
    quote: {
      title: 'Offerte',
      pageTitlePrefix: 'Offerte',
      intro: 'Vielen Dank für Ihre Anfrage! Wir freuen uns, Ihnen folgende Offerte zu unterbreiten:',
      metaNumber: 'Offerten-Nr.',
      metaDate: 'Datum',
      metaValidUntil: 'Gültig bis',
      tableDescription: 'Beschreibung',
      tableQuantity: 'Menge',
      tableUnit: 'Einheit',
      tablePrice: 'Preis',
      tableVat: 'MWST',
      tableTotal: 'Total',
      subtotalLabel: 'Zwischentotal',
      vatLabel: 'MWST',
      grandTotalLabel: 'Gesamtbetrag',
      acceptanceTitle: 'Offerte akzeptieren',
      validityText: 'Diese Offerte ist gültig bis {{DATE}}.',
      acceptanceInstructions: 'Um diese Offerte zu akzeptieren, scannen Sie einfach den QR-Code oder verwenden Sie den Link in der E-Mail.',
      acceptanceNote: 'Nach der Akzeptierung wird automatisch eine Rechnung erstellt.'
    }
  },
  en: {
    locale: 'en-GB',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    common: {
      country: 'Switzerland',
      phoneLabel: 'Phone',
      emailLabel: 'Email',
      webLabel: 'Website',
      salutation: 'Dear',
      reminderSalutation: 'Dear Sir or Madam,',
      greetings: 'Best regards',
      daySingular: 'day',
      dayPlural: 'days',
      overdueSuffix: 'overdue',
      acceptancePoint: 'Acceptance point',
      qrScissors: '✂ Hier abtrennen / Détacher ici / Staccare qui',
      qrScanCaption: 'Scan QR code',
      copyLinkInstruction: 'Or copy this link into your browser:',
      questionsText: 'If you have any questions, please do not hesitate to contact us.'
    },
    invoice: {
      title: 'Invoice',
      pageTitlePrefix: 'Invoice',
      metaNumber: 'Invoice Number',
      metaDate: 'Invoice Date',
      metaServiceDate: 'Service Date',
      metaDueDate: 'Due Date',
      metaReference: 'Reference',
      metaAmount: 'Amount',
      itemsHeader: 'Items',
      noItems: 'No items',
      totalIncludingVat: 'Total incl. VAT',
      qrReceiptTitle: 'Receipt',
      qrPaymentTitle: 'Payment part',
      qrAccountLabelReceipt: 'Account / Payable to',
      qrAccountLabelPayment: 'Account / Payable to',
      qrReferenceLabel: 'Reference',
      qrAdditionalInfoLabel: 'Additional information',
      qrPayableByLabel: 'Payable by',
      qrCurrencyLabel: 'Currency',
      qrAmountLabel: 'Amount'
    },
    reminder: {
      pageTitlePrefix: 'Reminder',
      levels: {
        1: {
          title: '1st Payment Reminder',
          urgencyText: 'Friendly reminder',
          message: 'Our records show that the following invoice has not yet been paid. We kindly ask you to settle the outstanding amount within the next 10 days.',
          closing: 'If you have already made this payment, please disregard this notice.',
          dueInDays: 10
        },
        2: {
          title: '2nd Payment Reminder',
          urgencyText: 'Urgent payment request',
          message: 'Despite our first reminder, the following invoice is still outstanding. We urgently request you to settle the amount including reminder fees within 5 days.',
          closing: 'If payment is not received, we will have to take further action.',
          dueInDays: 5
        },
        3: {
          title: 'Final Notice',
          urgencyText: 'Last payment request',
          message: 'This is our final reminder for the following invoice. If the outstanding amount is not paid within 3 days, we will initiate legal proceedings without further notice.',
          closing: 'Please settle the outstanding amount immediately.',
          dueInDays: 3,
          additionalCosts: 'This may result in additional costs that we will charge to you.',
          proofRequired: 'If you have already made this payment, please contact us immediately with proof of payment.'
        }
      },
      greeting: 'Dear Sir or Madam,',
      newDeadlineLabel: 'New payment deadline',
      originalInvoiceTitle: 'Original invoice',
      originalInvoiceNumber: 'Invoice number',
      originalInvoiceDate: 'Invoice date',
      dueSinceLabel: 'Due since',
      daysOverdueLabel: 'Days overdue',
      amountOverviewTitle: 'Outstanding amount',
      originalAmountLabel: 'Original invoice amount',
      alreadyPaidLabel: 'Already paid',
      outstandingAmountLabel: 'Outstanding balance',
      reminderFeeLabel: 'Reminder fee',
      totalDuePrefix: 'Pay by'
    },
    quote: {
      title: 'Quote',
      pageTitlePrefix: 'Quote',
      intro: 'Thank you for your inquiry! We are pleased to present the following quote:',
      metaNumber: 'Quote number',
      metaDate: 'Date',
      metaValidUntil: 'Valid until',
      tableDescription: 'Description',
      tableQuantity: 'Quantity',
      tableUnit: 'Unit',
      tablePrice: 'Price',
      tableVat: 'VAT',
      tableTotal: 'Total',
      subtotalLabel: 'Subtotal',
      vatLabel: 'VAT',
      grandTotalLabel: 'Total amount',
      acceptanceTitle: 'Accept quote',
      validityText: 'This quote is valid until {{DATE}}.',
      acceptanceInstructions: 'To accept this quote, simply scan the QR code or use the link in the email.',
      acceptanceNote: 'Once accepted, an invoice will be generated automatically.'
    }
  },
  it: {
    locale: 'it-CH',
    months: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
    common: {
      country: 'Svizzera',
      phoneLabel: 'Telefono',
      emailLabel: 'E-mail',
      webLabel: 'Sito web',
      salutation: 'Gentile',
      reminderSalutation: 'Gentili Signore e Signori,',
      greetings: 'Cordiali saluti',
      daySingular: 'giorno',
      dayPlural: 'giorni',
      overdueSuffix: 'in ritardo',
      acceptancePoint: 'Punto di accettazione',
      qrScissors: '✂ Hier abtrennen / Détacher ici / Staccare qui',
      qrScanCaption: 'Scansiona il codice QR',
      copyLinkInstruction: 'Oppure copi questo link nel suo browser:',
      questionsText: 'Per qualsiasi domanda non esiti a contattarci.'
    },
    invoice: {
      title: 'Fattura',
      pageTitlePrefix: 'Fattura',
      metaNumber: 'Numero fattura',
      metaDate: 'Data fattura',
      metaServiceDate: 'Data della prestazione',
      metaDueDate: 'Scadenza',
      metaReference: 'Riferimento',
      metaAmount: 'Importo',
      itemsHeader: 'Prestazioni',
      noItems: 'Nessuna voce',
      totalIncludingVat: 'Totale incl. IVA',
      qrReceiptTitle: 'Ricevuta',
      qrPaymentTitle: 'Sezione pagamento',
      qrAccountLabelReceipt: 'Conto / A versare a',
      qrAccountLabelPayment: 'Conto / A versare a',
      qrReferenceLabel: 'Riferimento',
      qrAdditionalInfoLabel: 'Informazioni aggiuntive',
      qrPayableByLabel: 'Pagabile da',
      qrCurrencyLabel: 'Valuta',
      qrAmountLabel: 'Importo'
    },
    reminder: {
      pageTitlePrefix: 'Richiamo',
      levels: {
        1: {
          title: '1° sollecito di pagamento',
          urgencyText: 'Promemoria amichevole',
          message: 'Il nostro sistema mostra che la seguente fattura non è ancora stata pagata. La preghiamo cortesemente di saldare l’importo dovuto entro i prossimi 10 giorni.',
          closing: 'Se ha già effettuato il pagamento, La preghiamo di ignorare questa comunicazione.',
          dueInDays: 10
        },
        2: {
          title: '2° sollecito di pagamento',
          urgencyText: 'Richiesta urgente di pagamento',
          message: 'Nonostante il primo sollecito, la seguente fattura risulta ancora aperta. La preghiamo urgentemente di saldare l’importo, comprensivo delle spese di sollecito, entro 5 giorni.',
          closing: 'In caso di ulteriore ritardo saremo costretti ad adottare ulteriori misure.',
          dueInDays: 5
        },
        3: {
          title: 'Ultimo avviso',
          urgencyText: 'Ultima richiesta di pagamento',
          message: 'Questo è il nostro ultimo sollecito per la seguente fattura. Se l’importo dovuto non verrà pagato entro 3 giorni, avvieremo azioni legali senza ulteriore preavviso.',
          closing: 'La preghiamo di saldare immediatamente l’importo dovuto.',
          dueInDays: 3,
          additionalCosts: 'Ciò può comportare costi aggiuntivi che Le verranno addebitati.',
          proofRequired: 'Se ha già effettuato il pagamento, La preghiamo di contattarci immediatamente con una prova del pagamento.'
        }
      },
      greeting: 'Gentili Signore e Signori,',
      newDeadlineLabel: 'Nuova scadenza di pagamento',
      originalInvoiceTitle: 'Fattura originale',
      originalInvoiceNumber: 'Numero fattura',
      originalInvoiceDate: 'Data fattura',
      dueSinceLabel: 'Scaduta dal',
      daysOverdueLabel: 'Giorni di ritardo',
      amountOverviewTitle: 'Importo dovuto',
      originalAmountLabel: 'Importo originale della fattura',
      alreadyPaidLabel: 'Già pagato',
      outstandingAmountLabel: 'Importo residuo',
      reminderFeeLabel: 'Spese di sollecito',
      totalDuePrefix: 'Da pagare entro'
    },
    quote: {
      title: 'Preventivo',
      pageTitlePrefix: 'Preventivo',
      intro: 'Grazie per la Sua richiesta! Siamo lieti di presentarLe il seguente preventivo:',
      metaNumber: 'Numero preventivo',
      metaDate: 'Data',
      metaValidUntil: 'Valido fino al',
      tableDescription: 'Descrizione',
      tableQuantity: 'Quantità',
      tableUnit: 'Unità',
      tablePrice: 'Prezzo',
      tableVat: 'IVA',
      tableTotal: 'Totale',
      subtotalLabel: 'Totale parziale',
      vatLabel: 'IVA',
      grandTotalLabel: 'Importo totale',
      acceptanceTitle: 'Accetta preventivo',
      validityText: 'Questo preventivo è valido fino al {{DATE}}.',
      acceptanceInstructions: 'Per accettare questo preventivo, scansioni il codice QR o utilizzi il link nell’e-mail.',
      acceptanceNote: 'Una volta accettato, verrà generata automaticamente una fattura.'
    }
  },
  fr: {
    locale: 'fr-CH',
    months: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
    common: {
      country: 'Suisse',
      phoneLabel: 'Téléphone',
      emailLabel: 'E-mail',
      webLabel: 'Site web',
      salutation: 'Madame, Monsieur',
      reminderSalutation: 'Madame, Monsieur,',
      greetings: 'Meilleures salutations',
      daySingular: 'jour',
      dayPlural: 'jours',
      overdueSuffix: 'en retard',
      acceptancePoint: 'Point de dépôt',
      qrScissors: '✂ Hier abtrennen / Détacher ici / Staccare qui',
      qrScanCaption: 'Scanner le code QR',
      copyLinkInstruction: 'Ou copiez ce lien dans votre navigateur :',
      questionsText: 'Si vous avez des questions, n’hésitez pas à nous contacter.'
    },
    invoice: {
      title: 'Facture',
      pageTitlePrefix: 'Facture',
      metaNumber: 'Numéro de facture',
      metaDate: 'Date de facture',
      metaServiceDate: 'Date de prestation',
      metaDueDate: 'Échéance',
      metaReference: 'Référence',
      metaAmount: 'Montant',
      itemsHeader: 'Prestations',
      noItems: 'Aucune position',
      totalIncludingVat: 'Total incl. TVA',
      qrReceiptTitle: 'Récépissé',
      qrPaymentTitle: 'Section paiement',
      qrAccountLabelReceipt: 'Compte / Payable à',
      qrAccountLabelPayment: 'Compte / Payable à',
      qrReferenceLabel: 'Référence',
      qrAdditionalInfoLabel: 'Informations supplémentaires',
      qrPayableByLabel: 'Payable par',
      qrCurrencyLabel: 'Devise',
      qrAmountLabel: 'Montant'
    },
    reminder: {
      pageTitlePrefix: 'Rappel',
      levels: {
        1: {
          title: '1er rappel de paiement',
          urgencyText: 'Rappel amical',
          message: 'Notre système indique que la facture ci-dessous n’a pas encore été payée. Nous vous prions de bien vouloir régler le montant ouvert dans les 10 prochains jours.',
          closing: 'Si vous avez déjà effectué ce paiement, veuillez ne pas tenir compte de ce courrier.',
          dueInDays: 10
        },
        2: {
          title: '2e rappel de paiement',
          urgencyText: 'Demande de paiement urgente',
          message: 'Malgré notre premier rappel, la facture ci-dessous reste ouverte. Nous vous demandons instamment de régler le montant, frais de rappel inclus, dans un délai de 5 jours.',
          closing: 'En cas de retard supplémentaire, nous serons malheureusement contraints de prendre d’autres mesures.',
          dueInDays: 5
        },
        3: {
          title: 'Dernier avis',
          urgencyText: 'Dernière demande de paiement',
          message: 'Il s’agit de notre dernier rappel pour la facture ci-dessous. Si le montant ouvert n’est pas réglé dans un délai de 3 jours, nous engagerons des poursuites sans autre avertissement.',
          closing: 'Veuillez régler immédiatement le montant en souffrance.',
          dueInDays: 3,
          additionalCosts: 'Cela peut entraîner des frais supplémentaires qui vous seront facturés.',
          proofRequired: 'Si vous avez déjà effectué ce paiement, veuillez nous contacter immédiatement avec une preuve de paiement.'
        }
      },
      greeting: 'Madame, Monsieur,',
      newDeadlineLabel: 'Nouvelle date limite de paiement',
      originalInvoiceTitle: 'Facture originale',
      originalInvoiceNumber: 'Numéro de facture',
      originalInvoiceDate: 'Date de facture',
      dueSinceLabel: 'Échue depuis',
      daysOverdueLabel: 'Jours de retard',
      amountOverviewTitle: 'Montant ouvert',
      originalAmountLabel: 'Montant initial de la facture',
      alreadyPaidLabel: 'Déjà payé',
      outstandingAmountLabel: 'Montant restant',
      reminderFeeLabel: 'Frais de rappel',
      totalDuePrefix: 'À payer avant'
    },
    quote: {
      title: 'Devis',
      pageTitlePrefix: 'Devis',
      intro: 'Merci pour votre demande ! Nous sommes heureux de vous présenter le devis suivant :',
      metaNumber: 'Numéro de devis',
      metaDate: 'Date',
      metaValidUntil: 'Valable jusqu’au',
      tableDescription: 'Description',
      tableQuantity: 'Quantité',
      tableUnit: 'Unité',
      tablePrice: 'Prix',
      tableVat: 'TVA',
      tableTotal: 'Total',
      subtotalLabel: 'Sous-total',
      vatLabel: 'TVA',
      grandTotalLabel: 'Montant total',
      acceptanceTitle: 'Accepter le devis',
      validityText: 'Ce devis est valable jusqu’au {{DATE}}.',
      acceptanceInstructions: 'Pour accepter ce devis, scannez simplement le code QR ou utilisez le lien dans l’e-mail.',
      acceptanceNote: 'Après acceptation, une facture sera générée automatiquement.'
    }
  }
}

const resolveLanguage = (input?: string | null): SupportedLanguage => {
  if (!input) {
    return 'de'
  }
  const normalized = input.toLowerCase()
  if (normalized.startsWith('en')) return 'en'
  if (normalized.startsWith('it')) return 'it'
  if (normalized.startsWith('fr')) return 'fr'
  return 'de'
}

const getPdfTranslation = (input?: string | null): { lang: SupportedLanguage; t: PdfTranslation } => {
  const lang = resolveLanguage(input)
  return { lang, t: pdfTranslations[lang] }
}

const getPageLabel = (lang: SupportedLanguage, current: number, total: number): string => {
  switch (lang) {
    case 'en':
      return `Page ${current} of ${total}`
    case 'it':
      return `Pagina ${current} di ${total}`
    case 'fr':
      return `Page ${current} sur ${total}`
    default:
      return `Seite ${current} von ${total}`
  }
}

// Format Swiss MWST number as CHE-xxx.xxx.xxx MWST
export const formatSwissMwst = (vatNumber?: string | null): string | null => {
  if (!vatNumber) return null
  const digits = (vatNumber.match(/\d/g) || []).join('')
  if (digits.length < 9) return null
  const d = digits.slice(0, 9)
  return `CHE-${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)} MWST`
}

export interface InvoicePdfData {
  invoice: {
    number: string
    date: string | Date
    due_date: string | Date
    service_date?: string | Date
    qr_reference: string
    subtotal: number
    discount_amount: number
    vat_amount: number
    total: number
    invoice_items?: Array<{
      description: string
      quantity: number
      unit: string
      unit_price: number
      discount: number
      vat_rate: number
      line_total: number
      vat_amount?: number
    }>
  }
  customer: {
    name: string
    company?: string | null
    address: string
    zip: string
    city: string
    country: string
    email?: string | null
    phone?: string | null
    payment_terms?: number | null
  }
  company: {
    name: string
    address: string
    zip: string
    city: string
    email: string
    phone?: string | null
    uid?: string | null
    vat_number?: string | null
    iban?: string | null
    qr_iban?: string | null
    website?: string | null
  }
  qrCodeImage: string
  logoBase64?: string | null
  swissCrossBase64?: string | null
  paymentReference: string
  referenceType: 'QRR' | 'SCOR'
  iban: string
  language?: SupportedLanguage | null
}

export const generateUnifiedInvoicePdfTemplate = (data: InvoicePdfData): string => {
  const { invoice, customer, company, qrCodeImage, logoBase64, paymentReference, referenceType, iban } = data
  const { lang, t } = getPdfTranslation(data.language)
  const common = t.common
  const invoiceTexts = t.invoice
  
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(t.locale)
  }
  
  const formatMonth = (date: string | Date) => {
    const months = t.months
    const d = new Date(date)
    return `${months[d.getMonth()]} ${d.getFullYear()}`
  }
  
  const formatCurrency = (amount: number) => {
    return (amount / 100).toFixed(2)
  }
  
  // Format IBAN with spaces according to Swiss standards (groups of 4)
  const formatIBAN = (ibanStr: string) => {
    if (!ibanStr) return ibanStr
    // Remove existing spaces
    const cleanIBAN = ibanStr.replace(/\s/g, '')
    // Group in blocks of 4
    const groups = cleanIBAN.match(/.{1,4}/g) || []
    return groups.join(' ')
  }
  
  // Format payment reference with spaces according to Swiss standards
  // QR Reference (27 digits): Groups of 5, e.g., "12 34567 89012 34567 89012 34567"
  // SCOR Reference (RF + digits): "RF" + space + groups of 4, e.g., "RF18 5390 0754 7034 5"
  const formatPaymentReference = (ref: string) => {
    if (!ref) return ref
    
    if (ref.startsWith('RF')) {
      // SCOR format: RF + 2 digits, then groups of 4
      const rfPart = ref.substring(0, 2) // "RF"
      const checkDigits = ref.substring(2, 4) // 2 check digits
      const rest = ref.substring(4) // remaining digits
      
      // Group the rest in blocks of 4
      const groups = rest.match(/.{1,4}/g) || []
      return `${rfPart}${checkDigits} ${groups.join(' ')}`
    } else {
      // QR Reference format: Groups of 5 digits
      // First group is 2 digits, then groups of 5
      const firstGroup = ref.substring(0, 2)
      const rest = ref.substring(2)
      const groups = rest.match(/.{1,5}/g) || []
      return `${firstGroup} ${groups.join(' ')}`
    }
  }
  
  const formattedIBAN = formatIBAN(iban)
  const formattedReference = formatPaymentReference(paymentReference)
  const formattedMwst = formatSwissMwst(company.vat_number)
  const pageLabel = getPageLabel(lang, 1, 2)
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${invoiceTexts.pageTitlePrefix} ${invoice.number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      color: #1a1a1a;
      line-height: 1.5;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm 20mm;
      position: relative;
      page-break-after: always;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 25mm;
    }
    
    .logo {
      width: 100mm;
      height: 30mm;
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }
    
    .logo img {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      object-fit: contain;
      object-position: left center;
    }
    
    .header-right {
      text-align: right;
      font-size: 8.5pt;
      color: #666;
    }
    
    .header-right .company-line {
      margin-bottom: 3mm;
    }
    
    .header-right h1 {
      font-size: 16pt;
      font-weight: 600;
      margin-top: 2mm;
      color: #000;
    }
    
    .page-number {
      position: absolute;
      top: 12mm;
      right: 20mm;
      font-size: 8pt;
      color: #999;
    }
    
    /* Invoice details - compact layout */
    .invoice-details {
      display: flex;
      justify-content: space-between;
      gap: 8mm;
      margin-bottom: 10mm;
    }
    
    .customer-address {
      flex: 1;
      padding: 4mm;
      background: #f5f5f5;
      border-left: 3pt solid #ff6b35;
      font-size: 9.5pt;
      line-height: 1.6;
    }
    
    .customer-address div:first-child {
      font-weight: 600;
      color: #ff6b35;
      margin-bottom: 1mm;
    }
    
    .company-info-box {
      flex: 1;
      padding: 4mm;
      background: #f5f5f5;
      border-left: 3pt solid #333;
      font-size: 9pt;
      line-height: 1.6;
    }
    
    .company-info-box div:first-child {
      font-weight: 600;
      color: #333;
      margin-bottom: 1mm;
    }
    
    .company-info-box .info-line {
      margin-top: 2mm;
      font-size: 8.5pt;
    }
    
    .invoice-meta {
      flex: 1;
      background: #f8f9fa;
      padding: 4mm;
      border-radius: 2mm;
      border: 1pt solid #e0e0e0;
    }
    
    .invoice-meta table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }
    
    .invoice-meta td {
      padding: 2mm 0;
      border-bottom: none;
    }
    
    .invoice-meta tr:not(:last-child) td {
      padding-bottom: 2.5mm;
    }
    
    .invoice-meta td:first-child {
      color: #555;
      font-weight: 500;
      width: 50%;
    }
    
    .invoice-meta td:last-child {
      text-align: right;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .invoice-meta tr:last-child td {
      padding-top: 3mm;
      margin-top: 2mm;
      border-top: 1pt solid #ddd;
      font-size: 10pt;
    }
    
    .invoice-meta tr:last-child td:last-child {
      color: #ff6b35;
      font-weight: 700;
    }
    
    /* Items Table */
    .items-section {
      margin-bottom: 10mm;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      margin-top: 8mm;
    }
    
    .items-table thead {
      display: table-header-group; /* Repeat header on each page */
    }
    
    .items-table thead tr {
      background: #f8f9fa;
      border-bottom: 1.5pt solid #333;
    }
    
    .items-table th {
      padding: 3mm 2mm;
      text-align: left;
      font-weight: 600;
      font-size: 9pt;
      text-transform: uppercase;
      color: #333;
    }
    
    .items-table th:last-child {
      text-align: right;
      width: 25mm;
    }
    
    .items-table tbody {
      display: table-row-group; /* Allow body to break across pages */
    }
    
    .items-table tbody tr {
      border-bottom: 0.5pt solid #e8e8e8;
      page-break-inside: avoid; /* Don't break a row in the middle */
      page-break-after: auto; /* But allow breaks between rows */
    }
    
    .items-table td {
      padding: 3mm 2mm;
      vertical-align: top;
    }
    
    .items-table td:last-child {
      text-align: right;
      font-weight: 500;
    }
    
    .item-description {
      font-weight: 500;
      color: #1a1a1a;
    }
    
    /* Total */
    .total-section {
      page-break-inside: avoid;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 3.5mm 5mm;
      background: #ff6b35;
      color: #fff;
      font-weight: 600;
      font-size: 11pt;
      margin-top: 5mm;
      border-radius: 2mm;
    }
    
    /* Footer */
    .footer {
      position: absolute;
      bottom: 12mm;
      left: 20mm;
      right: 20mm;
      font-size: 7.5pt;
      line-height: 1.6;
      color: #666;
      border-top: 0.5pt solid #e0e0e0;
      padding-top: 3mm;
    }
    
    .footer-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1.5mm;
    }
    
    /* QR Payment Section */
    .qr-payment-section {
      page-break-before: always;
      width: 210mm;
      min-height: 297mm;
      position: relative;
      padding: 0;
      margin: 0;
    }
    
    .qr-bill-container {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
    }
    
    .qr-bill-title {
      text-align: center;
      font-weight: 600;
      font-size: 11pt;
      padding: 5mm 0;
    }
    
    .qr-bill {
      display: flex;
      height: 105mm;
      border: 1pt solid #000;
    }
    
    /* Receipt (Left - 62mm) */
    .qr-receipt {
      width: 62mm;
      padding: 5mm;
      border-right: 1pt dashed #000;
      position: relative;
      font-size: 8pt;
    }
    
    .qr-section-title {
      font-weight: 600;
      font-size: 11pt;
      margin-bottom: 5mm;
    }
    
    .qr-label {
      font-weight: 600;
      font-size: 6pt;
      margin-top: 3mm;
      margin-bottom: 1mm;
      text-transform: uppercase;
    }
    
    .qr-value {
      font-size: 8pt;
      line-height: 1.3;
    }
    
    .qr-amount {
      position: absolute;
      bottom: 10mm;
      left: 5mm;
      display: flex;
      gap: 8mm;
    }
    
    .qr-acceptance {
      position: absolute;
      bottom: 3mm;
      right: 5mm;
      font-size: 6pt;
      color: #666;
    }
    
    /* Payment (Right - 148mm) */
    .qr-payment {
      flex: 1;
      padding: 5mm;
      position: relative;
      font-size: 8pt;
    }
    
    .qr-layout {
      display: flex;
      gap: 8mm;
      margin-top: 5mm;
    }
    
    .qr-left {
      width: 60mm;
      text-align: center;
    }
    
    .qr-code-container {
      width: 46mm;
      height: 46mm;
      margin: 0 auto 5mm;
      position: relative;
    }
    
    .qr-code-container img {
      width: 100%;
      height: 100%;
    }
    
    .swiss-cross {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 7mm;
      height: 7mm;
    }
    
    .swiss-cross img {
      width: 100%;
      height: 100%;
    }
    
    .qr-amount-below {
      display: flex;
      gap: 10mm;
      justify-content: center;
    }
    
    .qr-right {
      flex: 1;
    }
    
    .scissors-line {
      text-align: center;
      font-size: 8pt;
      padding: 2mm 0;
      border-top: 1pt dashed #000;
      color: #666;
    }
    
    @media print {
      .page { page-break-after: always; }
    }
  </style>
</head>
<body>
  <!-- Page 1: Invoice -->
  <div class="page">
    <div class="page-number">${pageLabel}</div>
    
    <div class="header">
      <div class="logo">
        ${logoBase64 ? `<img src="${logoBase64}" alt="${company.name}" />` : `<div style="font-size: 14pt; font-weight: 600; color: #1a1a1a;">${company.name}</div>`}
      </div>
      <div class="header-right">
        <div class="company-line">${company.name}, ${company.address}, ${company.zip} ${company.city}</div>
        <h1>${invoiceTexts.title}</h1>
      </div>
    </div>
    
    <div class="invoice-details">
      <div class="customer-address">
        <div>${customer.name}</div>
        ${customer.company ? `<div>${customer.company}</div>` : ''}
        <div>${customer.address}</div>
        <div>${customer.zip} ${customer.city}</div>
        <div>${customer.country === 'CH' ? common.country : customer.country}</div>
      </div>
      
      <div class="company-info-box">
        <div>${company.name}</div>
        <div class="info-line">${company.address}</div>
        <div class="info-line">${company.zip} ${company.city}</div>
        <div class="info-line" style="margin-top: 3mm;">${common.phoneLabel}: ${company.phone || 'N/A'}</div>
        <div class="info-line">${common.emailLabel}: ${company.email}</div>
        ${company.website ? `<div class="info-line">${common.webLabel}: ${company.website}</div>` : ''}
        ${formattedMwst ? `<div class="info-line" style="margin-top: 3mm; font-weight: 600;">${formattedMwst}</div>` : (company.uid ? `<div class="info-line" style="margin-top: 3mm;">UID: ${company.uid}</div>` : '')}
      </div>
    </div>
    
    <div class="invoice-meta">
      <table>
        <tr><td>${invoiceTexts.metaNumber}</td><td>${invoice.number}</td></tr>
        <tr><td>${invoiceTexts.metaDate}</td><td>${formatDate(invoice.date)}</td></tr>
        <tr><td>${invoiceTexts.metaServiceDate}</td><td>${formatDate(invoice.service_date || invoice.date)}</td></tr>
        <tr><td>${invoiceTexts.metaDueDate}</td><td>${formatDate(invoice.due_date)}</td></tr>
        <tr><td>${invoiceTexts.metaReference}</td><td style="font-size: 8.5pt;">${formattedReference}</td></tr>
        <tr style="border-bottom: none;"><td>${invoiceTexts.metaAmount}</td><td>CHF ${formatCurrency(invoice.total)}</td></tr>
      </table>
    </div>
    
    <div class="items-section">
      <table class="items-table">
        <thead>
          <tr>
            <th>${invoiceTexts.itemsHeader}</th>
            <th style="text-align: right;">${invoiceTexts.metaAmount}</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.invoice_items?.map(item => `
          <tr>
            <td class="item-description">${item.description}</td>
            <td>CHF ${formatCurrency(item.line_total)}</td>
          </tr>
          `).join('') || `<tr><td class="item-description">${invoiceTexts.noItems}</td><td>CHF 0.00</td></tr>`}
        </tbody>
      </table>
    </div>
    
    <div class="total-section">
      <div class="total-row">
        <div>${invoiceTexts.totalIncludingVat}</div>
        <div>CHF ${formatCurrency(invoice.total)}</div>
      </div>
    </div>
  </div>
  
  <!-- QR Payment Page -->
  <div class="qr-payment-section">
    <div class="qr-bill-container">
      <div class="qr-bill-title">Zahlteil / Section paiement / Sezione pagamento</div>
      
      <div class="qr-bill">
        <!-- Empfangsschein (Receipt - Left) -->
        <div class="qr-receipt">
          <div class="qr-section-title">${invoiceTexts.qrReceiptTitle}</div>
          
          <div class="qr-label">${invoiceTexts.qrAccountLabelReceipt}</div>
          <div class="qr-value">
            ${formattedIBAN}<br>
            ${company.name}<br>
            ${company.address}<br>
            ${company.zip} ${company.city}
          </div>
          
          <div class="qr-label">${invoiceTexts.qrReferenceLabel}</div>
          <div class="qr-value">${formattedReference}</div>
          
          <div class="qr-label">${invoiceTexts.qrPayableByLabel}</div>
          <div class="qr-value">
            ${customer.name}<br>
            ${customer.address}<br>
            ${customer.zip} ${customer.city}
          </div>
          
          <div class="qr-amount">
            <div>
              <div class="qr-label">${invoiceTexts.qrCurrencyLabel}</div>
              <div class="qr-value">CHF</div>
            </div>
            <div>
              <div class="qr-label">${invoiceTexts.qrAmountLabel}</div>
              <div class="qr-value" style="font-weight: 600;">${formatCurrency(invoice.total)}</div>
            </div>
          </div>
          
          <div class="qr-acceptance">${common.acceptancePoint}</div>
        </div>
        
        <!-- Zahlteil (Payment - Right) -->
        <div class="qr-payment">
          <div class="qr-section-title">${invoiceTexts.qrPaymentTitle}</div>
          
          <div class="qr-layout">
            <!-- Left: QR Code + Amount below -->
            <div class="qr-left">
              <div class="qr-code-container">
                <img src="${qrCodeImage}" alt="QR Code" />
                <div class="swiss-cross">
                  <img src="${SWISS_CROSS_BASE64}" alt="Swiss Cross" />
                </div>
              </div>
              
              <div class="qr-amount-below">
                <div>
                  <div class="qr-label">${invoiceTexts.qrCurrencyLabel}</div>
                  <div class="qr-value">CHF</div>
                </div>
                <div>
                  <div class="qr-label">${invoiceTexts.qrAmountLabel}</div>
                  <div class="qr-value" style="font-weight: 600; font-size: 11pt;">${formatCurrency(invoice.total)}</div>
                </div>
              </div>
            </div>
            
            <!-- Right: Account & Payment Details -->
            <div class="qr-right">
              <div class="qr-label">${invoiceTexts.qrAccountLabelPayment}</div>
              <div class="qr-value">
                ${formattedIBAN}<br>
                ${company.name}<br>
                ${company.address}<br>
                ${company.zip} ${company.city}
              </div>
              
              <div class="qr-label">${invoiceTexts.qrReferenceLabel}</div>
              <div class="qr-value">${formattedReference}</div>
              
              <div class="qr-label">${invoiceTexts.qrAdditionalInfoLabel}</div>
              <div class="qr-value">${company.name}, ${formatMonth(invoice.service_date || invoice.date)}</div>
              
              <div class="qr-label">${invoiceTexts.qrPayableByLabel}</div>
              <div class="qr-value">
                ${customer.name}<br>
                ${customer.address}<br>
                ${customer.zip} ${customer.city}
              </div>
            </div>
          </div>
          
          <div class="qr-acceptance">${common.acceptancePoint}</div>
        </div>
      </div>
      
      <div class="scissors-line">${common.qrScissors}</div>
    </div>
  </div>
</body>
</html>
  `
}

// ====================================
// REMINDER PDF TEMPLATE
// ====================================

export interface ReminderPdfData {
  invoice: {
    number: string
    date: string | Date
    due_date: string | Date
    service_date?: string | Date
    qr_reference: string
    subtotal: number
    vat_amount: number
    total: number
    paid_amount: number
    invoice_items?: Array<{
      description: string
      quantity: number
      unit: string
      unit_price: number
      discount: number
      vat_rate: number
      line_total: number
      vat_amount?: number
    }>
  }
  customer: {
    name: string
    company?: string | null
    address: string
    zip: string
    city: string
    country: string
    email?: string | null
    phone?: string | null
  }
  company: {
    name: string
    address: string
    zip: string
    city: string
    email: string
    phone?: string | null
    uid?: string | null
    vat_number?: string | null
    iban?: string | null
    qr_iban?: string | null
    website?: string | null
  }
  qrCodeImage: string
  logoBase64?: string | null
  paymentReference: string
  referenceType: 'QRR' | 'SCOR'
  iban: string
  reminderLevel: 1 | 2 | 3
  reminderFee: number
  daysOverdue: number
  language?: SupportedLanguage | null
}

export const generateReminderPdfTemplate = (data: ReminderPdfData): string => {
  const { invoice, customer, company, qrCodeImage, logoBase64, paymentReference, referenceType, iban, reminderLevel, reminderFee, daysOverdue } = data
  const { lang, t } = getPdfTranslation(data.language)
  const common = t.common
  const reminderTexts = t.reminder
  const invoiceTexts = t.invoice
  
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(t.locale)
  }
  
  const formatCurrency = (amount: number) => {
    return (amount / 100).toFixed(2)
  }
  
  // Format IBAN with spaces according to Swiss standards (groups of 4)
  const formatIBAN = (ibanStr: string) => {
    if (!ibanStr) return ibanStr
    const cleanIBAN = ibanStr.replace(/\s/g, '')
    const groups = cleanIBAN.match(/.{1,4}/g) || []
    return groups.join(' ')
  }
  
  // Format payment reference with spaces according to Swiss standards
  const formatPaymentReference = (ref: string) => {
    if (!ref) return ref
    
    if (ref.startsWith('RF')) {
      const rfPart = ref.substring(0, 2)
      const checkDigits = ref.substring(2, 4)
      const rest = ref.substring(4)
      const groups = rest.match(/.{1,4}/g) || []
      return `${rfPart}${checkDigits} ${groups.join(' ')}`
    } else {
      const firstGroup = ref.substring(0, 2)
      const rest = ref.substring(2)
      const groups = rest.match(/.{1,5}/g) || []
      return `${firstGroup} ${groups.join(' ')}`
    }
  }
  
  const formattedIBAN = formatIBAN(iban)
  const formattedReference = formatPaymentReference(paymentReference)
  const remainingAmount = invoice.total - invoice.paid_amount
  const totalWithFee = remainingAmount + (reminderFee * 100) // Fee in Rappen
  
  const config = reminderTexts.levels[reminderLevel] || reminderTexts.levels[1]
  const levelColorMap: Record<1 | 2 | 3, string> = {
    1: '#ff6b35',
    2: '#d97706',
    3: '#dc2626'
  }
  const levelColor = levelColorMap[reminderLevel] || levelColorMap[1]
  const pageLabel = getPageLabel(lang, 1, 2)
  const newDueDate = new Date()
  newDueDate.setDate(newDueDate.getDate() + config.dueInDays)
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${config.title} - ${invoice.number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      color: #1a1a1a;
      line-height: 1.5;
    }
    
    .page {
      width: 210mm;
      height: 297mm;
      padding: 12mm 18mm;
      position: relative;
      page-break-after: always;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12mm;
    }
    
    .logo {
      width: 100mm;
      height: 30mm;
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }
    
    .logo img {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      object-fit: contain;
      object-position: left center;
    }
    
    .header-right {
      text-align: right;
      font-size: 8.5pt;
      color: #666;
    }
    
    .header-right .company-line {
      margin-bottom: 3mm;
    }
    
    .header-right h1 {
      font-size: 16pt;
      font-weight: 600;
      margin-top: 2mm;
      color: ${levelColor};
    }
    
    .page-number {
      position: absolute;
      top: 12mm;
      right: 20mm;
      font-size: 8pt;
      color: #999;
    }
    
    /* Urgency Banner */
    .urgency-banner {
      padding: 3mm;
      background: ${levelColor};
      color: #fff;
      text-align: center;
      font-weight: 600;
      font-size: 10pt;
      margin-bottom: 6mm;
      border-radius: 2mm;
    }
    
    /* Address Boxes */
    .address-boxes {
      display: flex;
      gap: 8mm;
      margin-bottom: 8mm;
    }
    
    .customer-address {
      flex: 1;
      padding: 3mm;
      background: #f5f5f5;
      border-left: 3pt solid ${levelColor};
      font-size: 9pt;
      line-height: 1.4;
    }
    
    .customer-address div:first-child {
      font-weight: 600;
      color: ${levelColor};
    }
    
    .company-info-box {
      flex: 1;
      padding: 3mm;
      background: #f5f5f5;
      border-left: 3pt solid #333;
      font-size: 8.5pt;
      line-height: 1.4;
    }
    
    .company-info-box div:first-child {
      font-weight: 600;
      margin-bottom: 1mm;
    }
    
    /* Reminder Message */
    .reminder-message {
      margin-bottom: 6mm;
      padding: 3mm;
      background: #fff8f0;
      border-left: 3pt solid ${levelColor};
      font-size: 9.5pt;
      line-height: 1.5;
    }
    
    .reminder-message p {
      margin-bottom: 2mm;
    }
    
    .reminder-message strong {
      color: ${levelColor};
    }
    
    /* Invoice Reference */
    .invoice-reference {
      margin-bottom: 5mm;
      padding: 3mm;
      background: #f8f9fa;
      border-radius: 2mm;
    }
    
    .invoice-reference table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }
    
    .invoice-reference td {
      padding: 2mm 0;
      border-bottom: 0.5pt solid #e8e8e8;
    }
    
    .invoice-reference td:first-child {
      color: #666;
      width: 45%;
    }
    
    .invoice-reference td:last-child {
      text-align: right;
      font-weight: 600;
    }
    
    /* Amount Overview */
    .amount-overview {
      margin-bottom: 5mm;
    }
    
    .amount-row {
      display: flex;
      justify-content: space-between;
      padding: 2.5mm 0;
      font-size: 10pt;
      border-bottom: 0.5pt solid #f0f0f0;
    }
    
    .amount-row.overdue {
      color: ${levelColor};
      font-weight: 600;
    }
    
    .amount-row.fee {
      color: #666;
      font-size: 9pt;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 3.5mm 5mm;
      background: ${levelColor};
      color: #fff;
      font-weight: 600;
      font-size: 12pt;
      margin-top: 3mm;
      border-radius: 2mm;
    }
    
    
    /* Footer */
    .footer {
      position: absolute;
      bottom: 12mm;
      left: 20mm;
      right: 20mm;
      font-size: 7.5pt;
      line-height: 1.6;
      color: #666;
      border-top: 0.5pt solid #e0e0e0;
      padding-top: 3mm;
    }
    
    .footer-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1.5mm;
    }
    
    /* QR Payment Section (Page 2) */
    .qr-payment-section {
      page-break-before: always;
      width: 210mm;
      min-height: 297mm;
      position: relative;
      padding: 0;
      margin: 0;
    }
    
    .qr-bill-container {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
    }
    
    .qr-bill-title {
      text-align: center;
      font-weight: 600;
      font-size: 11pt;
      padding: 5mm 0;
    }
    
    .qr-bill {
      display: flex;
      height: 105mm;
      border: 1pt solid #000;
    }
    
    .qr-receipt {
      width: 62mm;
      padding: 5mm;
      border-right: 1pt dashed #000;
      position: relative;
      font-size: 8pt;
    }
    
    .qr-section-title {
      font-weight: 600;
      font-size: 11pt;
      margin-bottom: 5mm;
    }
    
    .qr-label {
      font-weight: 600;
      font-size: 6pt;
      margin-top: 3mm;
      margin-bottom: 1mm;
      text-transform: uppercase;
    }
    
    .qr-value {
      font-size: 8pt;
      line-height: 1.3;
    }
    
    .qr-amount {
      position: absolute;
      bottom: 10mm;
      left: 5mm;
      display: flex;
      gap: 8mm;
    }
    
    .qr-acceptance {
      position: absolute;
      bottom: 3mm;
      right: 5mm;
      font-size: 6pt;
      color: #666;
    }
    
    .qr-payment {
      flex: 1;
      padding: 5mm;
      position: relative;
      font-size: 8pt;
    }
    
    .qr-layout {
      display: flex;
      gap: 8mm;
      margin-top: 5mm;
    }
    
    .qr-left {
      width: 60mm;
      text-align: center;
    }
    
    .qr-code-container {
      width: 46mm;
      height: 46mm;
      margin: 0 auto 5mm;
      position: relative;
    }
    
    .qr-code-container img {
      width: 100%;
      height: 100%;
    }
    
    .swiss-cross {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 7mm;
      height: 7mm;
    }
    
    .swiss-cross img {
      width: 100%;
      height: 100%;
    }
    
    .qr-amount-below {
      display: flex;
      gap: 10mm;
      justify-content: center;
    }
    
    .qr-right {
      flex: 1;
    }
    
    .scissors-line {
      text-align: center;
      font-size: 8pt;
      padding: 2mm 0;
      border-top: 1pt dashed #000;
      color: #666;
    }
    
    @media print {
      .page { page-break-after: always; }
    }
  </style>
</head>
<body>
  <!-- Page 1: Reminder -->
  <div class="page">
    <div class="page-number">${pageLabel}</div>
    
    <div class="header">
      <div class="logo">
        ${logoBase64 ? `<img src="${logoBase64}" alt="${company.name}" />` : `<div style="font-size: 14pt; font-weight: 600; color: #1a1a1a;">${company.name}</div>`}
      </div>
      <div class="header-right">
        <div class="company-line">${company.name}, ${company.address}, ${company.zip} ${company.city}</div>
        <h1>${config.title}</h1>
      </div>
    </div>
    
    <div class="urgency-banner">
      ${config.urgencyText} - ${daysOverdue} ${daysOverdue === 1 ? common.daySingular : common.dayPlural} ${common.overdueSuffix}
    </div>
    
    <div class="address-boxes">
      <div class="customer-address">
        <div>${customer.name}</div>
        ${customer.company ? `<div>${customer.company}</div>` : ''}
        <div>${customer.address}</div>
        <div>${customer.zip} ${customer.city}</div>
        <div>${customer.country === 'CH' ? common.country : customer.country}</div>
      </div>
      
      <div class="company-info-box">
        <div>${company.name}</div>
        <div>${company.address}</div>
        <div>${company.zip} ${company.city}</div>
        <div style="margin-top: 2mm;">${common.phoneLabel}: ${company.phone || 'N/A'}</div>
        <div>${common.emailLabel}: ${company.email}</div>
        ${company.website ? `<div>${common.webLabel}: ${company.website}</div>` : ''}
        ${company.vat_number ? `<div style="margin-top: 2mm; font-weight: 600;">${formatSwissMwst(company.vat_number) || `UID: ${company.uid || ''}`}</div>` : (company.uid ? `<div style="margin-top: 2mm;">UID: ${company.uid}</div>` : '')}
      </div>
    </div>
    
    <div class="reminder-message">
      <p><strong>${reminderTexts.greeting}</strong></p>
      <p>${config.message}</p>
      <p>${config.closing}</p>
      ${config.additionalCosts ? `<p>${config.additionalCosts}</p>` : ''}
      ${config.proofRequired ? `<p>${config.proofRequired}</p>` : ''}
      <p style="margin-top: 5mm;"><strong>${reminderTexts.newDeadlineLabel}: ${formatDate(newDueDate)}</strong></p>
    </div>
    
    <div class="invoice-reference">
      <h3 style="margin-bottom: 3mm; font-size: 10.5pt;">${reminderTexts.originalInvoiceTitle}</h3>
      <table>
        <tr><td>${reminderTexts.originalInvoiceNumber}</td><td>${invoice.number}</td></tr>
        <tr><td>${reminderTexts.originalInvoiceDate}</td><td>${formatDate(invoice.date)}</td></tr>
        <tr><td>${reminderTexts.dueSinceLabel}</td><td>${formatDate(invoice.due_date)}</td></tr>
        <tr><td>${reminderTexts.daysOverdueLabel}</td><td style="color: ${levelColor};">${daysOverdue}</td></tr>
      </table>
    </div>
    
    <div class="amount-overview">
      <h3 style="margin-bottom: 3mm; font-size: 10.5pt;">${reminderTexts.amountOverviewTitle}</h3>
      
      <div class="amount-row">
        <div>${reminderTexts.originalAmountLabel}</div>
        <div>CHF ${formatCurrency(invoice.total)}</div>
      </div>
      
      ${invoice.paid_amount > 0 ? `
      <div class="amount-row">
        <div>${reminderTexts.alreadyPaidLabel}</div>
        <div>- CHF ${formatCurrency(invoice.paid_amount)}</div>
      </div>
      <div class="amount-row overdue">
        <div>${reminderTexts.outstandingAmountLabel}</div>
        <div>CHF ${formatCurrency(remainingAmount)}</div>
      </div>
      ` : `
      <div class="amount-row overdue">
        <div>${reminderTexts.outstandingAmountLabel}</div>
        <div>CHF ${formatCurrency(remainingAmount)}</div>
      </div>
      `}
      
      ${reminderFee > 0 ? `
      <div class="amount-row fee">
        <div>${reminderTexts.reminderFeeLabel} (${config.title})</div>
        <div>CHF ${reminderFee.toFixed(2)}</div>
      </div>
      ` : ''}
      
      <div class="total-row">
        <div>${reminderTexts.totalDuePrefix} ${formatDate(newDueDate)}</div>
        <div>CHF ${(totalWithFee / 100).toFixed(2)}</div>
      </div>
    </div>
  </div>
  
  <!-- Page 2: QR Payment -->
  <div class="qr-payment-section">
    <div class="qr-bill-container">
      <div class="qr-bill-title">Zahlteil / Section paiement / Sezione pagamento</div>
      
      <div class="qr-bill">
        <!-- Empfangsschein (Receipt - Left) -->
        <div class="qr-receipt">
          <div class="qr-section-title">${invoiceTexts.qrReceiptTitle}</div>
          
          <div class="qr-label">${invoiceTexts.qrAccountLabelReceipt}</div>
          <div class="qr-value">
            ${formattedIBAN}<br>
            ${company.name}<br>
            ${company.address}<br>
            ${company.zip} ${company.city}
          </div>
          
          <div class="qr-label">${invoiceTexts.qrReferenceLabel}</div>
          <div class="qr-value">${formattedReference}</div>
          
          <div class="qr-label">${invoiceTexts.qrPayableByLabel}</div>
          <div class="qr-value">
            ${customer.name}<br>
            ${customer.address}<br>
            ${customer.zip} ${customer.city}
          </div>
          
          <div class="qr-amount">
            <div>
              <div class="qr-label">${invoiceTexts.qrCurrencyLabel}</div>
              <div class="qr-value">CHF</div>
            </div>
            <div>
              <div class="qr-label">${invoiceTexts.qrAmountLabel}</div>
              <div class="qr-value" style="font-weight: 600;">${(totalWithFee / 100).toFixed(2)}</div>
            </div>
          </div>
          
          <div class="qr-acceptance">${common.acceptancePoint}</div>
        </div>
        
        <!-- Zahlteil (Payment - Right) -->
        <div class="qr-payment">
          <div class="qr-section-title">${invoiceTexts.qrPaymentTitle}</div>
          
          <div class="qr-layout">
            <!-- Left: QR Code + Amount below -->
            <div class="qr-left">
              <div class="qr-code-container">
                <img src="${qrCodeImage}" alt="QR Code" />
                <div class="swiss-cross">
                  <img src="${SWISS_CROSS_BASE64}" alt="Swiss Cross" />
                </div>
              </div>
              
              <div class="qr-amount-below">
                <div>
                  <div class="qr-label">${invoiceTexts.qrCurrencyLabel}</div>
                  <div class="qr-value">CHF</div>
                </div>
                <div>
                  <div class="qr-label">${invoiceTexts.qrAmountLabel}</div>
                  <div class="qr-value" style="font-weight: 600; font-size: 11pt;">${(totalWithFee / 100).toFixed(2)}</div>
                </div>
              </div>
            </div>
            
            <!-- Right: Account & Payment Details -->
            <div class="qr-right">
              <div class="qr-label">${invoiceTexts.qrAccountLabelPayment}</div>
              <div class="qr-value">
                ${formattedIBAN}<br>
                ${company.name}<br>
                ${company.address}<br>
                ${company.zip} ${company.city}
              </div>
              
              <div class="qr-label">${invoiceTexts.qrReferenceLabel}</div>
              <div class="qr-value">${paymentReference}</div>
              
              <div class="qr-label">${invoiceTexts.qrAdditionalInfoLabel}</div>
              <div class="qr-value">${config.title} – ${invoiceTexts.title} ${invoice.number}</div>
              
              <div class="qr-label">${invoiceTexts.qrPayableByLabel}</div>
              <div class="qr-value">
                ${customer.name}<br>
                ${customer.address}<br>
                ${customer.zip} ${customer.city}
              </div>
            </div>
          </div>
          
          <div class="qr-acceptance">${common.acceptancePoint}</div>
        </div>
      </div>
      
      <div class="scissors-line">${common.qrScissors}</div>
    </div>
  </div>
</body>
</html>
  `
}

// ==================== QUOTE PDF TEMPLATE ====================

export interface QuotePdfData {
  quote: {
    number: string
    date: string | Date
    expiryDate: string | Date
    subtotal: number
    vatAmount: number
    total: number
    acceptanceLink?: string | null
    items?: Array<{
      description: string
      quantity: number
      unit: string
      unitPrice: number
      vatRate: number
      lineTotal: number
    }>
  }
  customer: {
    name: string
    company?: string | null
    address: string
    zip: string
    city: string
    country: string
    email?: string | null
    phone?: string | null
  }
  company: {
    name: string
    address: string
    zip: string
    city: string
    email: string
    phone?: string | null
    website?: string | null
    uid?: string | null
    vatNumber?: string | null
  }
  logoBase64?: string | null
  acceptanceQRCode?: string | null
  language?: SupportedLanguage | null
}

export const generateQuotePdfTemplate = (data: QuotePdfData): string => {
  const { quote, customer, company, logoBase64, acceptanceQRCode } = data
  const { lang, t } = getPdfTranslation(data.language)
  const common = t.common
  const quoteTexts = t.quote
  
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(t.locale)
  }
  
  const formatCurrency = (amount: number) => {
    return (amount / 100).toFixed(2)
  }
  
  const formattedMwst = formatSwissMwst(company.vatNumber)
  const validityText = quoteTexts.validityText.replace('{{DATE}}', `<strong>${formatDate(quote.expiryDate)}</strong>`)
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${quoteTexts.pageTitlePrefix} ${quote.number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      color: #1a1a1a;
      line-height: 1.5;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm 20mm;
      position: relative;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15mm;
    }
    
    .logo {
      width: 80mm;
      height: 20mm;
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }
    
    .logo img {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      object-fit: contain;
      object-position: left center;
    }
    
    .header-right {
      text-align: right;
      font-size: 8.5pt;
      color: #666;
    }
    
    .header-right .company-line {
      margin-bottom: 3mm;
    }
    
    .header-right h1 {
      font-size: 18pt;
      font-weight: 600;
      margin-top: 2mm;
      color: #ff6b35;
    }
    
    /* Address Boxes */
    .address-boxes {
      display: flex;
      gap: 8mm;
      margin-bottom: 10mm;
    }
    
    .customer-address {
      flex: 1;
      padding: 4mm;
      background: #f5f5f5;
      border-left: 3pt solid #ff6b35;
      font-size: 9.5pt;
      line-height: 1.6;
    }
    
    .customer-address div:first-child {
      font-weight: 600;
      color: #ff6b35;
      margin-bottom: 1mm;
    }
    
    .company-info-box {
      flex: 1;
      padding: 4mm;
      background: #f5f5f5;
      border-left: 3pt solid #333;
      font-size: 9pt;
      line-height: 1.6;
    }
    
    .company-info-box div:first-child {
      font-weight: 600;
      color: #333;
      margin-bottom: 1mm;
    }
    
    .company-info-box .info-line {
      margin-top: 2mm;
      font-size: 8.5pt;
    }
    
    /* Quote Info Table */
    .quote-meta {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 12mm;
    }
    
    .quote-meta table {
      font-size: 9pt;
      border-collapse: collapse;
    }
    
    .quote-meta td {
      padding: 2mm 3mm;
      border-bottom: 0.5pt solid #e8e8e8;
    }
    
    .quote-meta td:first-child {
      color: #666;
      text-align: right;
      padding-right: 5mm;
    }
    
    .quote-meta td:last-child {
      font-weight: 600;
    }
    
    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8mm;
      font-size: 9.5pt;
    }
    
    .items-table thead tr {
      background: #f8f9fa;
      border-bottom: 1.5pt solid #333;
    }
    
    .items-table th {
      padding: 3mm 2mm;
      text-align: left;
      font-weight: 600;
      font-size: 9pt;
      text-transform: uppercase;
      color: #333;
    }
    
    .items-table th:last-child,
    .items-table td:last-child {
      text-align: right;
    }
    
    .items-table tbody tr {
      border-bottom: 0.5pt solid #e8e8e8;
    }
    
    .items-table td {
      padding: 3mm 2mm;
      vertical-align: top;
    }
    
    .description {
      font-weight: 500;
    }
    
    /* Totals */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 12mm;
    }
    
    .totals {
      min-width: 70mm;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 2.5mm 0;
      font-size: 9.5pt;
      border-bottom: 0.5pt solid #e8e8e8;
    }
    
    .total-row:last-child {
      border-bottom: none;
    }
    
    .grand-total {
      display: flex;
      justify-content: space-between;
      padding: 3.5mm 5mm;
      background: #ff6b35;
      color: #fff;
      font-weight: 600;
      font-size: 12pt;
      margin-top: 3mm;
      border-radius: 2mm;
    }
    
    /* Acceptance Section - Separate Page */
    .acceptance-page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm 20mm;
      position: relative;
      page-break-before: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    
    .acceptance-section {
      max-width: 170mm;
      padding: 10mm;
      background: #fff8f0;
      border: 2pt solid #ff6b35;
      border-radius: 3mm;
      text-align: center;
    }
    
    .acceptance-section h3 {
      color: #ff6b35;
      margin-bottom: 5mm;
      font-size: 16pt;
      font-weight: 600;
    }
    
    .acceptance-content {
      display: flex;
      flex-direction: column;
      gap: 8mm;
      align-items: center;
    }
    
    .acceptance-text {
      font-size: 10pt;
      line-height: 1.8;
    }
    
    .acceptance-text p {
      margin-bottom: 3mm;
    }
    
    .acceptance-qr {
      text-align: center;
    }
    
    .acceptance-qr img {
      width: 60mm;
      height: 60mm;
      border: 1pt solid #ddd;
      border-radius: 2mm;
    }
    
    .acceptance-qr p {
      font-size: 9pt;
      color: #666;
      margin-top: 3mm;
      font-weight: 600;
    }
    
    /* Footer */
    .footer {
      position: absolute;
      bottom: 12mm;
      left: 20mm;
      right: 20mm;
      font-size: 7.5pt;
      line-height: 1.6;
      color: #666;
      border-top: 0.5pt solid #e0e0e0;
      padding-top: 3mm;
    }
    
    .footer-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1.5mm;
    }
    
    @media print {
      .page { page-break-after: always; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo">
        ${logoBase64 ? `<img src="${logoBase64}" alt="${company.name}" />` : `<div style="font-size: 14pt; font-weight: 600; color: #1a1a1a;">${company.name}</div>`}
      </div>
      <div class="header-right">
        <div class="company-line">${company.name}, ${company.address}, ${company.zip} ${company.city}</div>
        <h1>${quoteTexts.title}</h1>
      </div>
    </div>
    
    <div class="address-boxes">
      <div class="customer-address">
        <div>${customer.name}</div>
        ${customer.company ? `<div>${customer.company}</div>` : ''}
        <div>${customer.address}</div>
        <div>${customer.zip} ${customer.city}</div>
        <div>${customer.country === 'CH' ? common.country : customer.country}</div>
      </div>
      
      <div class="company-info-box">
        <div>${company.name}</div>
        <div class="info-line">${company.address}</div>
        <div class="info-line">${company.zip} ${company.city}</div>
        <div class="info-line" style="margin-top: 3mm;">${common.phoneLabel}: ${company.phone || 'N/A'}</div>
        <div class="info-line">${common.emailLabel}: ${company.email}</div>
        ${company.website ? `<div class="info-line">${common.webLabel}: ${company.website}</div>` : ''}
        ${formattedMwst ? `<div class="info-line" style="margin-top: 3mm; font-weight: 600;">${formattedMwst}</div>` : (company.uid ? `<div class="info-line" style="margin-top: 3mm;">UID: ${company.uid}</div>` : '')}
      </div>
    </div>
    
    <div class="quote-meta">
      <table>
        <tr><td>${quoteTexts.metaNumber}</td><td>${quote.number}</td></tr>
        <tr><td>${quoteTexts.metaDate}</td><td>${formatDate(quote.date)}</td></tr>
        <tr><td>${quoteTexts.metaValidUntil}</td><td>${formatDate(quote.expiryDate)}</td></tr>
      </table>
    </div>
    
    <p style="font-size: 10pt; margin-bottom: 8mm;">${quoteTexts.intro}</p>
    
    <table class="items-table">
      <thead>
        <tr>
          <th>${quoteTexts.tableDescription}</th>
          <th style="text-align: center; width: 15mm;">${quoteTexts.tableQuantity}</th>
          <th style="text-align: right; width: 20mm;">${quoteTexts.tableUnit}</th>
          <th style="text-align: right; width: 25mm;">${quoteTexts.tablePrice}</th>
          <th style="text-align: right; width: 15mm;">${quoteTexts.tableVat}</th>
          <th style="text-align: right; width: 25mm;">${quoteTexts.tableTotal}</th>
        </tr>
      </thead>
      <tbody>
        ${quote.items?.map(item => `
        <tr>
          <td class="description">${item.description}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">${item.unit}</td>
          <td style="text-align: right;">CHF ${formatCurrency(item.unitPrice)}</td>
          <td style="text-align: right;">${item.vatRate}%</td>
          <td style="text-align: right;">CHF ${formatCurrency(item.lineTotal)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="totals-section">
      <div class="totals">
        <div class="total-row">
          <div>${quoteTexts.subtotalLabel}</div>
          <div>CHF ${formatCurrency(quote.subtotal)}</div>
        </div>
        <div class="total-row">
          <div>${quoteTexts.vatLabel}</div>
          <div>CHF ${formatCurrency(quote.vatAmount)}</div>
        </div>
        <div class="grand-total">
          <div>${quoteTexts.grandTotalLabel}</div>
          <div>CHF ${formatCurrency(quote.total)}</div>
        </div>
      </div>
    </div>
    
    <p style="margin-top: 8mm; font-size: 9.5pt;">${common.questionsText}</p>
  </div>
  
  ${acceptanceQRCode && quote.acceptanceLink ? `
  <!-- Acceptance Page -->
  <div class="acceptance-page">
    <div class="acceptance-section">
      <h3>${quoteTexts.acceptanceTitle}</h3>
      <div class="acceptance-content">
        <div class="acceptance-text">
          <p>${validityText}</p>
          <p>${quoteTexts.acceptanceInstructions}</p>
          <p style="font-size: 8.5pt; color: #666;">${quoteTexts.acceptanceNote}</p>
        </div>
        <div class="acceptance-qr">
          <img src="${acceptanceQRCode}" alt="QR Code" />
          <p>${common.qrScanCaption}</p>
        </div>
      </div>
    </div>
  </div>
  ` : ''}
</body>
</html>
  `
}
