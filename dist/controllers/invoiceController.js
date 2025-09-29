"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInvoice = exports.updateInvoice = exports.generateReminderPdf = exports.sendInvoiceReminder = exports.generateInvoicePdf = exports.generateInvoiceQR = exports.getInvoiceStats = exports.updateInvoiceStatus = exports.createInvoice = exports.getInvoice = exports.getInvoices = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
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
        subtotal: dbInvoice.subtotal,
        vatAmount: dbInvoice.vat_amount,
        total: dbInvoice.total,
        paidAmount: dbInvoice.paid_amount,
        qrReference: dbInvoice.qr_reference,
        reminderLevel: dbInvoice.reminder_level,
        lastReminderAt: dbInvoice.last_reminder_at ? new Date(dbInvoice.last_reminder_at) : undefined,
        sentAt: dbInvoice.sent_at ? new Date(dbInvoice.sent_at) : undefined,
        emailSentCount: dbInvoice.email_sent_count,
        discountCode: dbInvoice.discount_code || undefined,
        discountAmount: dbInvoice.discount_amount,
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
        quantity: dbItem.quantity,
        unit: dbItem.unit,
        unitPrice: dbItem.unit_price,
        discount: dbItem.discount,
        vatRate: dbItem.vat_rate,
        lineTotal: dbItem.line_total,
        vatAmount: dbItem.vat_amount,
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
    const limit = parseInt(req.query.limit) || 10;
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
            query = query.or(`number.ilike.%${search}%,customers.name.ilike.%${search}%`);
        }
        const ascending = sortOrder === 'asc';
        query = query.order(sortBy, { ascending });
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);
        const { data, error, count } = await query;
        if (error) {
            (0, supabase_1.handleSupabaseError)(error, 'get invoices');
            return;
        }
        const invoices = data.map(invoice => createInvoiceResponse(invoice, invoice.customers));
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
        const invoice = createInvoiceResponse(invoiceData, invoiceData.customers, invoiceData.companies, invoiceData.invoice_items);
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
            const lineTotal = Math.round(item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100));
            const vatAmount = Math.round(lineTotal * (item.vatRate || 0) / 100);
            subtotal += lineTotal;
            vatTotal += vatAmount;
            return {
                description: item.description,
                quantity: item.quantity,
                unit: item.unit || 'Stk',
                unit_price: item.unitPrice,
                discount: Math.round((item.discount || 0) * 100),
                vat_rate: Math.round((item.vatRate || 0) * 100),
                line_total: lineTotal,
                vat_amount: vatAmount,
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
                discountAmount = Math.round(subtotal * discount.percentage / 10000);
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
            subtotal,
            vat_amount: vatTotal,
            total,
            paid_amount: 0,
            reminder_level: 0,
            email_sent_count: 0,
            discount_code: discountCode || null,
            discount_amount: discountAmount
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
        const { data: completeInvoice } = await supabase_1.db.invoices()
            .select(`
        *,
        customers (*),
        companies (*),
        invoice_items (*)
      `)
            .eq('id', newInvoice.id)
            .single();
        const invoice = createInvoiceResponse(completeInvoice, completeInvoice.customers, completeInvoice.companies, completeInvoice.invoice_items);
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
          ${company.logo_url ? `<img src="${company.logo_url}" alt="Logo" style="max-width: 100%; max-height: 100%;">` : '[LOGO]'}
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
                timeout: 10000,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                waitForSelector: 'body',
                omitBackground: false
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
          id, name, company, email
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
        if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
            res.status(400).json({
                success: false,
                error: 'Cannot send reminder for paid or cancelled invoice'
            });
            return;
        }
        if (level < 1 || level > 3 || level <= (invoice.reminder_level || 0)) {
            res.status(400).json({
                success: false,
                error: 'Invalid reminder level'
            });
            return;
        }
        if (invoice.last_reminder_at) {
            const lastReminder = new Date(invoice.last_reminder_at);
            const now = new Date();
            const hoursSinceLastReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastReminder < 24) {
                res.status(400).json({
                    success: false,
                    error: 'Reminder cooldown active (24h minimum between reminders)'
                });
                return;
            }
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
        console.log(`Reminder ${level} sent for invoice ${invoice.number} to ${invoice.customers.email}`);
        res.json({
            success: true,
            message: `Reminder ${level} sent successfully`,
            data: {
                invoice: updatedInvoice,
                reminderLevel: level,
                sentTo: invoice.customers.email,
                sentAt: new Date().toISOString()
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
          ${company.logo_url ? `<img src="${company.logo_url}" alt="Logo" style="max-width: 100%; max-height: 100%;">` : '[LOGO]'}
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
        <p><strong>Neuer Gesamtbetrag: CHF ${((invoice.total / 100) + template.fee).toFixed(2)}</strong></p>
      </div>
      ` : ''}

      <!-- Payment Information -->
      <div class="payment-info">
        <h3 style="margin-top: 0;">💳 Zahlungsinformationen</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <div><strong>IBAN:</strong> ${company.iban || 'CH21 0900 0000 1001 5000 6'}</div>
            <div><strong>Referenz:</strong> ${invoice.qr_reference}</div>
            <div><strong>Betrag:</strong> CHF ${((invoice.total / 100) + template.fee).toFixed(2)}</div>
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
    res.status(501).json({
        success: false,
        error: 'Invoice update not implemented yet'
    });
});
exports.deleteInvoice = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.status(501).json({
        success: false,
        error: 'Invoice deletion not implemented yet'
    });
});
//# sourceMappingURL=invoiceController.js.map