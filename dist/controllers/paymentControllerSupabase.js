"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePayment = exports.updatePayment = exports.getPaymentStats = exports.importPayments = exports.matchPayment = exports.createPayment = exports.getPayment = exports.getPayments = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const supabase_1 = require("../lib/supabase");
const createPaymentResponse = (dbPayment) => {
    return {
        id: dbPayment.id,
        invoiceId: dbPayment.invoice_id || undefined,
        companyId: dbPayment.company_id,
        amount: dbPayment.amount,
        valueDate: new Date(dbPayment.value_date),
        reference: dbPayment.reference || undefined,
        description: dbPayment.description || undefined,
        confidence: dbPayment.confidence,
        isMatched: dbPayment.is_matched,
        importBatch: dbPayment.import_batch || undefined,
        rawData: dbPayment.raw_data,
        notes: dbPayment.notes || undefined,
        createdAt: new Date(dbPayment.created_at),
        updatedAt: new Date(dbPayment.updated_at)
    };
};
const findMatchingInvoice = async (payment, companyId) => {
    if (payment.reference) {
        const { data: qrInvoice } = await supabase_1.db.invoices()
            .select('*')
            .eq('company_id', companyId)
            .eq('qr_reference', payment.reference.replace(/\s/g, ''))
            .single();
        if (qrInvoice) {
            return { invoice: qrInvoice, confidence: 'HIGH' };
        }
    }
    const dayBefore = new Date(payment.value_date);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayAfter = new Date(payment.value_date);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const { data: amountDateInvoices } = await supabase_1.db.invoices()
        .select('*')
        .eq('company_id', companyId)
        .eq('total', payment.amount)
        .gte('due_date', dayBefore.toISOString().split('T')[0])
        .lte('due_date', dayAfter.toISOString().split('T')[0])
        .in('status', ['OPEN', 'PARTIAL_PAID', 'OVERDUE']);
    if (amountDateInvoices && amountDateInvoices.length === 1) {
        return {
            invoice: amountDateInvoices[0],
            confidence: 'MEDIUM'
        };
    }
    const { data: amountInvoices } = await supabase_1.db.invoices()
        .select('*')
        .eq('company_id', companyId)
        .eq('total', payment.amount)
        .in('status', ['OPEN', 'PARTIAL_PAID', 'OVERDUE']);
    if (amountInvoices && amountInvoices.length === 1) {
        return {
            invoice: amountInvoices[0],
            confidence: 'LOW'
        };
    }
    return { confidence: 'MANUAL' };
};
const updateInvoiceAfterPayment = async (invoiceId) => {
    const { data: invoice } = await supabase_1.db.invoices()
        .select('total, paid_amount')
        .eq('id', invoiceId)
        .single();
    if (!invoice)
        return;
    const { data: payments } = await supabase_1.db.payments()
        .select('amount')
        .eq('invoice_id', invoiceId)
        .eq('is_matched', true);
    const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    let newStatus = 'OPEN';
    if (totalPaid >= invoice.total) {
        newStatus = 'PAID';
    }
    else if (totalPaid > 0) {
        newStatus = 'PARTIAL_PAID';
    }
    await supabase_1.db.invoices()
        .update({
        paid_amount: totalPaid,
        status: newStatus
    })
        .eq('id', invoiceId);
};
exports.getPayments = (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
    const isMatched = req.query.isMatched === 'true' ? true : req.query.isMatched === 'false' ? false : undefined;
    const confidence = req.query.confidence;
    const sortBy = req.query.sortBy || 'value_date';
    const sortOrder = req.query.sortOrder || 'desc';
    try {
        let query = supabase_1.db.payments()
            .select('*', { count: 'exact' })
            .eq('company_id', companyId);
        if (isMatched !== undefined) {
            query = query.eq('is_matched', isMatched);
        }
        if (confidence) {
            query = query.eq('confidence', confidence);
        }
        const ascending = sortOrder === 'asc';
        query = query.order(sortBy, { ascending });
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);
        const { data, error, count } = await query;
        if (error) {
            (0, supabase_1.handleSupabaseError)(error, 'get payments');
            return;
        }
        const payments = data.map(createPaymentResponse);
        res.json({
            success: true,
            data: {
                payments,
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
        (0, supabase_1.handleSupabaseError)(error, 'get payments');
    }
});
exports.getPayment = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const paymentId = req.params.id;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data, error } = await supabase_1.db.payments()
            .select('*')
            .eq('id', paymentId)
            .eq('company_id', companyId)
            .single();
        if (error || !data) {
            res.status(404).json({
                success: false,
                error: 'Payment not found'
            });
            return;
        }
        const payment = createPaymentResponse(data);
        res.json({
            success: true,
            data: { payment }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'get payment');
    }
});
exports.createPayment = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    const { amount, valueDate = new Date(), reference, description, notes } = req.body;
    try {
        const paymentData = {
            company_id: companyId,
            amount,
            value_date: new Date(valueDate).toISOString().split('T')[0],
            reference: reference || null,
            description: description || null,
            confidence: 'MANUAL',
            is_matched: false,
            notes: notes || null,
            raw_data: null
        };
        const { data: newPayment, error: createError } = await supabase_1.db.payments()
            .insert(paymentData)
            .select()
            .single();
        if (createError || !newPayment) {
            (0, supabase_1.handleSupabaseError)(createError, 'create payment');
            return;
        }
        const matchResult = await findMatchingInvoice(newPayment, companyId);
        if (matchResult.invoice) {
            const { data: updatedPayment } = await supabase_1.db.payments()
                .update({
                invoice_id: matchResult.invoice.id,
                confidence: matchResult.confidence,
                is_matched: true
            })
                .eq('id', newPayment.id)
                .select()
                .single();
            await updateInvoiceAfterPayment(matchResult.invoice.id);
            const payment = createPaymentResponse(updatedPayment);
            res.status(201).json({
                success: true,
                message: `Payment created and automatically matched with ${matchResult.confidence.toLowerCase()} confidence`,
                data: { payment }
            });
        }
        else {
            const payment = createPaymentResponse(newPayment);
            res.status(201).json({
                success: true,
                message: 'Payment created but no automatic match found',
                data: { payment }
            });
        }
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'create payment');
    }
});
exports.matchPayment = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const paymentId = req.params.id;
    const { invoiceId } = req.body;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: payment, error: paymentError } = await supabase_1.db.payments()
            .select('*')
            .eq('id', paymentId)
            .eq('company_id', companyId)
            .single();
        if (paymentError || !payment) {
            res.status(404).json({
                success: false,
                error: 'Payment not found'
            });
            return;
        }
        const { data: invoice, error: invoiceError } = await supabase_1.db.invoices()
            .select('*')
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
        const { data: updatedPayment, error: updateError } = await supabase_1.db.payments()
            .update({
            invoice_id: invoiceId,
            confidence: 'MANUAL',
            is_matched: true
        })
            .eq('id', paymentId)
            .select()
            .single();
        if (updateError || !updatedPayment) {
            (0, supabase_1.handleSupabaseError)(updateError, 'match payment');
            return;
        }
        await updateInvoiceAfterPayment(invoiceId);
        const matchedPayment = createPaymentResponse(updatedPayment);
        res.json({
            success: true,
            message: 'Payment matched successfully',
            data: { payment: matchedPayment }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'match payment');
    }
});
exports.importPayments = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    const { payments } = req.body;
    if (!Array.isArray(payments) || payments.length === 0) {
        res.status(400).json({
            success: false,
            error: 'No payments provided for import'
        });
        return;
    }
    try {
        const importBatch = Date.now().toString();
        const importedPayments = [];
        const matchedCount = { automatic: 0, manual: 0 };
        for (const paymentData of payments) {
            const { amount, valueDate, reference, description, rawData } = paymentData;
            const newPaymentData = {
                company_id: companyId,
                amount: Math.round(amount * 100),
                value_date: new Date(valueDate).toISOString().split('T')[0],
                reference: reference || null,
                description: description || null,
                confidence: 'MANUAL',
                is_matched: false,
                import_batch: importBatch,
                raw_data: rawData || null
            };
            const { data: newPayment, error: createError } = await supabase_1.db.payments()
                .insert(newPaymentData)
                .select()
                .single();
            if (createError || !newPayment) {
                console.error('Failed to create payment:', createError);
                continue;
            }
            const matchResult = await findMatchingInvoice(newPayment, companyId);
            if (matchResult.invoice) {
                const { data: updatedPayment } = await supabase_1.db.payments()
                    .update({
                    invoice_id: matchResult.invoice.id,
                    confidence: matchResult.confidence,
                    is_matched: true
                })
                    .eq('id', newPayment.id)
                    .select()
                    .single();
                await updateInvoiceAfterPayment(matchResult.invoice.id);
                importedPayments.push(createPaymentResponse(updatedPayment));
                matchedCount.automatic++;
            }
            else {
                importedPayments.push(createPaymentResponse(newPayment));
            }
        }
        res.status(201).json({
            success: true,
            message: `Imported ${importedPayments.length} payments. ${matchedCount.automatic} automatically matched.`,
            data: {
                payments: importedPayments,
                summary: {
                    total: importedPayments.length,
                    automaticallyMatched: matchedCount.automatic,
                    needsManualReview: importedPayments.length - matchedCount.automatic,
                    importBatch
                }
            }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'import payments');
    }
});
exports.getPaymentStats = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: payments, error } = await supabase_1.db.payments()
            .select('amount, confidence, is_matched, value_date')
            .eq('company_id', companyId);
        if (error) {
            (0, supabase_1.handleSupabaseError)(error, 'get payment stats');
            return;
        }
        const totalPayments = payments?.length || 0;
        const totalAmount = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        const matchedPayments = payments?.filter(p => p.is_matched).length || 0;
        const unmatchedPayments = totalPayments - matchedPayments;
        const confidenceCounts = payments?.reduce((acc, p) => {
            acc[p.confidence] = (acc[p.confidence] || 0) + 1;
            return acc;
        }, {}) || {};
        const stats = {
            totalPayments,
            totalAmount,
            matchedPayments,
            unmatchedPayments,
            matchingRate: totalPayments > 0 ? Math.round((matchedPayments / totalPayments) * 100) : 0,
            confidenceCounts,
            averagePaymentAmount: totalPayments > 0 ? Math.round(totalAmount / totalPayments) : 0
        };
        res.json({
            success: true,
            data: { stats }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'get payment stats');
    }
});
exports.updatePayment = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.status(501).json({
        success: false,
        error: 'Payment update not implemented yet'
    });
});
exports.deletePayment = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.status(501).json({
        success: false,
        error: 'Payment deletion not implemented yet'
    });
});
//# sourceMappingURL=paymentControllerSupabase.js.map