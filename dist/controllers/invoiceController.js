"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInvoice = exports.updateInvoice = exports.generateReminderPdf = exports.sendInvoiceReminder = exports.generateInvoicePdf = exports.generateInvoiceQR = exports.getInvoiceStats = exports.updateInvoiceStatus = exports.createInvoice = exports.getInvoice = exports.getInvoices = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const config_1 = require("../config");
const supabase_1 = require("../lib/supabase");
const createInvoiceResponse = (dbInvoice, customer, company, items) => {
    return {
        id: dbInvoice.id,
        number: dbInvoice.number,
        customerId: dbInvoice.customer_id,
        customer: customer ? {
            id: customer.id,
            companyId: customer.company_id,
            customerNumber: customer.customer_number,
            name: customer.name,
            company: customer.company || undefined,
            email: customer.email || undefined,
            address: customer.address,
            zip: customer.zip,
            city: customer.city,
            country: customer.country,
            phone: customer.phone || undefined,
            vatNumber: customer.vat_number || undefined,
            paymentTerms: customer.payment_terms,
            creditLimit: customer.credit_limit || undefined,
            isActive: customer.is_active,
            notes: customer.notes || undefined,
            language: customer.language,
            createdAt: new Date(customer.created_at),
            updatedAt: new Date(customer.updated_at)
        } : undefined,
        companyId: dbInvoice.company_id,
        company: company ? {
            id: company.id,
            name: company.name,
            address: company.address,
            zip: company.zip,
            city: company.city,
            country: company.country,
            phone: company.phone || undefined,
            email: company.email,
            website: company.website || undefined,
            uid: company.uid || undefined,
            vatNumber: company.vat_number || undefined,
            iban: company.iban || undefined,
            qrIban: company.qr_iban || undefined,
            logoUrl: company.logo_url || undefined,
            defaultPaymentTerms: company.default_payment_terms,
            defaultLanguage: company.default_language,
            createdAt: new Date(company.created_at),
            updatedAt: new Date(company.updated_at)
        } : undefined,
        date: new Date(dbInvoice.date),
        dueDate: new Date(dbInvoice.due_date),
        status: dbInvoice.status,
        subtotal: dbInvoice.subtotal / 100,
        vatAmount: dbInvoice.vat_amount / 100,
        total: dbInvoice.total / 100,
        paidAmount: dbInvoice.paid_amount / 100,
        qrReference: dbInvoice.qr_reference,
        reminderLevel: dbInvoice.reminder_level,
        lastReminderAt: dbInvoice.last_reminder_at ? new Date(dbInvoice.last_reminder_at) : undefined,
        sentAt: dbInvoice.sent_at ? new Date(dbInvoice.sent_at) : undefined,
        emailSentCount: dbInvoice.email_sent_count,
        discountCode: dbInvoice.discount_code || undefined,
        discountAmount: dbInvoice.discount_amount / 100,
        internalNotes: dbInvoice.internal_notes || undefined,
        items: items ? items.map(createInvoiceItemResponse) : [],
        payments: [],
        createdAt: new Date(dbInvoice.created_at),
        updatedAt: new Date(dbInvoice.updated_at)
    };
};
const createInvoiceItemResponse = (dbItem) => {
    return {
        id: dbItem.id,
        invoiceId: dbItem.invoice_id,
        description: dbItem.description,
        quantity: dbItem.quantity / 1000,
        unit: dbItem.unit,
        unitPrice: dbItem.unit_price / 100,
        discount: dbItem.discount / 100,
        vatRate: dbItem.vat_rate / 100,
        lineTotal: dbItem.line_total / 100,
        vatAmount: dbItem.vat_amount / 100,
        sortOrder: dbItem.sort_order
    };
};
exports.getInvoices = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const search = req.query.search || '';
    const status = req.query.status;
    const sortBy = req.query.sortBy || 'date';
    const sortOrder = req.query.sortOrder || 'desc';
    try {
        let query = supabase_1.db.invoices()
            .select(`
        *,
        customers (
          id, company_id, customer_number, name, company, email, 
          address, zip, city, country, phone, vat_number, 
          payment_terms, credit_limit, is_active, notes, language,
          created_at, updated_at
        )
      `, { count: 'exact' })
            .eq('company_id', companyId);
        if (status) {
            query = query.eq('status', status);
        }
        if (search) {
            console.log('[Invoice Search] Searching for:', search);
            query = query.or(`number.ilike.%${search}%,qr_reference.ilike.%${search}%,qr_reference.eq.${search}`);
            console.log('[Invoice Search] Query OR clause:', `number.ilike.%${search}%,qr_reference.ilike.%${search}%,qr_reference.eq.${search}`);
        }
        const ascending = sortOrder === 'asc';
        query = query.order(sortBy, { ascending });
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);
        const { data, error, count } = await query;
        if (error) {
            console.error('[Invoice Search] Query error:', error);
            (0, supabase_1.handleSupabaseError)(error, 'get invoices');
            return;
        }
        console.log('[Invoice Search] Found', data?.length || 0, 'invoices (from query)');
        if (search) {
            const { data: debugData } = await supabase_1.db.invoices()
                .select('id, number, qr_reference, company_id')
                .eq('company_id', companyId)
                .eq('qr_reference', search)
                .limit(5);
            console.log('[Invoice Search] Direct QR reference query (exact match):', debugData?.length || 0, 'invoices');
            if (debugData && debugData.length > 0) {
                console.log('[Invoice Search] Direct match invoices:', debugData);
            }
            if (data) {
                console.log('[Invoice Search] Invoices from search query with QR references:', data.map((inv) => ({
                    number: inv.number,
                    qr_reference: inv.qr_reference,
                    id: inv.id
                })));
            }
        }
        let invoices = data.map(invoice => createInvoiceResponse(invoice, invoice.customers, undefined, invoice.invoice_items));
        if (search && invoices.length === 0) {
            const allQuery = supabase_1.db.invoices()
                .select(`
          *,
          customers (
            id, company_id, customer_number, name, company, email, 
            address, zip, city, country, phone, vat_number, 
            payment_terms, credit_limit, is_active, notes, language,
            created_at, updated_at
          )
        `, { count: 'exact' })
                .eq('company_id', companyId);
            if (status) {
                allQuery.eq('status', status);
            }
            const { data: allInvoices } = await allQuery;
            if (allInvoices) {
                const searchLower = search.toLowerCase();
                invoices = allInvoices
                    .filter((inv) => inv.customers?.name?.toLowerCase().includes(searchLower) ||
                    inv.customers?.company?.toLowerCase().includes(searchLower))
                    .slice(0, limit)
                    .map((invoice) => createInvoiceResponse(invoice, invoice.customers, undefined, invoice.invoice_items));
            }
        }
        res.json({
            success: true,
            data: {
                invoices,
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    pages: Math.ceil((count || 0) / limit)
                }
            }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'get invoices');
    }
});
exports.getInvoice = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const invoiceId = req.params.id;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: invoiceData, error: invoiceError } = await supabase_1.db.invoices()
            .select(`
        *,
        customers (*),
        companies (*),
        invoice_items (*)
      `)
            .eq('id', invoiceId)
            .eq('company_id', companyId)
            .single();
        if (invoiceError || !invoiceData) {
            res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
            return;
        }
        const { data: paymentsData, error: paymentsError } = await supabase_1.db.payments()
            .select('*')
            .eq('invoice_id', invoiceId)
            .eq('company_id', companyId)
            .eq('is_matched', true)
            .order('value_date', { ascending: false });
        const invoice = createInvoiceResponse(invoiceData, invoiceData.customers, invoiceData.companies, invoiceData.invoice_items);
        if (!paymentsError && paymentsData) {
            invoice.payments = paymentsData.map((payment) => ({
                id: payment.id,
                invoiceId: payment.invoice_id || undefined,
                companyId: payment.company_id,
                amount: payment.amount,
                valueDate: new Date(payment.value_date),
                reference: payment.reference || undefined,
                description: payment.description || undefined,
                confidence: payment.confidence,
                isMatched: payment.is_matched,
                importBatch: payment.import_batch || undefined,
                createdAt: new Date(payment.created_at),
                updatedAt: new Date(payment.updated_at)
            }));
        }
        else {
            invoice.payments = [];
        }
        if (invoiceData.internal_notes) {
            try {
                const notesData = JSON.parse(invoiceData.internal_notes);
                if (notesData && Array.isArray(notesData.files)) {
                    const filesWithUrls = await Promise.all(notesData.files.map(async (file) => {
                        try {
                            const { data: signedUrlData } = await supabase_1.supabaseAdmin.storage
                                .from('invoices')
                                .createSignedUrl(file.filePath, 3600);
                            return {
                                ...file,
                                downloadUrl: signedUrlData?.signedUrl || null
                            };
                        }
                        catch (e) {
                            console.error('Error generating signed URL for file:', e);
                            return {
                                ...file,
                                downloadUrl: null
                            };
                        }
                    }));
                    invoice.files = filesWithUrls;
                }
            }
            catch (e) {
                ;
                invoice.files = [];
            }
        }
        else {
            ;
            invoice.files = [];
        }
        res.json({
            success: true,
            data: { invoice }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'get invoice');
    }
});
exports.createInvoice = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    const { customerId, date = new Date(), dueDate, items = [], notes, discountCode } = req.body;
    try {
        const { data: customer, error: customerError } = await supabase_1.db.customers()
            .select('*')
            .eq('id', customerId)
            .eq('company_id', companyId)
            .single();
        if (customerError || !customer) {
            res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
            return;
        }
        const invoiceNumber = await (0, supabase_1.generateInvoiceNumber)(companyId);
        const qrReference = await (0, supabase_1.generateQRReference)(invoiceNumber, companyId);
        let calculatedDueDate = dueDate;
        if (!calculatedDueDate) {
            const invoiceDate = new Date(date);
            calculatedDueDate = new Date(invoiceDate.getTime() + customer.payment_terms * 24 * 60 * 60 * 1000);
        }
        else if (typeof calculatedDueDate === 'string') {
            calculatedDueDate = new Date(calculatedDueDate);
        }
        let subtotal = 0;
        let vatTotal = 0;
        let discountAmount = 0;
        const processedItems = items.map((item, index) => {
            const lineTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
            const vatAmount = lineTotal * (item.vatRate || 0) / 100;
            subtotal += lineTotal;
            vatTotal += vatAmount;
            return {
                description: item.description,
                quantity: Math.round(item.quantity * 1000),
                unit: item.unit || 'Stk',
                unit_price: Math.round(item.unitPrice * 100),
                discount: Math.round((item.discount || 0) * 100),
                vat_rate: Math.round((item.vatRate || 0) * 100),
                line_total: Math.round(lineTotal * 100),
                vat_amount: Math.round(vatAmount * 100),
                sort_order: index + 1
            };
        });
        if (discountCode) {
            const { data: discount } = await supabase_1.db.discountCodes()
                .select('*')
                .eq('code', discountCode)
                .eq('company_id', companyId)
                .eq('is_active', true)
                .single();
            if (discount) {
                discountAmount = Math.round(subtotal * discount.percentage / 10000 * 100) / 100;
            }
        }
        const total = subtotal + vatTotal - discountAmount;
        const invoiceData = {
            company_id: companyId,
            customer_id: customerId,
            number: invoiceNumber,
            qr_reference: qrReference,
            status: 'DRAFT',
            date: typeof date === 'string' ? date : date.toISOString().split('T')[0],
            due_date: typeof calculatedDueDate === 'string' ? calculatedDueDate : calculatedDueDate.toISOString().split('T')[0],
            subtotal: Math.round(subtotal * 100),
            vat_amount: Math.round(vatTotal * 100),
            total: Math.round(total * 100),
            paid_amount: 0,
            reminder_level: 0,
            email_sent_count: 0,
            discount_code: discountCode || null,
            discount_amount: Math.round(discountAmount * 100)
        };
        const { data: newInvoice, error: invoiceCreateError } = await supabase_1.db.invoices()
            .insert(invoiceData)
            .select()
            .single();
        if (invoiceCreateError || !newInvoice) {
            (0, supabase_1.handleSupabaseError)(invoiceCreateError, 'create invoice');
            return;
        }
        if (processedItems.length > 0) {
            const itemsWithInvoiceId = processedItems.map((item) => ({
                ...item,
                invoice_id: newInvoice.id
            }));
            const { error: itemsError } = await supabase_1.db.invoiceItems()
                .insert(itemsWithInvoiceId);
            if (itemsError) {
                await supabase_1.db.invoices().delete().eq('id', newInvoice.id);
                (0, supabase_1.handleSupabaseError)(itemsError, 'create invoice items');
                return;
            }
        }
        const { data: completeInvoice, error: fetchError } = await supabase_1.db.invoices()
            .select(`
        *,
        customers (*),
        companies (*),
        invoice_items (*)
      `)
            .eq('id', newInvoice.id)
            .single();
        if (fetchError || !completeInvoice) {
            (0, supabase_1.handleSupabaseError)(fetchError, 'fetch complete invoice');
            return;
        }
        const invoice = createInvoiceResponse(completeInvoice, completeInvoice.customers, completeInvoice.companies, completeInvoice.invoice_items);
        try {
            console.log('📄 Generating PDF for new invoice:', invoice.number);
            const { Resend } = require('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);
            const { data: company, error: companyError } = await supabase_1.db.companies()
                .select('*')
                .eq('id', companyId)
                .single();
            if (companyError || !company) {
                console.error('❌ Company not found for PDF generation:', companyError);
            }
            else {
                let logoBase64 = null;
                if (company.logo_url) {
                    try {
                        console.log('🔍 Attempting to fetch logo for invoice creation PDF. Logo URL:', company.logo_url);
                        let logoPath = null;
                        if (company.logo_url.includes('/storage/v1/object/public/logos/')) {
                            logoPath = company.logo_url.split('/storage/v1/object/public/logos/')[1].split('?')[0];
                        }
                        else if (company.logo_url.includes('/logos/')) {
                            logoPath = company.logo_url.split('/logos/')[1].split('?')[0];
                        }
                        else if (company.logo_url.startsWith('logos/')) {
                            logoPath = company.logo_url.replace('logos/', '').split('?')[0];
                        }
                        else {
                            logoPath = company.logo_url.split('?')[0];
                        }
                        console.log('📂 Extracted logo path for invoice creation:', logoPath);
                        if (logoPath) {
                            const { data: logoData, error: logoError } = await supabase_1.supabaseAdmin.storage
                                .from('logos')
                                .download(logoPath);
                            if (logoError) {
                                console.error('❌ Error downloading logo for invoice creation:', logoError);
                            }
                            else if (logoData) {
                                const logoBuffer = Buffer.from(await logoData.arrayBuffer());
                                const logoMimeType = logoData.type || 'image/png';
                                logoBase64 = `data:${logoMimeType};base64,${logoBuffer.toString('base64')}`;
                                console.log('✅ Logo converted to base64 for invoice creation PDF');
                            }
                        }
                    }
                    catch (logoFetchError) {
                        console.error('❌ Error fetching logo for invoice creation PDF:', logoFetchError);
                    }
                }
                const QRCode = require('qrcode');
                const qrReference = invoice.qrReference;
                const qrPayload = [
                    'SPC', '0200', '1',
                    company.iban || 'CH2109000000100015000.6',
                    'S', company.name, company.address, '', company.zip, company.city, 'CH',
                    '', '', '', '', '', '', '',
                    (invoice.total / 100).toFixed(2), 'CHF',
                    'S', invoice.customer?.name || 'Customer',
                    invoice.customer?.address || 'Address', '',
                    invoice.customer?.zip || '0000',
                    invoice.customer?.city || 'City',
                    invoice.customer?.country || 'CH',
                    'QRR', qrReference, `Invoice ${invoice.number}`, 'EPD'
                ].join('\n');
                const qrCodeImage = await QRCode.toDataURL(qrPayload, {
                    type: 'image/png',
                    width: 140,
                    margin: 1,
                    color: { dark: '#000000', light: '#FFFFFF' }
                });
                const pdfContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Invoice ${invoice.number}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 12px; color: #333; }
              .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e5e5; }
              .company-info { flex: 1; }
              .logo { width: 100px; height: 100px; background: transparent; display: flex; align-items: center; justify-content: center; padding: 5px; }
              .invoice-title { font-size: 24px; font-weight: bold; color: #2563eb; margin: 20px 0; }
              .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
              .items-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
              .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              .items-table th { background-color: #f8f9fa; font-weight: bold; }
              .totals { margin-top: 20px; text-align: right; }
              .totals table { margin-left: auto; border-collapse: collapse; }
              .totals td { padding: 5px 15px; border-bottom: 1px solid #eee; }
              .totals .total-row { font-weight: bold; font-size: 14px; border-top: 2px solid #333; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="company-info">
                <h1>${company.name}</h1>
                <div>${company.address}</div>
                <div>${company.zip} ${company.city}</div>
                <div>Schweiz</div>
                <br>
                <div>E-Mail: ${company.email}</div>
                ${company.phone ? `<div>Tel: ${company.phone}</div>` : ''}
                ${company.uid ? `<div>UID: ${company.uid}</div>` : ''}
                ${company.vat_number ? `<div>MWST-Nr: ${company.vat_number}</div>` : ''}
                ${company.iban ? `<div>IBAN: ${company.iban}</div>` : ''}
              </div>
              <div class="logo">
                ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-width: 100px; max-height: 100px; width: 100px; height: 100px; object-fit: contain; display: block;">` : ''}
              </div>
            </div>

            <div class="invoice-title">Rechnung ${invoice.number}</div>

            <div class="invoice-details">
              <div>
                <h3>Rechnungsadresse:</h3>
                <div><strong>${invoice.customer?.name || 'Customer'}</strong></div>
                ${invoice.customer?.company ? `<div>${invoice.customer.company}</div>` : ''}
                <div>${invoice.customer?.address || 'Address'}</div>
                <div>${invoice.customer?.zip || '0000'} ${invoice.customer?.city || 'City'}</div>
                <div>${invoice.customer?.country || 'CH'}</div>
              </div>
              <div>
                <table>
                  <tr><td><strong>Rechnungsnummer:</strong></td><td>${invoice.number}</td></tr>
                  <tr><td><strong>Rechnungsdatum:</strong></td><td>${new Date(invoice.date).toLocaleDateString('de-CH')}</td></tr>
                  <tr><td><strong>Fälligkeitsdatum:</strong></td><td>${new Date(invoice.dueDate).toLocaleDateString('de-CH')}</td></tr>
                  <tr><td><strong>QR-Referenz:</strong></td><td>${invoice.qrReference}</td></tr>
                </table>
              </div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Beschreibung</th>
                  <th>Menge</th>
                  <th>Einheit</th>
                  <th>Preis (CHF)</th>
                  <th>Betrag (CHF)</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.items?.map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${item.description}</td>
                    <td>${item.quantity.toFixed(3)}</td>
                    <td>${item.unit}</td>
                    <td>${(item.unitPrice / 100).toFixed(2)}</td>
                    <td>${(item.lineTotal / 100).toFixed(2)}</td>
                  </tr>
                `).join('') || '<tr><td colspan="6">No items</td></tr>'}
              </tbody>
            </table>

            <div class="totals">
              <table>
                <tr><td>Zwischensumme:</td><td>CHF ${(invoice.subtotal / 100).toFixed(2)}</td></tr>
                <tr><td>MWST:</td><td>CHF ${(invoice.vatAmount / 100).toFixed(2)}</td></tr>
                <tr class="total-row"><td><strong>Total CHF:</strong></td><td><strong>${(invoice.total / 100).toFixed(2)}</strong></td></tr>
              </table>
            </div>

            <div style="margin-top: 40px; text-align: center;">
              <img src="${qrCodeImage}" alt="Swiss QR Code" style="width: 140px; height: 140px;" />
              <div style="margin-top: 10px; font-size: 10px;">Swiss QR Code</div>
            </div>
          </body>
          </html>
        `;
                const htmlPdf = require('html-pdf-node');
                const options = {
                    format: 'A4',
                    margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
                    printBackground: true,
                    displayHeaderFooter: false,
                    timeout: 10000
                };
                const file = { content: pdfContent };
                const pdfBuffer = await htmlPdf.generatePdf(file, options);
                const sanitizeForPath = (name) => {
                    return name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                };
                const companyName = sanitizeForPath(company.name || 'Company');
                const customerName = sanitizeForPath(invoice.customer?.name || 'Customer');
                const invoiceNumber = sanitizeForPath(invoice.number);
                const fileName = `Invoice-${invoice.number}.pdf`;
                const filePath = `${companyName}/${customerName}/${invoiceNumber}/${fileName}`;
                const { data: uploadData, error: uploadError } = await supabase_1.supabaseAdmin.storage
                    .from('invoices')
                    .upload(filePath, pdfBuffer, {
                    contentType: 'application/pdf',
                    upsert: false
                });
                if (uploadError) {
                    console.error('❌ Failed to upload PDF to storage:', uploadError);
                }
                else {
                    console.log('✅ PDF uploaded successfully:', uploadData.path);
                    const fileInfo = {
                        id: crypto.randomUUID(),
                        fileName: fileName,
                        filePath: uploadData.path,
                        fileType: 'invoice_pdf',
                        uploadedAt: new Date().toISOString()
                    };
                    const currentNotes = completeInvoice.internal_notes || '{}';
                    let notesData = {};
                    try {
                        if (currentNotes && currentNotes.trim() !== '' && currentNotes.trim().startsWith('{')) {
                            notesData = JSON.parse(currentNotes);
                        }
                    }
                    catch (e) {
                        notesData = {
                            _oldNotes: currentNotes,
                            files: []
                        };
                    }
                    if (!notesData.files) {
                        notesData.files = [];
                    }
                    notesData.files.push(fileInfo);
                    await supabase_1.db.invoices()
                        .update({
                        internal_notes: JSON.stringify(notesData)
                    })
                        .eq('id', newInvoice.id);
                    console.log('📄 PDF file record stored in invoice:', fileInfo);
                }
            }
        }
        catch (pdfError) {
            console.error('❌ Error generating PDF:', pdfError);
        }
        res.status(201).json({
            success: true,
            message: 'Invoice created successfully',
            data: { invoice }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'create invoice');
    }
});
exports.updateInvoiceStatus = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const invoiceId = req.params.id;
    const { status } = req.body;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const updateData = { status };
        if (status === 'OPEN') {
            updateData.sent_at = new Date().toISOString();
            updateData.email_sent_count = 1;
        }
        const { data, error } = await supabase_1.db.invoices()
            .update(updateData)
            .eq('id', invoiceId)
            .eq('company_id', companyId)
            .select()
            .single();
        if (error || !data) {
            res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
            return;
        }
        res.json({
            success: true,
            message: 'Invoice status updated successfully',
            data: { invoice: createInvoiceResponse(data) }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'update invoice status');
    }
});
exports.getInvoiceStats = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: invoices, error } = await supabase_1.db.invoices()
            .select('status, total, paid_amount, date')
            .eq('company_id', companyId);
        if (error) {
            (0, supabase_1.handleSupabaseError)(error, 'get invoice stats');
            return;
        }
        const totalInvoices = invoices?.length || 0;
        const totalRevenue = invoices?.reduce((sum, inv) => sum + inv.total, 0) || 0;
        const totalPaid = invoices?.reduce((sum, inv) => sum + inv.paid_amount, 0) || 0;
        const totalOutstanding = totalRevenue - totalPaid;
        const statusCounts = invoices?.reduce((acc, inv) => {
            acc[inv.status] = (acc[inv.status] || 0) + 1;
            return acc;
        }, {}) || {};
        const stats = {
            totalInvoices,
            totalRevenue,
            totalPaid,
            totalOutstanding,
            statusCounts,
            averageInvoiceValue: totalInvoices > 0 ? Math.round(totalRevenue / totalInvoices) : 0
        };
        res.json({
            success: true,
            data: { stats }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'get invoice stats');
    }
});
exports.generateInvoiceQR = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const invoiceId = req.params.id;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: invoice, error: invoiceError } = await supabase_1.db.invoices()
            .select(`
        *,
        customers (
          id, name, company, address, zip, city, country
        )
      `)
            .eq('id', invoiceId)
            .eq('company_id', companyId)
            .single();
        if (invoiceError || !invoice) {
            res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
            return;
        }
        const { data: company, error: companyError } = await supabase_1.db.companies()
            .select('*')
            .eq('id', companyId)
            .single();
        if (companyError || !company) {
            res.status(404).json({
                success: false,
                error: 'Company not found'
            });
            return;
        }
        const qrData = {
            qrType: 'SPC',
            version: '0200',
            codingType: '1',
            iban: company.iban || company.qr_iban || 'CH2109000000100015000.6',
            creditor: {
                addressType: 'S',
                name: company.name,
                street: company.address,
                houseNumber: '',
                postalCode: company.zip,
                town: company.city,
                country: company.country || 'CH'
            },
            amount: invoice.total.toFixed(2),
            currency: 'CHF',
            debtor: {
                addressType: 'S',
                name: invoice.customers.name,
                street: invoice.customers.address,
                houseNumber: '',
                postalCode: invoice.customers.zip,
                town: invoice.customers.city,
                country: invoice.customers.country || 'CH'
            },
            referenceType: 'QRR',
            reference: invoice.qr_reference,
            unstructuredMessage: `Invoice ${invoice.number}`,
            trailer: 'EPD',
            invoiceNumber: invoice.number,
            invoiceDate: invoice.date,
            dueDate: invoice.due_date,
            qrCodePayload: [
                'SPC',
                '0200',
                '1',
                company.iban || 'CH2109000000100015000.6',
                'S',
                company.name,
                company.address,
                '',
                company.zip,
                company.city,
                'CH',
                '', '', '', '', '', '', '',
                (invoice.total / 100).toFixed(2),
                'CHF',
                'S',
                invoice.customers.name,
                invoice.customers.address,
                '',
                invoice.customers.zip,
                invoice.customers.city,
                invoice.customers.country || 'CH',
                'QRR',
                invoice.qr_reference,
                `Invoice ${invoice.number}`,
                'EPD'
            ].join('\n')
        };
        res.json({
            success: true,
            data: qrData
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'generate QR code');
    }
});
exports.generateInvoicePdf = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const invoiceId = req.params.id;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: invoice, error: invoiceError } = await supabase_1.db.invoices()
            .select(`
        *,
        customers (
          id, name, company, address, zip, city, country, email, phone, uid, vat_number
        ),
        invoice_items (
          id, description, quantity, unit, unit_price, discount, vat_rate, line_total, vat_amount, sort_order
        )
      `)
            .eq('id', invoiceId)
            .eq('company_id', companyId)
            .single();
        if (invoiceError || !invoice) {
            res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
            return;
        }
        const { data: company, error: companyError } = await supabase_1.db.companies()
            .select('*')
            .eq('id', companyId)
            .single();
        if (companyError || !company) {
            res.status(404).json({
                success: false,
                error: 'Company not found'
            });
            return;
        }
        let logoBase64 = null;
        if (company.logo_url) {
            try {
                console.log('🔍 Attempting to fetch logo for PDF. Logo URL:', company.logo_url);
                let logoPath = null;
                if (company.logo_url.includes('/storage/v1/object/public/logos/')) {
                    logoPath = company.logo_url.split('/storage/v1/object/public/logos/')[1].split('?')[0];
                }
                else if (company.logo_url.includes('/logos/')) {
                    logoPath = company.logo_url.split('/logos/')[1].split('?')[0];
                }
                else if (company.logo_url.startsWith('logos/')) {
                    logoPath = company.logo_url.replace('logos/', '').split('?')[0];
                }
                else {
                    logoPath = company.logo_url.split('?')[0];
                }
                console.log('📂 Extracted logo path:', logoPath);
                if (logoPath) {
                    const { data: logoData, error: logoError } = await supabase_1.supabaseAdmin.storage
                        .from('logos')
                        .download(logoPath);
                    if (logoError) {
                        console.error('❌ Error downloading logo from storage:', logoError);
                    }
                    else if (logoData) {
                        const logoBuffer = Buffer.from(await logoData.arrayBuffer());
                        const logoMimeType = logoData.type || 'image/png';
                        logoBase64 = `data:${logoMimeType};base64,${logoBuffer.toString('base64')}`;
                        console.log('✅ Logo converted to base64 for PDF. Size:', logoBuffer.length, 'bytes');
                    }
                    else {
                        console.warn('⚠️ Logo data is null/undefined');
                    }
                }
                else {
                    console.warn('⚠️ Could not extract logo path from URL:', company.logo_url);
                }
            }
            catch (logoFetchError) {
                console.error('❌ Error fetching logo for PDF:', logoFetchError);
            }
        }
        else {
            console.log('ℹ️ No logo_url found in company data');
        }
        const QRCode = require('qrcode');
        const qrReference = invoice.qr_reference;
        const qrPayload = [
            'SPC',
            '0200',
            '1',
            company.iban || 'CH2109000000100015000.6',
            'S',
            company.name,
            company.address,
            '',
            company.zip,
            company.city,
            'CH',
            '', '', '', '', '', '', '',
            (invoice.total / 100).toFixed(2),
            'CHF',
            'S',
            invoice.customers.name,
            invoice.customers.address,
            '',
            invoice.customers.zip,
            invoice.customers.city,
            invoice.customers.country || 'CH',
            'QRR',
            qrReference,
            `Invoice ${invoice.number}`,
            'EPD'
        ].join('\n');
        const qrCodeImage = await QRCode.toDataURL(qrPayload, {
            type: 'image/png',
            width: 140,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        console.log('QR code generated for invoice:', invoice.number);
        const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice ${invoice.number}</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 0; 
          padding: 20px; 
          font-size: 12px;
          color: #333;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e5e5;
        }
        .company-info { flex: 1; }
        .logo { width: 150px; height: 80px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; }
        .invoice-title { 
          font-size: 24px; 
          font-weight: bold; 
          color: #2563eb;
          margin: 20px 0;
        }
        .invoice-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-bottom: 30px;
        }
        .customer-info { }
        .invoice-meta { text-align: right; }
        .items-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 30px 0;
        }
        .items-table th, .items-table td { 
          border: 1px solid #ddd; 
          padding: 8px; 
          text-align: left;
        }
        .items-table th { 
          background-color: #f8f9fa; 
          font-weight: bold;
        }
        .items-table .number { text-align: right; }
        .totals { 
          margin-top: 20px;
          text-align: right;
        }
        .totals table {
          margin-left: auto;
          border-collapse: collapse;
        }
        .totals td {
          padding: 5px 15px;
          border-bottom: 1px solid #eee;
        }
        .totals .total-row {
          font-weight: bold;
          font-size: 14px;
          border-top: 2px solid #333;
        }
        .payment-info {
          margin-top: 40px;
          padding: 20px;
          background-color: #f8f9fa;
          border: 1px solid #ddd;
        }
        .qr-section {
          margin-top: 30px;
          padding: 20px;
          border: 2px solid #000;
          display: flex;
          gap: 20px;
        }
        .qr-code {
          width: 140px;
          height: 140px;
          border: 1px solid #000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          font-size: 10px;
        }
        .qr-info { flex: 1; }
        .swiss-cross {
          color: red;
          font-weight: bold;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <!-- Header with Company Info and Logo -->
      <div class="header">
        <div class="company-info">
          <h1>${company.name}</h1>
          <div>${company.address}</div>
          <div>${company.zip} ${company.city}</div>
          <div>Schweiz</div>
          <br>
          <div>E-Mail: ${company.email}</div>
          ${company.phone ? `<div>Tel: ${company.phone}</div>` : ''}
          ${company.uid ? `<div>UID: ${company.uid}</div>` : ''}
          ${company.vat_number ? `<div>MWST-Nr: ${company.vat_number}</div>` : ''}
          ${company.iban ? `<div>IBAN: ${company.iban}</div>` : ''}
        </div>
        <div class="logo">
          ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-width: 220px; max-height: 150px; width: auto; height: auto; object-fit: contain; display: block;">` : ''}
        </div>
      </div>

      <!-- Invoice Title -->
      <div class="invoice-title">Rechnung ${invoice.number}</div>

      <!-- Invoice Details -->
      <div class="invoice-details">
        <div class="customer-info">
          <h3>Rechnungsadresse:</h3>
          <div><strong>${invoice.customers.name}</strong></div>
          ${invoice.customers.company ? `<div>${invoice.customers.company}</div>` : ''}
          <div>${invoice.customers.address}</div>
          <div>${invoice.customers.zip} ${invoice.customers.city}</div>
          <div>${invoice.customers.country === 'CH' ? 'Schweiz' : invoice.customers.country}</div>
          ${invoice.customers.email ? `<br><div>E-Mail: ${invoice.customers.email}</div>` : ''}
          ${invoice.customers.phone ? `<div>Tel: ${invoice.customers.phone}</div>` : ''}
          ${invoice.customers.uid ? `<div>UID: ${invoice.customers.uid}</div>` : ''}
        </div>
        <div class="invoice-meta">
          <table>
            <tr><td><strong>Rechnungsnummer:</strong></td><td>${invoice.number}</td></tr>
            <tr><td><strong>Rechnungsdatum:</strong></td><td>${new Date(invoice.date).toLocaleDateString('de-CH')}</td></tr>
            <tr><td><strong>Fälligkeitsdatum:</strong></td><td>${new Date(invoice.due_date).toLocaleDateString('de-CH')}</td></tr>
            <tr><td><strong>Zahlungsfrist:</strong></td><td>${invoice.customers.payment_terms || 30} Tage</td></tr>
            <tr><td><strong>QR-Referenz:</strong></td><td>${invoice.qr_reference}</td></tr>
          </table>
        </div>
      </div>

      <!-- Invoice Items -->
      <table class="items-table">
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Beschreibung</th>
            <th>Menge</th>
            <th>Einheit</th>
            <th>Preis (CHF)</th>
            <th>Rabatt (%)</th>
            <th>MWST (%)</th>
            <th>Betrag (CHF)</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.invoice_items?.map((item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${item.description}</td>
              <td class="number">${(item.quantity / 1000).toFixed(3)}</td>
              <td>${item.unit}</td>
              <td class="number">${(item.unit_price / 100).toFixed(2)}</td>
              <td class="number">${(item.discount / 100).toFixed(1)}%</td>
              <td class="number">${(item.vat_rate / 100).toFixed(1)}%</td>
              <td class="number">${(item.line_total / 100).toFixed(2)}</td>
            </tr>
          `).join('') || '<tr><td colspan="8">No items</td></tr>'}
        </tbody>
      </table>

      <!-- Totals -->
      <div class="totals">
        <table>
          <tr><td>Zwischensumme:</td><td>CHF ${(invoice.subtotal / 100).toFixed(2)}</td></tr>
          ${invoice.discount_amount > 0 ? `<tr><td>Rabatt:</td><td>CHF -${(invoice.discount_amount / 100).toFixed(2)}</td></tr>` : ''}
          <tr><td>MWST:</td><td>CHF ${(invoice.vat_amount / 100).toFixed(2)}</td></tr>
          <tr class="total-row"><td><strong>Total CHF:</strong></td><td><strong>${(invoice.total / 100).toFixed(2)}</strong></td></tr>
        </table>
      </div>

      <!-- Payment Information -->
      <div class="payment-info">
        <h3>Zahlungsinformationen</h3>
        <p><strong>Zahlbar bis:</strong> ${new Date(invoice.due_date).toLocaleDateString('de-CH')}</p>
        <p><strong>Referenz:</strong> ${invoice.qr_reference}</p>
        <p>Bitte verwenden Sie den beigefügten QR-Code für die Zahlung oder überweisen Sie den Betrag unter Angabe der Referenznummer.</p>
      </div>

      <!-- Page Break Before QR Section -->
      <div style="page-break-before: always;"></div>
      
      <!-- Swiss QR-Invoice Payment Slip (Separate Page) -->
      <div style="width: 210mm; height: 297mm; position: relative; margin: 0; padding: 0;">
        
        <!-- QR-Invoice Header -->
        <div style="text-align: center; margin: 20mm 0 10mm 0; font-size: 16px; font-weight: bold;">
          Zahlteil / Section paiement / Sezione pagamento
        </div>
        
        <!-- Main QR Payment Section -->
        <div style="display: flex; height: 105mm; border: 1px solid #000;">
          
          <!-- Receipt Section (Left) -->
          <div style="width: 62mm; padding: 5mm; border-right: 1px solid #000; font-size: 8pt;">
            <div style="font-weight: bold; margin-bottom: 5mm;">Empfangsschein</div>
            
            <div style="margin-bottom: 3mm;">
              <div style="font-weight: bold; font-size: 6pt;">Konto / Payable to</div>
              <div>${company.iban || 'CH21 0900 0000 1001 5000 6'}</div>
              <div>${company.name}</div>
              <div>${company.address}</div>
              <div>${company.zip} ${company.city}</div>
            </div>
            
            <div style="margin-bottom: 3mm;">
              <div style="font-weight: bold; font-size: 6pt;">Referenz</div>
              <div style="font-size: 8pt;">${qrReference}</div>
            </div>
            
            <div style="margin-bottom: 3mm;">
              <div style="font-weight: bold; font-size: 6pt;">Zahlbar durch</div>
              <div>${invoice.customers.name}</div>
              ${invoice.customers.company ? `<div>${invoice.customers.company}</div>` : ''}
              <div>${invoice.customers.address}</div>
              <div>${invoice.customers.zip} ${invoice.customers.city}</div>
            </div>
            
            <div style="position: absolute; bottom: 5mm; left: 5mm;">
              <div style="font-weight: bold; font-size: 6pt;">Währung</div>
              <div>CHF</div>
            </div>
            
            <div style="position: absolute; bottom: 5mm; left: 20mm;">
              <div style="font-weight: bold; font-size: 6pt;">Betrag</div>
              <div style="font-weight: bold;">${(invoice.total / 100).toFixed(2)}</div>
            </div>
            
            <div style="position: absolute; bottom: 15mm; right: 5mm; font-size: 6pt;">
              Annahmestelle
            </div>
          </div>
          
          <!-- Payment Section (Right) -->
          <div style="flex: 1; padding: 5mm; position: relative;">
            <div style="font-weight: bold; margin-bottom: 5mm;">Zahlteil</div>
            
            <!-- QR Code -->
            <div style="position: absolute; top: 5mm; right: 5mm;">
              <img src="${qrCodeImage}" alt="Swiss QR Code" style="width: 46mm; height: 46mm;" />
              <div style="text-align: center; margin-top: 2mm; font-size: 6pt;">
                🇨🇭 Swiss QR Code
              </div>
            </div>
            
            <!-- Payment Information -->
            <div style="width: 55mm;">
              <div style="margin-bottom: 3mm;">
                <div style="font-weight: bold; font-size: 6pt;">Währung</div>
                <div>CHF</div>
              </div>
              
              <div style="margin-bottom: 3mm;">
                <div style="font-weight: bold; font-size: 6pt;">Betrag</div>
                <div style="font-weight: bold; font-size: 10pt;">${(invoice.total / 100).toFixed(2)}</div>
              </div>
              
              <div style="margin-bottom: 3mm;">
                <div style="font-weight: bold; font-size: 6pt;">Konto / Payable to</div>
                <div>${company.iban || 'CH21 0900 0000 1001 5000 6'}</div>
                <div>${company.name}</div>
                <div>${company.address}</div>
                <div>${company.zip} ${company.city}</div>
              </div>
              
              <div style="margin-bottom: 3mm;">
                <div style="font-weight: bold; font-size: 6pt;">Referenz</div>
                <div style="font-size: 8pt; word-break: break-all;">${qrReference}</div>
              </div>
              
              <div style="margin-bottom: 3mm;">
                <div style="font-weight: bold; font-size: 6pt;">Zusätzliche Informationen</div>
                <div style="font-size: 8pt;">Rechnung ${invoice.number}</div>
                <div style="font-size: 8pt;">Fällig: ${new Date(invoice.due_date).toLocaleDateString('de-CH')}</div>
              </div>
              
              <div>
                <div style="font-weight: bold; font-size: 6pt;">Zahlbar durch</div>
                <div>${invoice.customers.name}</div>
                ${invoice.customers.company ? `<div>${invoice.customers.company}</div>` : ''}
                <div>${invoice.customers.address}</div>
                <div>${invoice.customers.zip} ${invoice.customers.city}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Perforated Line -->
        <div style="margin: 5mm 0; border-top: 1px dashed #000; text-align: center; font-size: 6pt; color: #666;">
          ✂️ Hier abtrennen / Détacher ici / Staccare qui
        </div>
        
      </div>

      <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #666;">
        Generiert am ${new Date().toLocaleDateString('de-CH')} um ${new Date().toLocaleTimeString('de-CH')}
      </div>
    </body>
    </html>
    `;
        try {
            const htmlPdf = require('html-pdf-node');
            console.log('Starting PDF generation for invoice:', invoice.number);
            const options = {
                format: 'A4',
                margin: {
                    top: '20mm',
                    bottom: '20mm',
                    left: '20mm',
                    right: '20mm'
                },
                printBackground: true,
                displayHeaderFooter: false,
                timeout: 5000,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--run-all-compositor-stages-before-draw',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding'
                ],
                waitForSelector: 'body',
                omitBackground: false,
                preferCSSPageSize: true,
                emulateMedia: 'print'
            };
            const file = { content: htmlTemplate };
            console.log('Generating PDF with html-pdf-node...');
            const pdfBuffer = await htmlPdf.generatePdf(file, options);
            console.log('PDF generated successfully, size:', pdfBuffer.length);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.number}.pdf"`);
            res.setHeader('Content-Length', pdfBuffer.length.toString());
            res.send(pdfBuffer);
        }
        catch (pdfError) {
            console.error('PDF generation error:', pdfError);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(htmlTemplate + `
        <br><br>
        <div style="color: red; background: #ffe6e6; padding: 10px; border: 1px solid red; margin: 20px;">
          <strong>PDF Generation Failed:</strong> ${pdfError?.message || 'Unknown error'}<br>
          Showing HTML version instead. Use browser Print → Save as PDF.
        </div>
      `);
        }
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'generate PDF');
    }
});
exports.sendInvoiceReminder = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const invoiceId = req.params.id;
    const { level } = req.body;
    console.log('📧 Reminder request:', { companyId, invoiceId, level });
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        console.log('🔍 Looking up invoice:', { invoiceId, companyId });
        const { data: invoice, error: invoiceError } = await supabase_1.db.invoices()
            .select(`
        *,
        customers (
          id, name, company, email, address, zip, city, country, phone
        )
      `)
            .eq('id', invoiceId)
            .eq('company_id', companyId)
            .single();
        const { data: company, error: companyError } = await supabase_1.db.companies()
            .select('*')
            .eq('id', companyId)
            .single();
        if (companyError || !company) {
            res.status(404).json({
                success: false,
                error: 'Company not found'
            });
            return;
        }
        console.log('📋 Invoice lookup result:', { invoice, error: invoiceError });
        if (invoiceError || !invoice) {
            console.log('❌ Invoice not found:', invoiceError);
            res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
            return;
        }
        console.log('📊 Invoice status:', invoice.status);
        if (invoice.status === 'CANCELLED') {
            console.log('❌ Invoice is cancelled, cannot send reminder');
            res.status(400).json({
                success: false,
                error: 'Cannot send reminder for cancelled invoice'
            });
            return;
        }
        const totalAmount = invoice.total;
        const paidAmount = invoice.paid_amount || 0;
        const isFullyPaid = paidAmount >= totalAmount;
        if (isFullyPaid) {
            console.log('❌ Invoice is fully paid, cannot send reminder');
            res.status(400).json({
                success: false,
                error: 'Cannot send reminder for fully paid invoice'
            });
            return;
        }
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysSinceDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceDue < 1) {
            if (daysSinceDue < 0) {
                const daysUntilDue = Math.abs(daysSinceDue);
                console.log(`❌ Due date hasn't passed yet. ${daysUntilDue} days until due date.`);
                res.status(400).json({
                    success: false,
                    error: `Reminder can only be sent after the due date has passed. Due date is in ${daysUntilDue + 1} ${daysUntilDue === 0 ? 'day' : 'days'}.`
                });
            }
            else {
                console.log(`❌ Due date is today. Reminder can be sent tomorrow.`);
                res.status(400).json({
                    success: false,
                    error: `Reminder can be sent starting 1 day after the due date. Please try again tomorrow.`
                });
            }
            return;
        }
        console.log(`✅ Invoice eligible for reminder: ${daysSinceDue} days overdue, CHF ${((totalAmount - paidAmount) / 100).toFixed(2)} remaining`);
        if (level < 1 || level > 3) {
            res.status(400).json({
                success: false,
                error: 'Invalid reminder level (must be 1-3)'
            });
            return;
        }
        console.log(`Sending reminder level ${level} for invoice ${invoice.number}`);
        let pdfFilePath = null;
        let pdfBuffer = null;
        try {
            const htmlPdf = require('html-pdf-node');
            const daysSinceDue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24));
            const totalAmountCHF = invoice.total / 100;
            const paidAmountCHF = (invoice.paid_amount || 0) / 100;
            const remainingAmountCHF = totalAmountCHF - paidAmountCHF;
            const paymentProgress = totalAmountCHF > 0 ? (paidAmountCHF / totalAmountCHF) * 100 : 0;
            const reminderTemplates = {
                1: {
                    title: '1. Mahnung',
                    body: `Das Fälligkeitsdatum ist bereits überschritten, und wir haben noch keine vollständige Zahlung erhalten. Wir bitten Sie höflich, den offenen Betrag innerhalb der nächsten 10 Tage zu begleichen.`
                },
                2: {
                    title: '2. Mahnung',
                    body: `Trotz unserer ersten Mahnung ist die nachstehende Rechnung noch immer nicht vollständig beglichen. Wir bitten Sie dringend, den Betrag innerhalb von 5 Tagen zu begleichen.`
                },
                3: {
                    title: '3. und letzte Mahnung',
                    body: `Dies ist unsere letzte Mahnung für die nachstehende Rechnung. Sollte der offene Betrag nicht innerhalb von 3 Tagen beglichen werden, werden wir ohne weitere Vorankündigung rechtliche Schritte einleiten.`
                }
            };
            const template = reminderTemplates[level];
            const QRCode = require('qrcode');
            const qrPayload = [
                'SPC',
                '0200',
                '1',
                company.iban || 'CH2109000000100015000.6',
                'S',
                company.name,
                company.address,
                '',
                company.zip,
                company.city,
                'CH',
                '', '', '', '', '', '', '',
                remainingAmountCHF.toFixed(2),
                'CHF',
                'S',
                invoice.customers.name,
                invoice.customers.address || '',
                '',
                invoice.customers.zip || '0000',
                invoice.customers.city || '',
                invoice.customers.country || 'CH',
                'QRR',
                invoice.qr_reference,
                `Invoice ${invoice.number} - ${template.title}`,
                'EPD'
            ].join('\n');
            const qrCodeImage = await QRCode.toDataURL(qrPayload, {
                type: 'image/png',
                width: 140,
                margin: 1,
                color: { dark: '#000000', light: '#FFFFFF' }
            });
            const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${template.title} - ${invoice.number}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 0; 
            font-size: 12px;
            line-height: 1.4;
            color: #333;
          }
          .page-break {
            page-break-before: always;
          }
          .no-break {
            page-break-inside: avoid;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: start;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e5e5;
            page-break-inside: avoid;
          }
          .reminder-title { 
            font-size: 20px; 
            font-weight: bold; 
            color: #2563eb;
            margin: 20px 0 15px 0;
            text-align: center;
            text-transform: uppercase;
            page-break-inside: avoid;
          }
          .customer-address {
            margin: 30px 0;
            line-height: 1.3;
          }
          .reminder-content {
            margin: 25px 0;
            line-height: 1.6;
            page-break-inside: avoid;
          }
          .invoice-details {
            margin: 25px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            border-left: 4px solid #2563eb;
            page-break-inside: avoid;
          }
          .payment-progress {
            margin: 25px 0;
            padding: 15px;
            background-color: #f0f9ff;
            border: 1px solid #0ea5e9;
            border-radius: 8px;
            page-break-inside: avoid;
          }
          .progress-bar-container {
            width: 100%;
            height: 30px;
            background-color: #e5e7eb;
            border-radius: 15px;
            overflow: hidden;
            margin: 15px 0;
            position: relative;
          }
          .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981 0%, #059669 100%);
            border-radius: 15px;
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
          }
          .progress-info {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
            font-size: 11px;
            color: #6b7280;
          }
          .payment-info {
            margin: 25px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <div>
            <h1>${company.name}</h1>
            <div>${company.address}</div>
            <div>${company.zip} ${company.city}</div>
            <div>Schweiz</div>
          </div>
        </div>

        <!-- Customer Address -->
        <div class="customer-address">
          <strong>${invoice.customers.name}</strong><br>
          ${invoice.customers.company ? `${invoice.customers.company}<br>` : ''}
          ${invoice.customers.address}<br>
          ${invoice.customers.zip} ${invoice.customers.city}
        </div>

        <!-- Date -->
        <div style="text-align: right; margin: 20px 0;">
          ${company.city}, ${new Date().toLocaleDateString('de-CH')}
        </div>

        <!-- Reminder Title -->
        <div class="reminder-title">${template.title}</div>

        <!-- Reminder Content -->
        <div class="reminder-content">
          <p>Sehr geehrte Damen und Herren,</p>
          <p>${template.body}</p>
          <p>Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben als gegenstandslos.</p>
        </div>

        <!-- Invoice Details -->
        <div class="invoice-details">
          <h3 style="margin-top: 0;">Rechnungsdetails</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0;"><strong>Rechnungsnummer:</strong></td>
              <td style="padding: 8px 0;">${invoice.number}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Rechnungsdatum:</strong></td>
              <td style="padding: 8px 0;">${new Date(invoice.date).toLocaleDateString('de-CH')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Fälligkeitsdatum:</strong></td>
              <td style="padding: 8px 0;">${new Date(invoice.due_date).toLocaleDateString('de-CH')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Tage überfällig:</strong></td>
              <td style="padding: 8px 0; color: red; font-weight: bold;">${daysSinceDue} Tage</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Rechnungsbetrag:</strong></td>
              <td style="padding: 8px 0; font-weight: bold;">CHF ${totalAmountCHF.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <!-- Payment Progress -->
        <div class="payment-progress">
          <h3 style="margin-top: 0;">Zahlungsstatus</h3>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${Math.min(paymentProgress, 100)}%;">
              ${paymentProgress.toFixed(1)}%
            </div>
          </div>
          <div class="progress-info">
            <span>Bezahlt: <strong>CHF ${paidAmountCHF.toFixed(2)}</strong></span>
            <span>Offen: <strong>CHF ${remainingAmountCHF.toFixed(2)}</strong></span>
          </div>
          <div style="margin-top: 15px; text-align: center; font-weight: bold; color: #dc2626;">
            Offener Betrag: CHF ${remainingAmountCHF.toFixed(2)}
          </div>
        </div>

        <!-- Payment Information -->
        <div class="payment-info">
          <h3>Zahlungsinformationen</h3>
          <p><strong>Zahlbar bis:</strong> ${new Date(Date.now() + (level === 3 ? 3 : level === 2 ? 5 : 10) * 24 * 60 * 60 * 1000).toLocaleDateString('de-CH')}</p>
          <p><strong>Referenz:</strong> ${invoice.qr_reference}</p>
          <p>Bitte verwenden Sie den beigefügten QR-Code für die Zahlung oder überweisen Sie den Betrag unter Angabe der Referenznummer.</p>
        </div>

        <!-- Page Break Before QR Section -->
        <div style="page-break-before: always;"></div>
        
        <!-- Swiss QR-Invoice Payment Slip (Separate Page) -->
        <div style="width: 210mm; height: 297mm; position: relative; margin: 0; padding: 0;">
          
          <!-- QR-Invoice Header -->
          <div style="text-align: center; margin: 20mm 0 10mm 0; font-size: 16px; font-weight: bold;">
            Zahlteil / Section paiement / Sezione pagamento
          </div>
          
          <!-- Main QR Payment Section -->
          <div style="display: flex; height: 105mm; border: 1px solid #000;">
            
            <!-- Receipt Section (Left) -->
            <div style="width: 62mm; padding: 5mm; border-right: 1px solid #000; font-size: 8pt; position: relative;">
              <div style="font-weight: bold; margin-bottom: 5mm;">Empfangsschein</div>
              
              <div style="margin-bottom: 3mm;">
                <div style="font-weight: bold; font-size: 6pt;">Konto / Payable to</div>
                <div>${company.iban || 'CH21 0900 0000 1001 5000 6'}</div>
                <div>${company.name}</div>
                <div>${company.address}</div>
                <div>${company.zip} ${company.city}</div>
              </div>
              
              <div style="margin-bottom: 3mm;">
                <div style="font-weight: bold; font-size: 6pt;">Referenz</div>
                <div style="font-size: 8pt;">${invoice.qr_reference}</div>
              </div>
              
              <div style="margin-bottom: 3mm;">
                <div style="font-weight: bold; font-size: 6pt;">Zahlbar durch</div>
                <div>${invoice.customers.name}</div>
                ${invoice.customers.company ? `<div>${invoice.customers.company}</div>` : ''}
                <div>${invoice.customers.address}</div>
                <div>${invoice.customers.zip} ${invoice.customers.city}</div>
              </div>
              
              <div style="position: absolute; bottom: 5mm; left: 5mm;">
                <div style="font-weight: bold; font-size: 6pt;">Währung</div>
                <div>CHF</div>
              </div>
              
              <div style="position: absolute; bottom: 5mm; left: 20mm;">
                <div style="font-weight: bold; font-size: 6pt;">Betrag</div>
                <div style="font-weight: bold;">${remainingAmountCHF.toFixed(2)}</div>
              </div>
              
              <div style="position: absolute; bottom: 15mm; right: 5mm; font-size: 6pt;">
                Annahmestelle
              </div>
            </div>
            
            <!-- Payment Section (Right) -->
            <div style="flex: 1; padding: 5mm; position: relative;">
              <div style="font-weight: bold; margin-bottom: 5mm;">Zahlteil</div>
              
              <!-- QR Code -->
              <div style="position: absolute; top: 5mm; right: 5mm;">
                <img src="${qrCodeImage}" alt="Swiss QR Code" style="width: 46mm; height: 46mm;" />
                <div style="text-align: center; margin-top: 2mm; font-size: 6pt;">
                  🇨🇭 Swiss QR Code
                </div>
              </div>
              
              <!-- Payment Information -->
              <div style="width: 55mm;">
                <div style="margin-bottom: 3mm;">
                  <div style="font-weight: bold; font-size: 6pt;">Währung</div>
                  <div>CHF</div>
                </div>
                
                <div style="margin-bottom: 3mm;">
                  <div style="font-weight: bold; font-size: 6pt;">Betrag</div>
                  <div style="font-weight: bold; font-size: 10pt;">${remainingAmountCHF.toFixed(2)}</div>
                </div>
                
                <div style="margin-bottom: 3mm;">
                  <div style="font-weight: bold; font-size: 6pt;">Konto / Payable to</div>
                  <div>${company.iban || 'CH21 0900 0000 1001 5000 6'}</div>
                  <div>${company.name}</div>
                  <div>${company.address}</div>
                  <div>${company.zip} ${company.city}</div>
                </div>
                
                <div style="margin-bottom: 3mm;">
                  <div style="font-weight: bold; font-size: 6pt;">Referenz</div>
                  <div style="font-size: 8pt; word-break: break-all;">${invoice.qr_reference}</div>
                </div>
                
                <div style="margin-bottom: 3mm;">
                  <div style="font-weight: bold; font-size: 6pt;">Zusätzliche Informationen</div>
                  <div style="font-size: 8pt;">Rechnung ${invoice.number}</div>
                  <div style="font-size: 8pt;">${template.title}</div>
                  <div style="font-size: 8pt;">Zahlbar bis: ${new Date(Date.now() + (level === 3 ? 3 : level === 2 ? 5 : 10) * 24 * 60 * 60 * 1000).toLocaleDateString('de-CH')}</div>
                </div>
                
                <div>
                  <div style="font-weight: bold; font-size: 6pt;">Zahlbar durch</div>
                  <div>${invoice.customers.name}</div>
                  ${invoice.customers.company ? `<div>${invoice.customers.company}</div>` : ''}
                  <div>${invoice.customers.address}</div>
                  <div>${invoice.customers.zip} ${invoice.customers.city}</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Perforated Line -->
          <div style="margin: 5mm 0; border-top: 1px dashed #000; text-align: center; font-size: 6pt; color: #666;">
            ✂️ Hier abtrennen / Détacher ici / Staccare qui
          </div>
          
        </div>

        <!-- Closing -->
        <div style="margin: 40px 0 20px 0;">
          <p>Freundliche Grüsse</p>
          <br>
          <p><strong>${company.name}</strong></p>
        </div>
      </body>
      </html>
      `;
            const options = {
                format: 'A4',
                margin: {
                    top: '20mm',
                    bottom: '20mm',
                    left: '20mm',
                    right: '20mm'
                },
                printBackground: true,
                timeout: 30000
            };
            const file = { content: htmlTemplate };
            pdfBuffer = await htmlPdf.generatePdf(file, options);
            const sanitizeForPath = (name) => {
                return name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            };
            const companyName = sanitizeForPath(company.name || 'Company');
            const customerName = sanitizeForPath(invoice.customers.name || 'Customer');
            const invoiceNumber = sanitizeForPath(invoice.number);
            const fileName = `Reminder-${level}-${invoice.number}.pdf`;
            const filePath = `${companyName}/${customerName}/${invoiceNumber}/${fileName}`;
            if (!pdfBuffer) {
                throw new Error('Failed to generate PDF buffer');
            }
            const { data: uploadData, error: uploadError } = await supabase_1.supabaseAdmin.storage
                .from('invoices')
                .upload(filePath, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: false
            });
            if (uploadError) {
                console.error('❌ Failed to upload reminder PDF to storage:', uploadError);
            }
            else {
                pdfFilePath = uploadData.path;
                console.log('✅ Reminder PDF uploaded successfully:', pdfFilePath);
                const fileInfo = {
                    id: crypto.randomUUID(),
                    fileName: fileName,
                    filePath: uploadData.path,
                    fileType: 'reminder_pdf',
                    reminderLevel: level,
                    uploadedAt: new Date().toISOString()
                };
                const currentNotes = invoice.internal_notes || '{}';
                let notesData = {};
                try {
                    if (currentNotes && currentNotes.trim() !== '' && currentNotes.trim().startsWith('{')) {
                        notesData = JSON.parse(currentNotes);
                    }
                }
                catch (e) {
                    notesData = {
                        _oldNotes: currentNotes,
                        files: []
                    };
                }
                if (!notesData.files) {
                    notesData.files = [];
                }
                notesData.files.push(fileInfo);
                await supabase_1.db.invoices()
                    .update({
                    internal_notes: JSON.stringify(notesData)
                })
                    .eq('id', invoiceId);
            }
        }
        catch (pdfError) {
            console.error('❌ Error generating reminder PDF:', pdfError);
        }
        const { data: updatedInvoice, error: updateError } = await supabase_1.db.invoices()
            .update({
            reminder_level: level,
            last_reminder_at: new Date().toISOString(),
            email_sent_count: (invoice.email_sent_count || 0) + 1
        })
            .eq('id', invoiceId)
            .eq('company_id', companyId)
            .select()
            .single();
        if (updateError) {
            (0, supabase_1.handleSupabaseError)(updateError, 'update reminder level');
            return;
        }
        try {
            const { Resend } = require('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);
            const verifiedEmail = 'mkrshkov@gmail.com';
            const daysSinceDue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24));
            const totalAmountCHF = invoice.total / 100;
            const paidAmountCHF = (invoice.paid_amount || 0) / 100;
            const remainingAmountCHF = totalAmountCHF - paidAmountCHF;
            const emailData = {
                from: `${config_1.config.email.fromName} <${config_1.config.email.fromEmail}>`,
                to: [verifiedEmail],
                subject: `${level}. Mahnung - Rechnung ${invoice.number}`,
                html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Payment Reminder</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #2563eb; margin: 0;">${level}. Mahnung - Rechnung ${invoice.number}</h2>
            </div>
            
            <p>Sehr geehrte Damen und Herren,</p>
            
            <p>Es sind bereits ${daysSinceDue} Tage seit dem Fälligkeitsdatum vergangen, und wir haben noch keine vollständige Zahlung erhalten.</p>
            
            <div style="background: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p><strong>Rechnungsnummer:</strong> ${invoice.number}</p>
              <p><strong>Rechnungsdatum:</strong> ${new Date(invoice.date).toLocaleDateString('de-CH')}</p>
              <p><strong>Fälligkeitsdatum:</strong> ${new Date(invoice.due_date).toLocaleDateString('de-CH')}</p>
              <p><strong>Rechnungsbetrag:</strong> CHF ${totalAmountCHF.toFixed(2)}</p>
              <p><strong>Bezahlt:</strong> CHF ${paidAmountCHF.toFixed(2)}</p>
              <p><strong>Offener Betrag:</strong> <strong style="color: #dc2626;">CHF ${remainingAmountCHF.toFixed(2)}</strong></p>
            </div>
            
            <p>Bitte sehen Sie die beigefügte PDF-Datei für weitere Details.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p>Freundliche Grüsse<br><strong>${company.name}</strong></p>
              <p style="font-size: 12px; color: #6b7280;">
                Test email sent to ${verifiedEmail}
              </p>
            </div>
          </body>
          </html>
        `,
                text: `${level}. Mahnung - Rechnung ${invoice.number}\n\nSehr geehrte Damen und Herren,\n\nEs sind bereits ${daysSinceDue} Tage seit dem Fälligkeitsdatum vergangen, und wir haben noch keine vollständige Zahlung erhalten.\n\nRechnungsnummer: ${invoice.number}\nRechnungsdatum: ${new Date(invoice.date).toLocaleDateString('de-CH')}\nFälligkeitsdatum: ${new Date(invoice.due_date).toLocaleDateString('de-CH')}\nOffener Betrag: CHF ${remainingAmountCHF.toFixed(2)}\n\nBitte sehen Sie die beigefügte PDF-Datei für weitere Details.\n\nFreundliche Grüsse\n${company.name}\n\nTest email sent to ${verifiedEmail}`
            };
            if (pdfBuffer && Buffer.isBuffer(pdfBuffer)) {
                emailData.attachments = [{
                        filename: `Mahnung-${level}-${invoice.number}.pdf`,
                        content: pdfBuffer
                    }];
            }
            const result = await resend.emails.send(emailData);
            if (result.data?.id) {
                console.log(`✅ Reminder ${level} sent successfully to ${verifiedEmail} (Message ID: ${result.data.id})`);
            }
            else {
                console.error(`❌ Failed to send reminder email:`, result.error);
            }
        }
        catch (emailError) {
            console.error('Error sending reminder email:', emailError);
        }
        res.json({
            success: true,
            message: `Reminder ${level} sent successfully to mkrshkov@gmail.com`,
            data: {
                invoice: updatedInvoice,
                reminderLevel: level,
                sentTo: 'mkrshkov@gmail.com',
                sentAt: new Date().toISOString(),
                testMode: true
            }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'send reminder');
    }
});
exports.generateReminderPdf = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const invoiceId = req.params.id;
    const reminderLevel = parseInt(req.params.level);
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    if (!reminderLevel || reminderLevel < 1 || reminderLevel > 3) {
        res.status(400).json({
            success: false,
            error: 'Invalid reminder level (1-3)'
        });
        return;
    }
    try {
        const { data: invoice, error: invoiceError } = await supabase_1.db.invoices()
            .select(`
        *,
        customers (
          id, name, company, address, zip, city, country, email, phone
        )
      `)
            .eq('id', invoiceId)
            .eq('company_id', companyId)
            .single();
        if (invoiceError || !invoice) {
            res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
            return;
        }
        const { data: company, error: companyError } = await supabase_1.db.companies()
            .select('*')
            .eq('id', companyId)
            .single();
        if (companyError || !company) {
            res.status(404).json({
                success: false,
                error: 'Company not found'
            });
            return;
        }
        let logoBase64 = null;
        if (company.logo_url) {
            try {
                console.log('🔍 Attempting to fetch logo for reminder PDF. Logo URL:', company.logo_url);
                let logoPath = null;
                if (company.logo_url.includes('/storage/v1/object/public/logos/')) {
                    logoPath = company.logo_url.split('/storage/v1/object/public/logos/')[1].split('?')[0];
                }
                else if (company.logo_url.includes('/logos/')) {
                    logoPath = company.logo_url.split('/logos/')[1].split('?')[0];
                }
                else if (company.logo_url.startsWith('logos/')) {
                    logoPath = company.logo_url.replace('logos/', '').split('?')[0];
                }
                else {
                    logoPath = company.logo_url.split('?')[0];
                }
                console.log('📂 Extracted logo path for reminder:', logoPath);
                if (logoPath) {
                    const { data: logoData, error: logoError } = await supabase_1.supabaseAdmin.storage
                        .from('logos')
                        .download(logoPath);
                    if (logoError) {
                        console.error('❌ Error downloading logo for reminder:', logoError);
                    }
                    else if (logoData) {
                        const logoBuffer = Buffer.from(await logoData.arrayBuffer());
                        const logoMimeType = logoData.type || 'image/png';
                        logoBase64 = `data:${logoMimeType};base64,${logoBuffer.toString('base64')}`;
                        console.log('✅ Logo converted to base64 for reminder PDF');
                    }
                }
            }
            catch (logoFetchError) {
                console.error('❌ Error fetching logo for reminder PDF:', logoFetchError);
            }
        }
        const reminderTemplates = {
            1: {
                title: '1. Mahnung',
                subject: `1. Zahlungserinnerung - Rechnung ${invoice.number}`,
                salutation: 'Sehr geehrte Damen und Herren',
                body: `unser System zeigt, dass die nachstehende Rechnung noch nicht beglichen wurde. Wir bitten Sie höflich, den offenen Betrag innerhalb der nächsten 10 Tage zu begleichen.

Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben als gegenstandslos.`,
                closing: 'Freundliche Grüsse',
                urgency: 'info',
                fee: 0
            },
            2: {
                title: '2. Mahnung',
                subject: `2. Mahnung - Rechnung ${invoice.number}`,
                salutation: 'Sehr geehrte Damen und Herren',
                body: `trotz unserer ersten Mahnung ist die nachstehende Rechnung noch immer offen. Wir bitten Sie dringend, den Betrag innerhalb von 5 Tagen zu begleichen.

Bei weiterem Zahlungsverzug sehen wir uns leider veranlasst, weitere Massnahmen zu ergreifen.`,
                closing: 'Mit freundlichen Grüssen',
                urgency: 'warning',
                fee: 20.00
            },
            3: {
                title: '3. und letzte Mahnung',
                subject: `Letzte Mahnung - Rechnung ${invoice.number}`,
                salutation: 'Sehr geehrte Damen und Herren',
                body: `dies ist unsere letzte Mahnung für die nachstehende Rechnung. Sollte der offene Betrag nicht innerhalb von 3 Tagen beglichen werden, werden wir ohne weitere Vorankündigung rechtliche Schritte einleiten.

Dies kann zusätzliche Kosten zur Folge haben, die wir Ihnen in Rechnung stellen werden.`,
                closing: 'Hochachtungsvoll',
                urgency: 'danger',
                fee: 50.00
            }
        };
        const template = reminderTemplates[reminderLevel];
        const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24));
        const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${template.title} - ${invoice.number}</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 0; 
          padding: 20mm; 
          font-size: 12px;
          line-height: 1.4;
          color: #333;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e5e5;
        }
        .company-info { flex: 1; }
        .logo { width: 150px; height: 80px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; }
        .reminder-title { 
          font-size: 20px; 
          font-weight: bold; 
          color: ${template.urgency === 'danger' ? '#dc2626' : template.urgency === 'warning' ? '#d97706' : '#2563eb'};
          margin: 30px 0 20px 0;
          text-align: center;
          text-transform: uppercase;
        }
        .customer-address {
          margin: 40px 0;
          line-height: 1.3;
        }
        .reminder-content {
          margin: 30px 0;
          line-height: 1.6;
        }
        .invoice-details {
          margin: 30px 0;
          padding: 20px;
          background-color: #f8f9fa;
          border: 1px solid #ddd;
          border-left: 4px solid ${template.urgency === 'danger' ? '#dc2626' : template.urgency === 'warning' ? '#d97706' : '#2563eb'};
        }
        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .invoice-table th, .invoice-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        .invoice-table th {
          background-color: #f8f9fa;
          font-weight: bold;
        }
        .reminder-fees {
          margin: 20px 0;
          padding: 15px;
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 5px;
        }
        .payment-info {
          margin: 30px 0;
          padding: 20px;
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
        }
        .urgency-${template.urgency} {
          border-left: 4px solid ${template.urgency === 'danger' ? '#dc2626' : template.urgency === 'warning' ? '#d97706' : '#2563eb'};
        }
      </style>
    </head>
    <body>
      <!-- Header with Company Info -->
      <div class="header">
        <div class="company-info">
          <h1>${company.name}</h1>
          <div>${company.address}</div>
          <div>${company.zip} ${company.city}</div>
          <div>Schweiz</div>
          <br>
          <div>E-Mail: ${company.email}</div>
          ${company.phone ? `<div>Tel: ${company.phone}</div>` : ''}
          ${company.uid ? `<div>UID: ${company.uid}</div>` : ''}
        </div>
        <div class="logo">
          ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-width: 220px; max-height: 150px; width: auto; height: auto; object-fit: contain; display: block;">` : ''}
        </div>
      </div>

      <!-- Customer Address -->
      <div class="customer-address">
        <strong>${invoice.customers.name}</strong><br>
        ${invoice.customers.company ? `${invoice.customers.company}<br>` : ''}
        ${invoice.customers.address}<br>
        ${invoice.customers.zip} ${invoice.customers.city}
      </div>

      <!-- Date and Place -->
      <div style="text-align: right; margin: 20px 0;">
        ${company.city}, ${new Date().toLocaleDateString('de-CH')}
      </div>

      <!-- Reminder Title -->
      <div class="reminder-title">${template.title}</div>

      <!-- Subject Line -->
      <div style="font-weight: bold; margin: 20px 0;">
        Betreff: ${template.subject}
      </div>

      <!-- Reminder Content -->
      <div class="reminder-content">
        <p>${template.salutation},</p>
        <p>${template.body}</p>
      </div>

      <!-- Invoice Details -->
      <div class="invoice-details urgency-${template.urgency}">
        <h3 style="margin-top: 0;">📄 Rechnungsdetails</h3>
        <table class="invoice-table">
          <tr>
            <td><strong>Rechnungsnummer:</strong></td>
            <td>${invoice.number}</td>
          </tr>
          <tr>
            <td><strong>Rechnungsdatum:</strong></td>
            <td>${new Date(invoice.date).toLocaleDateString('de-CH')}</td>
          </tr>
          <tr>
            <td><strong>Fälligkeitsdatum:</strong></td>
            <td>${new Date(invoice.due_date).toLocaleDateString('de-CH')}</td>
          </tr>
          <tr>
            <td><strong>Tage überfällig:</strong></td>
            <td style="color: red; font-weight: bold;">${daysOverdue} Tage</td>
          </tr>
          <tr>
            <td><strong>Offener Betrag:</strong></td>
            <td style="font-size: 14px; font-weight: bold;">CHF ${(invoice.total / 100).toFixed(2)}</td>
          </tr>
        </table>
      </div>

      ${template.fee > 0 ? `
      <!-- Reminder Fees -->
      <div class="reminder-fees">
        <h4 style="margin-top: 0;">💰 Mahngebühren</h4>
        <p>Für diese ${template.title} berechnen wir Ihnen eine Bearbeitungsgebühr von <strong>CHF ${template.fee.toFixed(2)}</strong>.</p>
        <p><strong>Neuer Gesamtbetrag: CHF ${(invoice.total + template.fee).toFixed(2)}</strong></p>
      </div>
      ` : ''}

      <!-- Payment Information -->
      <div class="payment-info">
        <h3 style="margin-top: 0;">💳 Zahlungsinformationen</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <div><strong>IBAN:</strong> ${company.iban || 'CH21 0900 0000 1001 5000 6'}</div>
            <div><strong>Referenz:</strong> ${invoice.qr_reference}</div>
            <div><strong>Betrag:</strong> CHF ${(invoice.total + template.fee).toFixed(2)}</div>
          </div>
          <div>
            <div><strong>Empfänger:</strong> ${company.name}</div>
            <div><strong>Zahlbar bis:</strong> ${new Date(Date.now() + (reminderLevel === 3 ? 3 : reminderLevel === 2 ? 5 : 10) * 24 * 60 * 60 * 1000).toLocaleDateString('de-CH')}</div>
          </div>
        </div>
      </div>

      <!-- Closing -->
      <div style="margin: 40px 0 20px 0;">
        <p>${template.closing}</p>
        <br>
        <p><strong>${company.name}</strong></p>
      </div>

      <!-- Footer -->
      <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; color: #666; text-align: center;">
        ${template.title} generiert am ${new Date().toLocaleDateString('de-CH')} um ${new Date().toLocaleTimeString('de-CH')}
        <br>
        ${reminderLevel === 3 ? '⚠️ LETZTE MAHNUNG - Bei Nichtzahlung erfolgt Inkasso' : `Mahnstufe ${reminderLevel} von 3`}
      </div>
    </body>
    </html>
    `;
        try {
            const htmlPdf = require('html-pdf-node');
            console.log(`Starting reminder PDF generation for invoice: ${invoice.number}, level: ${reminderLevel}`);
            const options = {
                format: 'A4',
                margin: {
                    top: '20mm',
                    bottom: '20mm',
                    left: '20mm',
                    right: '20mm'
                },
                printBackground: true,
                displayHeaderFooter: false,
                timeout: 10000
            };
            const file = { content: htmlTemplate };
            const pdfBuffer = await htmlPdf.generatePdf(file, options);
            console.log('Reminder PDF generated successfully, size:', pdfBuffer.length);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Mahnung-${reminderLevel}-${invoice.number}.pdf"`);
            res.setHeader('Content-Length', pdfBuffer.length.toString());
            res.send(pdfBuffer);
        }
        catch (pdfError) {
            console.error('Reminder PDF generation error:', pdfError);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(htmlTemplate + `
        <br><br>
        <div style="color: red; background: #ffe6e6; padding: 10px; border: 1px solid red; margin: 20px;">
          <strong>PDF Generation Failed:</strong> ${pdfError?.message || 'Unknown error'}<br>
          Showing HTML version instead.
        </div>
      `);
        }
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'generate reminder PDF');
    }
});
exports.updateInvoice = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const invoiceId = req.params.id;
    const updateData = req.body;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: existingInvoice, error: invoiceError } = await supabase_1.db.invoices()
            .select('id, company_id')
            .eq('id', invoiceId)
            .eq('company_id', companyId)
            .single();
        if (invoiceError || !existingInvoice) {
            res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
            return;
        }
        const updateFields = {};
        if (updateData.status) {
            updateFields.status = updateData.status;
        }
        if (updateData.customerId) {
            updateFields.customer_id = updateData.customerId;
        }
        if (updateData.date) {
            updateFields.date = updateData.date;
        }
        if (updateData.dueDate) {
            updateFields.due_date = updateData.dueDate;
        }
        if (updateData.discountCode !== undefined) {
            updateFields.discount_code = updateData.discountCode;
        }
        if (updateData.discountAmount !== undefined) {
            updateFields.discount_amount = updateData.discountAmount;
        }
        if (updateData.internalNotes !== undefined) {
            updateFields.internal_notes = updateData.internalNotes;
        }
        const { data: updatedInvoice, error: updateError } = await supabase_1.db.invoices()
            .update(updateFields)
            .eq('id', invoiceId)
            .eq('company_id', companyId)
            .select('*')
            .single();
        if (updateError) {
            res.status(400).json({
                success: false,
                error: 'Failed to update invoice'
            });
            return;
        }
        if (updateData.items && Array.isArray(updateData.items)) {
            await supabase_1.db.invoiceItems()
                .delete()
                .eq('invoice_id', invoiceId);
            const itemsToInsert = updateData.items.map((item, index) => ({
                invoice_id: invoiceId,
                description: item.description,
                quantity: Math.round(item.quantity * 1000),
                unit: item.unit || 'Stück',
                unit_price: Math.round(item.unitPrice * 100),
                discount: Math.round((item.discount || 0) * 100),
                vat_rate: Math.round(item.vatRate * 100),
                line_total: Math.round(item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100) * 100),
                vat_amount: Math.round(item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100) * (item.vatRate / 100) * 100),
                sort_order: index
            }));
            const { error: itemsError } = await supabase_1.db.invoiceItems()
                .insert(itemsToInsert);
            if (itemsError) {
                res.status(400).json({
                    success: false,
                    error: 'Failed to update invoice items'
                });
                return;
            }
            const { data: items } = await supabase_1.db.invoiceItems()
                .select('line_total, vat_amount')
                .eq('invoice_id', invoiceId);
            const subtotal = items?.reduce((sum, item) => sum + item.line_total, 0) || 0;
            const vatAmount = items?.reduce((sum, item) => sum + item.vat_amount, 0) || 0;
            const total = subtotal + vatAmount - (updateData.discountAmount || 0);
            await supabase_1.db.invoices()
                .update({
                subtotal,
                vat_amount: vatAmount,
                total
            })
                .eq('id', invoiceId);
        }
        res.json({
            success: true,
            data: {
                invoice: createInvoiceResponse(updatedInvoice)
            }
        });
    }
    catch (error) {
        console.error('Error updating invoice:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.deleteInvoice = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: invoice, error: fetchError } = await supabase_1.db.invoices()
            .select('id, internal_notes, number')
            .eq('id', id)
            .eq('company_id', companyId)
            .single();
        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
                return;
            }
            (0, supabase_1.handleSupabaseError)(fetchError, 'fetch invoice for deletion');
            return;
        }
        if (invoice && invoice.internal_notes) {
            try {
                const notesData = JSON.parse(invoice.internal_notes);
                if (notesData && Array.isArray(notesData.files) && notesData.files.length > 0) {
                    const filePaths = notesData.files
                        .map((file) => file.filePath)
                        .filter((path) => path);
                    if (filePaths.length > 0) {
                        console.log(`Deleting ${filePaths.length} file(s) for invoice ${invoice.number}:`, filePaths);
                        const { data: deleteData, error: storageError } = await supabase_1.supabaseAdmin.storage
                            .from('invoices')
                            .remove(filePaths);
                        if (storageError) {
                            console.error('Error deleting files from storage:', storageError);
                        }
                        else {
                            console.log('Successfully deleted files from storage:', deleteData);
                        }
                    }
                }
            }
            catch (parseError) {
                console.error('Error parsing internal_notes for file deletion:', parseError);
            }
        }
        const { error: deleteError } = await supabase_1.db.invoices()
            .delete()
            .eq('id', id)
            .eq('company_id', companyId);
        if (deleteError) {
            (0, supabase_1.handleSupabaseError)(deleteError, 'delete invoice');
            return;
        }
        console.log(`Invoice ${invoice.number} deleted successfully`);
        res.json({
            success: true,
            message: 'Invoice deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting invoice:', error);
        (0, supabase_1.handleSupabaseError)(error, 'delete invoice');
    }
});
//# sourceMappingURL=invoiceController.js.map