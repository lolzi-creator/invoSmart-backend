"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInvoice = exports.updateInvoice = exports.generateReminderPdf = exports.sendInvoiceReminder = exports.generateInvoicePdf = exports.generateInvoiceQR = exports.getInvoiceStats = exports.updateInvoiceStatus = exports.createInvoice = exports.getInvoice = exports.getInvoices = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const supabase_1 = require("../lib/supabase");
const auditController_1 = require("./auditController");
const emailService_1 = require("../services/emailService");
const pdfTemplates_1 = require("../utils/pdfTemplates");
const generateAndSaveInvoicePdf = async (invoice, company, customer) => {
    try {
        console.log('📄 Generating PDF for invoice:', invoice.number);
        let logoBase64 = null;
        if (company.logo_url) {
            try {
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
                if (logoPath) {
                    const { data: logoData, error: logoError } = await supabase_1.supabaseAdmin.storage
                        .from('logos')
                        .download(logoPath);
                    if (!logoError && logoData) {
                        const logoBuffer = Buffer.from(await logoData.arrayBuffer());
                        const logoMimeType = logoData.type || 'image/png';
                        logoBase64 = `data:${logoMimeType};base64,${logoBuffer.toString('base64')}`;
                    }
                }
            }
            catch (logoFetchError) {
                console.error('❌ Error fetching logo for PDF:', logoFetchError);
            }
        }
        const { referenceType, iban } = getReferenceTypeAndIban(invoice.qr_reference, company);
        const QRCode = require('qrcode');
        const qrPayload = [
            'SPC', '0200', '1',
            iban,
            'S', company.name, company.address, '', company.zip, company.city, 'CH',
            '', '', '', '', '', '', '',
            (invoice.total / 100).toFixed(2), 'CHF',
            'S', customer.name,
            customer.address, '',
            customer.zip, customer.city,
            customer.country || 'CH',
            referenceType,
            invoice.qr_reference,
            `Invoice ${invoice.number}`,
            'EPD'
        ].join('\n');
        const qrCodeImage = await QRCode.toDataURL(qrPayload, {
            type: 'image/png',
            width: 140,
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' }
        });
        const { data: invoiceItems } = await supabase_1.db.invoiceItems()
            .select('*')
            .eq('invoice_id', invoice.id)
            .order('sort_order', { ascending: true });
        const templateLanguage = ((invoice.customers?.language ?? customer.language) ?? company.default_language ?? 'de').toLowerCase();
        const htmlTemplate = (0, pdfTemplates_1.generateUnifiedInvoicePdfTemplate)({
            invoice: {
                number: invoice.number,
                date: invoice.date,
                due_date: invoice.due_date,
                service_date: invoice.service_date,
                qr_reference: invoice.qr_reference,
                subtotal: invoice.subtotal,
                discount_amount: invoice.discount_amount,
                vat_amount: invoice.vat_amount,
                total: invoice.total,
                invoice_items: invoiceItems || []
            },
            customer: {
                name: customer.name,
                company: customer.company,
                address: customer.address,
                zip: customer.zip,
                city: customer.city,
                country: customer.country,
                email: customer.email,
                phone: customer.phone,
                payment_terms: customer.payment_terms
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
            referenceType,
            iban,
            language: templateLanguage
        });
        const htmlPdf = require('html-pdf-node');
        const options = {
            format: 'A4',
            margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
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
        };
        const file = { content: htmlTemplate };
        const pdfBuffer = await htmlPdf.generatePdf(file, options);
        const sanitizeForPath = (name) => {
            return name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        };
        const companyName = sanitizeForPath(company.name || 'Company');
        const customerName = sanitizeForPath(customer.name || 'Customer');
        const invoiceNumber = sanitizeForPath(invoice.number);
        const fileName = `Invoice-${invoice.number}.pdf`;
        const filePath = `${companyName}/${customerName}/${invoiceNumber}/${fileName}`;
        const { data: uploadData, error: uploadError } = await supabase_1.supabaseAdmin.storage
            .from('invoices')
            .upload(filePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true
        });
        if (uploadError) {
            console.error('❌ Failed to upload PDF to storage:', uploadError);
            return null;
        }
        console.log('✅ PDF uploaded successfully:', uploadData.path);
        const fileInfo = {
            id: crypto.randomUUID(),
            fileName: fileName,
            filePath: uploadData.path,
            fileType: 'invoice_pdf',
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
            notesData = { files: [] };
        }
        if (!notesData.files) {
            notesData.files = [];
        }
        notesData.files = notesData.files.filter((f) => f.fileType !== 'invoice_pdf');
        notesData.files.push(fileInfo);
        await supabase_1.db.invoices()
            .update({
            internal_notes: JSON.stringify(notesData)
        })
            .eq('id', invoice.id);
        console.log('📄 PDF file record stored in invoice');
        return uploadData.path;
    }
    catch (error) {
        console.error('❌ Error generating and saving invoice PDF:', error);
        return null;
    }
};
const getReferenceTypeAndIban = (reference, company) => {
    const isQRReference = /^\d{27}$/.test(reference);
    const isSCORReference = /^RF\d{2}\d+$/.test(reference);
    if (isQRReference) {
        if (!company.qr_iban || !company.qr_iban.trim()) {
            throw new Error('QR reference requires QR-IBAN, but company has no QR-IBAN configured');
        }
        return {
            referenceType: 'QRR',
            iban: company.qr_iban.replace(/\s/g, '')
        };
    }
    else if (isSCORReference) {
        if (!company.iban || !company.iban.trim()) {
            throw new Error('SCOR reference requires normal IBAN, but company has no IBAN configured');
        }
        return {
            referenceType: 'SCOR',
            iban: company.iban.replace(/\s/g, '')
        };
    }
    else {
        throw new Error(`Invalid reference format: must be 27-digit numeric (QR) or start with RF (SCOR), got: ${reference}`);
    }
};
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
        serviceDate: new Date(dbInvoice.service_date),
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
    const { customerId, date = new Date(), dueDate, serviceDate, items = [], notes, discountCode } = req.body;
    if (!serviceDate) {
        res.status(400).json({
            success: false,
            error: 'Leistungsdatum ist zwingend erforderlich für die MWST-Abrechnung'
        });
        return;
    }
    try {
        const { data: company, error: companyError } = await supabase_1.db.companies()
            .select('id, qr_iban, iban')
            .eq('id', companyId)
            .single();
        if (companyError || !company) {
            res.status(404).json({
                success: false,
                error: 'Company not found'
            });
            return;
        }
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
        const { reference: paymentReference } = await (0, supabase_1.generatePaymentReference)(invoiceNumber, companyId, company);
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
            qr_reference: paymentReference,
            status: 'DRAFT',
            date: typeof date === 'string' ? date : date.toISOString().split('T')[0],
            due_date: typeof calculatedDueDate === 'string' ? calculatedDueDate : calculatedDueDate.toISOString().split('T')[0],
            service_date: typeof serviceDate === 'string' ? serviceDate : new Date(serviceDate).toISOString().split('T')[0],
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
            const { data: companyForPdf } = await supabase_1.db.companies()
                .select('*')
                .eq('id', companyId)
                .single();
            if (companyForPdf && completeInvoice.customers) {
                await generateAndSaveInvoicePdf(completeInvoice, companyForPdf, completeInvoice.customers);
            }
        }
        catch (pdfError) {
            console.error('❌ Error generating PDF on invoice creation:', pdfError);
        }
        try {
            await (0, auditController_1.createAuditLog)(companyId, req.user.id, req.user.name, 'INVOICE_CREATED', 'INVOICE', invoice.id, {
                invoiceNumber: invoice.number,
                customerId: invoice.customerId,
                customerName: invoice.customer?.name,
                total: invoice.total,
                status: invoice.status
            }, req.ip, req.get('User-Agent'));
        }
        catch (auditError) {
            console.error('Error creating audit log:', auditError);
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
        if (status === 'OPEN') {
            try {
                const { data: fullInvoice, error: fetchError } = await supabase_1.db.invoices()
                    .select(`*, customers (*), companies (*), invoice_items (*)`)
                    .eq('id', invoiceId)
                    .eq('company_id', companyId)
                    .single();
                if (!fetchError && fullInvoice && fullInvoice.customers && fullInvoice.companies) {
                    await generateAndSaveInvoicePdf(fullInvoice, fullInvoice.companies, fullInvoice.customers);
                    if (fullInvoice.customers.email) {
                        const emailService = emailService_1.EmailService.getInstance();
                        const result = await emailService.sendInvoiceNotification({
                            invoice: fullInvoice,
                            customer: fullInvoice.customers,
                            company: fullInvoice.companies
                        });
                        if (result?.success) {
                            await supabase_1.db.invoices()
                                .update({
                                sent_at: new Date().toISOString(),
                                email_sent_count: (data.email_sent_count || 0) + 1
                            })
                                .eq('id', invoiceId)
                                .eq('company_id', companyId);
                        }
                        else {
                            console.warn('Email send failed on status OPEN:', result?.error);
                        }
                    }
                }
                else {
                    console.warn('Invoice/customer/company data not ready for PDF generation and email on OPEN', fetchError);
                }
            }
            catch (error) {
                console.error('Error generating PDF and sending email on status OPEN:', error);
            }
        }
        try {
            await (0, auditController_1.createAuditLog)(companyId, req.user.id, req.user.name, 'INVOICE_STATUS_UPDATED', 'INVOICE', invoiceId, {
                invoiceNumber: data.number,
                oldStatus: data.status,
                newStatus: status
            }, req.ip, req.get('User-Agent'));
        }
        catch (auditError) {
            console.error('Error creating audit log:', auditError);
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
        const { referenceType, iban } = getReferenceTypeAndIban(invoice.qr_reference, company);
        const qrData = {
            qrType: 'SPC',
            version: '0200',
            codingType: '1',
            iban: iban,
            creditor: {
                addressType: 'S',
                name: company.name,
                street: company.address,
                houseNumber: '',
                postalCode: company.zip,
                town: company.city,
                country: company.country || 'CH'
            },
            amount: (invoice.total / 100).toFixed(2),
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
            referenceType: referenceType,
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
                iban,
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
                referenceType,
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
        const { referenceType, iban } = getReferenceTypeAndIban(invoice.qr_reference, company);
        const QRCode = require('qrcode');
        const paymentReference = invoice.qr_reference;
        const qrPayload = [
            'SPC',
            '0200',
            '1',
            iban,
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
            referenceType,
            paymentReference,
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
        const templateLanguage = (invoice.customers.language || company.default_language || 'de').toLowerCase();
        const htmlTemplate = (0, pdfTemplates_1.generateUnifiedInvoicePdfTemplate)({
            invoice: {
                number: invoice.number,
                date: invoice.date,
                due_date: invoice.due_date,
                service_date: invoice.service_date,
                qr_reference: invoice.qr_reference,
                subtotal: invoice.subtotal,
                discount_amount: invoice.discount_amount,
                vat_amount: invoice.vat_amount,
                total: invoice.total,
                invoice_items: invoice.invoice_items || []
            },
            customer: {
                name: invoice.customers.name,
                company: invoice.customers.company,
                address: invoice.customers.address,
                zip: invoice.customers.zip,
                city: invoice.customers.city,
                country: invoice.customers.country,
                email: invoice.customers.email,
                phone: invoice.customers.phone,
                payment_terms: invoice.customers.payment_terms
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
            paymentReference,
            referenceType,
            iban,
            language: templateLanguage
        });
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
            console.log(`🎨 Generating professional reminder PDF (Level ${level}) for invoice: ${invoice.number}`);
            let logoBase64 = null;
            if (company.logo_url) {
                try {
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
                            console.log('✅ Logo converted to base64 for reminder');
                        }
                    }
                }
                catch (logoFetchError) {
                    console.error('❌ Error fetching logo for reminder:', logoFetchError);
                }
            }
            const reminderFees = { 1: 0, 2: 20.00, 3: 50.00 };
            const reminderFee = reminderFees[level];
            const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24));
            const { referenceType, iban } = getReferenceTypeAndIban(invoice.qr_reference, company);
            const remainingAmount = invoice.total - (invoice.paid_amount || 0);
            const totalWithFee = remainingAmount + (reminderFee * 100);
            const QRCode = require('qrcode');
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
            ].join('\r\n');
            const qrCodeImage = await QRCode.toDataURL(qrPayload, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                width: 300,
                margin: 1
            });
            const htmlTemplate = (0, pdfTemplates_1.generateReminderPdfTemplate)({
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
                referenceType: referenceType,
                iban: iban || company.iban || '',
                reminderLevel: level,
                reminderFee,
                daysOverdue,
                language: (invoice.customers.language || company.default_language || 'de').toLowerCase()
            });
            const htmlPdf = require('html-pdf-node');
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
            };
            const file = { content: htmlTemplate };
            console.log(`📄 Generating PDF for reminder level ${level}...`);
            pdfBuffer = await htmlPdf.generatePdf(file, options);
            if (pdfBuffer) {
                console.log(`✅ PDF generated: ${pdfBuffer.length} bytes`);
            }
            const sanitizeForPath = (name) => {
                return name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            };
            const companyName = sanitizeForPath(company.name || 'Company');
            const customerName = sanitizeForPath(invoice.customers.name || 'Customer');
            const invoiceNumber = sanitizeForPath(invoice.number);
            const fileName = `Reminder-${level}-${invoice.number}.pdf`;
            const filePath = `${companyName}/${customerName}/${invoiceNumber}/${fileName}`;
            if (pdfBuffer && pdfBuffer.length > 0) {
                const { data: uploadData, error: uploadError } = await supabase_1.supabaseAdmin.storage
                    .from('invoices')
                    .upload(filePath, pdfBuffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });
                if (uploadError) {
                    console.error('❌ Error uploading reminder PDF to storage:', uploadError);
                }
                else {
                    console.log('✅ Reminder PDF uploaded successfully:', filePath);
                    pdfFilePath = filePath;
                    const existingNotes = invoice.internal_notes ? JSON.parse(invoice.internal_notes) : {};
                    const updatedNotes = {
                        ...existingNotes,
                        files: {
                            ...(existingNotes.files || {}),
                            [`reminder_${level}`]: filePath
                        }
                    };
                    await supabase_1.db.invoices()
                        .update({ internal_notes: JSON.stringify(updatedNotes) })
                        .eq('id', invoiceId);
                }
            }
        }
        catch (pdfError) {
            console.error('❌ Error generating reminder PDF:', pdfError);
        }
        const { data: updatedInvoice, error: updateError } = await supabase_1.db.invoices()
            .update({
            reminder_level: level,
            last_reminder_at: new Date().toISOString()
        })
            .eq('id', invoiceId)
            .select()
            .single();
        if (updateError) {
            console.error('❌ Error updating invoice:', updateError);
            res.status(500).json({
                success: false,
                error: 'Failed to update invoice reminder level'
            });
            return;
        }
        console.log('✅ Invoice updated with reminder level:', level);
        const { data: invoiceWithPdf, error: fetchError } = await supabase_1.db.invoices()
            .select(`
        *,
        customers (
          id, name, company, email, address, zip, city, country, phone
        )
      `)
            .eq('id', invoiceId)
            .single();
        if (fetchError || !invoiceWithPdf) {
            console.error('❌ Error fetching updated invoice:', fetchError);
        }
        try {
            console.log('📧 Sending reminder email to:', invoice.customers.email);
            const emailService = emailService_1.EmailService.getInstance();
            await emailService.sendInvoiceReminder({
                invoice: (invoiceWithPdf || invoice),
                customer: invoice.customers,
                company: company,
                reminderLevel: level
            });
            console.log('✅ Reminder email sent successfully');
            res.status(200).json({
                success: true,
                data: {
                    invoice: updatedInvoice,
                    reminderLevel: level,
                    emailSent: true
                }
            });
        }
        catch (emailError) {
            console.error('❌ Error sending reminder email:', emailError);
            res.status(500).json({
                success: false,
                error: 'Reminder level updated but failed to send email: ' + emailError.message
            });
        }
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
        const reminderFees = {
            1: 0,
            2: 20.00,
            3: 50.00
        };
        const reminderFee = reminderFees[reminderLevel];
        const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24));
        const getReferenceTypeAndIban = (qrReference, company) => {
            const referenceType = qrReference.startsWith('RF') ? 'SCOR' : 'QRR';
            const iban = referenceType === 'QRR' ? company.qr_iban : company.iban;
            return { referenceType, iban };
        };
        const { referenceType, iban } = getReferenceTypeAndIban(invoice.qr_reference, company);
        const remainingAmount = invoice.total - (invoice.paid_amount || 0);
        const totalWithFee = remainingAmount + (reminderFee * 100);
        const QRCode = require('qrcode');
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
            `Mahnung ${reminderLevel} - Rechnung ${invoice.number}`,
            'EPD'
        ].join('\r\n');
        const qrCodeImage = await QRCode.toDataURL(qrPayload, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            width: 300,
            margin: 1
        });
        const htmlTemplate = (0, pdfTemplates_1.generateReminderPdfTemplate)({
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
            referenceType: referenceType,
            iban: iban || company.iban || '',
            reminderLevel: reminderLevel,
            reminderFee,
            daysOverdue,
            language: (invoice.customers.language || company.default_language || 'de').toLowerCase()
        });
        try {
            const htmlPdf = require('html-pdf-node');
            console.log(`Starting reminder PDF generation for invoice: ${invoice.number}, level: ${reminderLevel}`);
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
            };
            const file = { content: htmlTemplate };
            const pdfBuffer = await htmlPdf.generatePdf(file, options);
            console.log('✅ Reminder PDF generated successfully, size:', pdfBuffer.length);
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
        if (updateData.serviceDate) {
            updateFields.service_date = typeof updateData.serviceDate === 'string'
                ? updateData.serviceDate
                : new Date(updateData.serviceDate).toISOString().split('T')[0];
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
        try {
            await (0, auditController_1.createAuditLog)(companyId, req.user.id, req.user.name, 'INVOICE_DELETED', 'INVOICE', id, {
                invoiceNumber: invoice.number
            }, req.ip, req.get('User-Agent'));
        }
        catch (auditError) {
            console.error('Error creating audit log:', auditError);
        }
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