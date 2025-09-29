"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInvoice = exports.updateInvoice = exports.generateInvoicePdf = exports.getInvoiceStats = exports.updateInvoiceStatus = exports.createInvoice = exports.getInvoice = exports.getInvoices = void 0;
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
        const calculatedDueDate = dueDate || new Date(Date.now() + customer.payment_terms * 24 * 60 * 60 * 1000);
        let subtotal = 0;
        let vatTotal = 0;
        let discountAmount = 0;
        const processedItems = items.map((item, index) => {
            const lineTotal = Math.round(item.quantity * item.unitPrice * (1 - (item.discount || 0) / 10000));
            const vatAmount = Math.round(lineTotal * (item.vatRate || 0) / 10000);
            subtotal += lineTotal;
            vatTotal += vatAmount;
            return {
                description: item.description,
                quantity: item.quantity,
                unit: item.unit || 'Stk',
                unit_price: item.unitPrice,
                discount: item.discount || 0,
                vat_rate: item.vatRate || 0,
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
            date: date.toISOString().split('T')[0],
            due_date: calculatedDueDate.toISOString().split('T')[0],
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
            const itemsWithInvoiceId = processedItems.map(item => ({
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
exports.generateInvoicePdf = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.status(501).json({
        success: false,
        error: 'PDF generation not implemented yet'
    });
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
//# sourceMappingURL=invoiceControllerSupabase.js.map