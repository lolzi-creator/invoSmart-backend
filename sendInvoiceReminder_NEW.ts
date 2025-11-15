/**
 * @desc    Send reminder for invoice
 * @route   POST /api/v1/invoices/:id/reminder
 * @access  Private
 */
export const sendInvoiceReminder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId
  const invoiceId = req.params.id
  const { level } = req.body

  console.log('📧 Reminder request:', { companyId, invoiceId, level })

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  try {
    // Get invoice with customer and company data
    console.log('🔍 Looking up invoice:', { invoiceId, companyId })
    const { data: invoice, error: invoiceError } = await db.invoices()
      .select(`
        *,
        customers (
          id, name, company, email, address, zip, city, country, phone
        )
      `)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()
    
    // Get company data for PDF
    const { data: company, error: companyError } = await db.companies()
      .select('*')
      .eq('id', companyId)
      .single()
    
    if (companyError || !company) {
      res.status(404).json({
        success: false,
        error: 'Company not found'
      })
      return
    }

    console.log('📋 Invoice lookup result:', { invoice, error: invoiceError })

    if (invoiceError || !invoice) {
      console.log('❌ Invoice not found:', invoiceError)
      res.status(404).json({
        success: false,
        error: 'Invoice not found'
      })
      return
    }

    // Check if invoice is eligible for reminders
    console.log('📊 Invoice status:', invoice.status)
    if (invoice.status === 'CANCELLED') {
      console.log('❌ Invoice is cancelled, cannot send reminder')
      res.status(400).json({
        success: false,
        error: 'Cannot send reminder for cancelled invoice'
      })
      return
    }
    
    // Check if invoice is fully paid
    const totalAmount = invoice.total
    const paidAmount = invoice.paid_amount || 0
    const isFullyPaid = paidAmount >= totalAmount
    
    if (isFullyPaid) {
      console.log('❌ Invoice is fully paid, cannot send reminder')
      res.status(400).json({
        success: false,
        error: 'Cannot send reminder for fully paid invoice'
      })
      return
    }
    
    // Check if 1 day has passed since due date
    const dueDate = new Date(invoice.due_date)
    dueDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysSinceDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSinceDue < 1) {
      if (daysSinceDue < 0) {
        const daysUntilDue = Math.abs(daysSinceDue)
        console.log(`❌ Due date hasn't passed yet. ${daysUntilDue} days until due date.`)
        res.status(400).json({
          success: false,
          error: `Reminder can only be sent after the due date has passed. Due date is in ${daysUntilDue + 1} ${daysUntilDue === 0 ? 'day' : 'days'}.`
        })
      } else {
        console.log(`❌ Due date is today. Reminder can be sent tomorrow.`)
        res.status(400).json({
          success: false,
          error: `Reminder can be sent starting 1 day after the due date. Please try again tomorrow.`
        })
      }
      return
    }
    
    console.log(`✅ Invoice eligible for reminder: ${daysSinceDue} days overdue, CHF ${((totalAmount - paidAmount) / 100).toFixed(2)} remaining`)

    // Check if reminder level is valid
    if (level < 1 || level > 3) {
      res.status(400).json({
        success: false,
        error: 'Invalid reminder level (must be 1-3)'
      })
      return
    }
    
    console.log(`Sending reminder level ${level} for invoice ${invoice.number}`)

    // Generate professional reminder PDF using new template
    let pdfFilePath: string | null = null
    let pdfBuffer: Buffer | null = null
    try {
      console.log(`🎨 Generating professional reminder PDF (Level ${level}) for invoice: ${invoice.number}`)
      
      // Fetch and convert logo to base64 if available
      let logoBase64 = null
      if (company.logo_url) {
        try {
          let logoPath = null
          if (company.logo_url.includes('/storage/v1/object/public/logos/')) {
            logoPath = company.logo_url.split('/storage/v1/object/public/logos/')[1].split('?')[0]
          } else if (company.logo_url.includes('/logos/')) {
            logoPath = company.logo_url.split('/logos/')[1].split('?')[0]
          } else if (company.logo_url.startsWith('logos/')) {
            logoPath = company.logo_url.replace('logos/', '').split('?')[0]
          } else {
            logoPath = company.logo_url.split('?')[0]
          }
          
          if (logoPath) {
            const { data: logoData, error: logoError } = await supabaseAdmin.storage
              .from('logos')
              .download(logoPath)
            
            if (logoError) {
              console.error('❌ Error downloading logo for reminder:', logoError)
            } else if (logoData) {
              const logoBuffer = Buffer.from(await logoData.arrayBuffer())
              const logoMimeType = logoData.type || 'image/png'
              logoBase64 = `data:${logoMimeType};base64,${logoBuffer.toString('base64')}`
              console.log('✅ Logo converted to base64 for reminder')
            }
          }
        } catch (logoFetchError) {
          console.error('❌ Error fetching logo for reminder:', logoFetchError)
        }
      }
      
      // Calculate reminder fees and days overdue
      const reminderFees = { 1: 0, 2: 20.00, 3: 50.00 }
      const reminderFee = reminderFees[level as keyof typeof reminderFees]
      const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
      
      // Determine reference type and IBAN based on invoice reference
      const { referenceType, iban } = getReferenceTypeAndIban(invoice.qr_reference, company)
      
      // Calculate total amount with fee
      const remainingAmount = invoice.total - (invoice.paid_amount || 0)
      const totalWithFee = remainingAmount + (reminderFee * 100) // Fee in Rappen
      
      // Generate QR code for payment
      const QRCode = require('qrcode')
      const qrPayload = [
        'SPC',
        '0200',
        '1',
        iban || '',
        'K',
        company.name || '',
        company.address || '',
        company.zip || '',
        company.city || '',
        company.country || 'CH',
        '', '', '', '', '', '', '',
        (totalWithFee / 100).toFixed(2),
        'CHF',
        'K',
        invoice.customers.name || '',
        invoice.customers.address || '',
        invoice.customers.zip || '',
        invoice.customers.city || '',
        invoice.customers.country || 'CH',
        '', '', '', '', '', '', '',
        referenceType,
        invoice.qr_reference || '',
        `Mahnung ${level} - Rechnung ${invoice.number}`,
        'EPD'
      ].join('\r\n')
      
      const qrCodeImage = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1
      })
      
      // Generate HTML using professional template
      const htmlTemplate = generateReminderPdfTemplate({
        invoice: {
          number: invoice.number,
          date: invoice.date,
          due_date: invoice.due_date,
          service_date: invoice.service_date,
          qr_reference: invoice.qr_reference,
          subtotal: invoice.subtotal,
          vat_amount: invoice.vat_amount,
          total: invoice.total,
          paid_amount: invoice.paid_amount || 0
        },
        customer: {
          name: invoice.customers.name,
          company: invoice.customers.company,
          address: invoice.customers.address,
          zip: invoice.customers.zip,
          city: invoice.customers.city,
          country: invoice.customers.country,
          email: invoice.customers.email,
          phone: invoice.customers.phone
        },
        company: {
          name: company.name,
          address: company.address,
          zip: company.zip,
          city: company.city,
          email: company.email,
          phone: company.phone,
          uid: company.uid,
          vat_number: company.vat_number,
          iban: company.iban,
          qr_iban: company.qr_iban,
          website: company.website
        },
        qrCodeImage,
        logoBase64,
        paymentReference: invoice.qr_reference,
        referenceType: referenceType as 'QRR' | 'SCOR',
        iban: iban || company.iban || '',
        reminderLevel: level as 1 | 2 | 3,
        reminderFee,
        daysOverdue
      })
      
      // Generate PDF
      const htmlPdf = require('html-pdf-node')
      const options = {
        format: 'A4',
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
        printBackground: true,
        displayHeaderFooter: false,
        timeout: 30000,
        preferCSSPageSize: true,
        emulateMedia: 'print',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--run-all-compositor-stages-before-draw'
        ]
      }
      
      const file = { content: htmlTemplate }
      console.log(`📄 Generating PDF for reminder level ${level}...`)
      pdfBuffer = await htmlPdf.generatePdf(file, options)
      console.log(`✅ PDF generated: ${pdfBuffer.length} bytes`)
      
      // Save PDF to storage
      const sanitizeForPath = (name: string) => {
        return name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
      }
      
      const companyName = sanitizeForPath(company.name || 'Company')
      const customerName = sanitizeForPath(invoice.customers.name || 'Customer')
      const invoiceNumber = sanitizeForPath(invoice.number)
      
      const fileName = `Reminder-${level}-${invoice.number}.pdf`
      const filePath = `${companyName}/${customerName}/${invoiceNumber}/${fileName}`
      
      if (pdfBuffer) {
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('invoices')
          .upload(filePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true
          })

        if (uploadError) {
          console.error('❌ Error uploading reminder PDF to storage:', uploadError)
        } else {
          console.log('✅ Reminder PDF uploaded successfully:', filePath)
          pdfFilePath = filePath

          // Update invoice internal_notes with file reference
          const existingNotes = invoice.internal_notes ? JSON.parse(invoice.internal_notes) : {}
          const updatedNotes = {
            ...existingNotes,
            files: {
              ...(existingNotes.files || {}),
              [`reminder_${level}`]: filePath
            }
          }

          await db.invoices()
            .update({ internal_notes: JSON.stringify(updatedNotes) })
            .eq('id', invoiceId)
        }
      }
    } catch (pdfError: any) {
      console.error('❌ Error generating reminder PDF:', pdfError)
    }

    // Update invoice reminder level and timestamp
    const { data: updatedInvoice, error: updateError } = await db.invoices()
      .update({
        reminder_level: level,
        last_reminder_at: new Date().toISOString()
      })
      .eq('id', invoiceId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating invoice:', updateError)
      res.status(500).json({
        success: false,
        error: 'Failed to update invoice reminder level'
      })
      return
    }

    console.log('✅ Invoice updated with reminder level:', level)

    // Send reminder email
    try {
      console.log('📧 Sending reminder email to:', invoice.customers.email)
      
      await EmailService.sendInvoiceReminder({
        invoice: {
          id: invoice.id,
          number: invoice.number,
          total: invoice.total,
          dueDate: new Date(invoice.due_date),
          qrReference: invoice.qr_reference,
          pdfPath: pdfFilePath
        },
        customer: {
          email: invoice.customers.email,
          name: invoice.customers.name
        },
        company: {
          name: company.name,
          email: company.email
        },
        reminderLevel: level,
        testMode: true
      })

      console.log('✅ Reminder email sent successfully')
      
      res.status(200).json({
        success: true,
        data: {
          invoice: updatedInvoice,
          reminderLevel: level,
          emailSent: true
        }
      })
    } catch (emailError: any) {
      console.error('❌ Error sending reminder email:', emailError)
      res.status(500).json({
        success: false,
        error: 'Reminder level updated but failed to send email: ' + emailError.message
      })
    }

  } catch (error) {
    handleSupabaseError(error, 'send reminder')
  }
})

