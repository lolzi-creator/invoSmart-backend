"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePayment = exports.updatePayment = exports.getPaymentStats = exports.debugPaymentMatching = exports.runAutoMatch = exports.importPaymentsCAMT053 = exports.importPaymentsMT940 = exports.importPaymentsCSV = exports.importPayments = exports.matchPayment = exports.createPayment = exports.getPayment = exports.getPayments = void 0;
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
        const cleanReference = payment.reference.replace(/\s/g, '');
        console.log('Looking for QR match:', {
            paymentReference: cleanReference,
            companyId: companyId
        });
        const { data: allInvoices } = await supabase_1.db.invoices()
            .select('id, number, qr_reference, total')
            .eq('company_id', companyId);
        console.log('Available invoices for matching:', allInvoices?.map(inv => ({
            number: inv.number,
            qr_reference: inv.qr_reference,
            total: inv.total
        })));
        const { data: qrInvoices, error: qrError } = await supabase_1.db.invoices()
            .select('*')
            .eq('company_id', companyId)
            .eq('qr_reference', cleanReference);
        console.log('QR search result:', {
            found: qrInvoices && qrInvoices.length > 0,
            error: qrError?.message,
            count: qrInvoices?.length || 0,
            invoiceNumbers: qrInvoices?.map(inv => inv.number) || []
        });
        if (qrInvoices && qrInvoices.length > 0) {
            const qrInvoice = qrInvoices[0];
            console.log('HIGH confidence match found:', qrInvoice.number);
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
                amount: amount,
                value_date: new Date(valueDate).toISOString().split('T')[0],
                reference: reference || null,
                description: description || null,
                confidence: 'MANUAL',
                is_matched: false,
                import_batch: importBatch,
                raw_data: rawData || null
            };
            console.log('Creating payment:', {
                amount: amount,
                amountCHF: amount / 100,
                reference: reference,
                valueDate: valueDate
            });
            const { data: newPayment, error: createError } = await supabase_1.db.payments()
                .insert(newPaymentData)
                .select()
                .single();
            if (createError || !newPayment) {
                console.error('Failed to create payment:', createError);
                continue;
            }
            console.log('Attempting to match payment:', newPayment.id, 'with reference:', newPayment.reference);
            const matchResult = await findMatchingInvoice(newPayment, companyId);
            console.log('Match result:', {
                found: !!matchResult.invoice,
                confidence: matchResult.confidence,
                invoiceId: matchResult.invoice?.id,
                invoiceNumber: matchResult.invoice?.number
            });
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
                console.log('Payment matched successfully:', {
                    paymentId: newPayment.id,
                    invoiceId: matchResult.invoice.id,
                    confidence: matchResult.confidence
                });
                await updateInvoiceAfterPayment(matchResult.invoice.id);
                importedPayments.push(createPaymentResponse(updatedPayment));
                matchedCount.automatic++;
            }
            else {
                console.log('No match found for payment:', newPayment.id);
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
exports.importPaymentsCSV = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const { csvData } = req.body;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    if (!csvData) {
        res.status(400).json({
            success: false,
            error: 'CSV data is required'
        });
        return;
    }
    try {
        const lines = csvData.trim().split('\n');
        const headers = lines[0].split(',').map((h) => h.trim());
        const payments = [];
        console.log('CSV Headers:', headers);
        console.log('CSV Lines count:', lines.length);
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line)
                continue;
            const values = line.split(',').map((v) => v.trim());
            console.log(`Line ${i}:`, values);
            if (values.length >= 2) {
                const amountStr = values[0];
                const amount = parseFloat(amountStr);
                console.log(`Amount string: "${amountStr}", parsed: ${amount}, isNaN: ${isNaN(amount)}`);
                if (!isNaN(amount) && amount > 0) {
                    const payment = {
                        amount: Math.round(amount * 100),
                        valueDate: values[1],
                        reference: values[2] || null,
                        description: values[3] || null
                    };
                    console.log('Valid payment:', payment);
                    payments.push(payment);
                }
                else {
                    console.log(`Skipping invalid amount: "${amountStr}"`);
                }
            }
            else {
                console.log(`Skipping line with insufficient columns: ${values.length}`);
            }
        }
        console.log('Total valid payments parsed:', payments.length);
        if (payments.length === 0) {
            res.status(400).json({
                success: false,
                error: 'No valid payments found in CSV data'
            });
            return;
        }
        const importBatch = Date.now().toString();
        const importedPayments = [];
        const matchedCount = { automatic: 0, manual: 0 };
        for (const paymentData of payments) {
            console.log('Processing payment data:', paymentData);
            if (!paymentData.amount || paymentData.amount <= 0) {
                console.error('Invalid amount:', paymentData.amount);
                continue;
            }
            if (!paymentData.valueDate) {
                console.error('Missing value date:', paymentData);
                continue;
            }
            const newPaymentData = {
                company_id: companyId,
                amount: paymentData.amount,
                value_date: new Date(paymentData.valueDate).toISOString().split('T')[0],
                reference: paymentData.reference,
                description: paymentData.description,
                confidence: 'MANUAL',
                is_matched: false,
                import_batch: importBatch,
                raw_data: null
            };
            console.log('Creating payment with data:', newPaymentData);
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
                await supabase_1.db.payments()
                    .update({
                    invoice_id: matchResult.invoice.id,
                    confidence: matchResult.confidence,
                    is_matched: true
                })
                    .eq('id', newPayment.id);
                await updateInvoiceAfterPayment(matchResult.invoice.id);
                matchedCount.automatic++;
            }
            importedPayments.push(createPaymentResponse(newPayment));
        }
        res.json({
            success: true,
            message: `Successfully imported ${importedPayments.length} payments`,
            data: {
                payments: importedPayments,
                matchedCount
            }
        });
    }
    catch (error) {
        console.error('Error importing CSV payments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import CSV payments'
        });
    }
});
exports.importPaymentsMT940 = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const { mt940Data } = req.body;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    if (!mt940Data) {
        res.status(400).json({
            success: false,
            error: 'MT940 data is required'
        });
        return;
    }
    try {
        const lines = mt940Data.split('\n');
        const payments = [];
        let currentPayment = null;
        for (const line of lines) {
            if (line.startsWith(':61:')) {
                if (currentPayment) {
                    payments.push(currentPayment);
                }
                currentPayment = {
                    amount: 0,
                    valueDate: '',
                    reference: '',
                    description: ''
                };
                const match = line.match(/:61:(\d{6})(\d{4})([CD])(\d+),(\d+)/);
                if (match) {
                    const [, date, time, dc, amount, ref] = match;
                    currentPayment.valueDate = `20${date.substring(0, 2)}-${date.substring(2, 4)}-${date.substring(4, 6)}`;
                    currentPayment.amount = parseInt(amount) * (dc === 'C' ? 1 : -1);
                    currentPayment.reference = ref;
                }
            }
            else if (line.startsWith(':86:') && currentPayment) {
                currentPayment.description = line.substring(4).trim();
            }
        }
        if (currentPayment) {
            payments.push(currentPayment);
        }
        const importBatch = Date.now().toString();
        const importedPayments = [];
        const matchedCount = { automatic: 0, manual: 0 };
        for (const paymentData of payments) {
            if (paymentData.amount === 0)
                continue;
            const newPaymentData = {
                company_id: companyId,
                amount: Math.abs(paymentData.amount),
                value_date: paymentData.valueDate,
                reference: paymentData.reference || null,
                description: paymentData.description || null,
                confidence: 'MANUAL',
                is_matched: false,
                import_batch: importBatch,
                raw_data: { mt940: true }
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
                await supabase_1.db.payments()
                    .update({
                    invoice_id: matchResult.invoice.id,
                    confidence: matchResult.confidence,
                    is_matched: true
                })
                    .eq('id', newPayment.id);
                await updateInvoiceAfterPayment(matchResult.invoice.id);
                matchedCount.automatic++;
            }
            importedPayments.push(createPaymentResponse(newPayment));
        }
        res.json({
            success: true,
            message: `Successfully imported ${importedPayments.length} payments from MT940`,
            data: {
                payments: importedPayments,
                matchedCount
            }
        });
    }
    catch (error) {
        console.error('Error importing MT940 payments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import MT940 payments'
        });
    }
});
exports.importPaymentsCAMT053 = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const { camt053Data } = req.body;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    if (!camt053Data) {
        res.status(400).json({
            success: false,
            error: 'CAMT.053 data is required'
        });
        return;
    }
    try {
        const payments = [];
        const entryMatches = camt053Data.match(/<Ntry>[\s\S]*?<\/Ntry>/g) || [];
        for (const entry of entryMatches) {
            const amountMatch = entry.match(/<Amt Ccy="CHF">([\d.]+)<\/Amt>/);
            const dateMatch = entry.match(/<Dt>(\d{4}-\d{2}-\d{2})<\/Dt>/);
            const refMatch = entry.match(/<RmtInf>[\s\S]*?<Ustrd>([^<]+)<\/Ustrd>/);
            if (amountMatch && dateMatch) {
                payments.push({
                    amount: Math.round(parseFloat(amountMatch[1]) * 100),
                    valueDate: dateMatch[1],
                    reference: refMatch ? refMatch[1].trim() : null,
                    description: 'CAMT.053 Import'
                });
            }
        }
        const importBatch = Date.now().toString();
        const importedPayments = [];
        const matchedCount = { automatic: 0, manual: 0 };
        for (const paymentData of payments) {
            const newPaymentData = {
                company_id: companyId,
                amount: paymentData.amount,
                value_date: paymentData.valueDate,
                reference: paymentData.reference,
                description: paymentData.description,
                confidence: 'MANUAL',
                is_matched: false,
                import_batch: importBatch,
                raw_data: { camt053: true }
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
                await supabase_1.db.payments()
                    .update({
                    invoice_id: matchResult.invoice.id,
                    confidence: matchResult.confidence,
                    is_matched: true
                })
                    .eq('id', newPayment.id);
                await updateInvoiceAfterPayment(matchResult.invoice.id);
                matchedCount.automatic++;
            }
            importedPayments.push(createPaymentResponse(newPayment));
        }
        res.json({
            success: true,
            message: `Successfully imported ${importedPayments.length} payments from CAMT.053`,
            data: {
                payments: importedPayments,
                matchedCount
            }
        });
    }
    catch (error) {
        console.error('Error importing CAMT.053 payments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import CAMT.053 payments'
        });
    }
});
exports.runAutoMatch = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: unmatchedPayments, error: paymentsError } = await supabase_1.db.payments()
            .select('*')
            .eq('company_id', companyId)
            .eq('is_matched', false);
        if (paymentsError) {
            res.status(400).json({
                success: false,
                error: 'Failed to fetch unmatched payments'
            });
            return;
        }
        let matchedCount = 0;
        const results = [];
        for (const payment of unmatchedPayments || []) {
            const matchResult = await findMatchingInvoice(payment, companyId);
            if (matchResult.invoice) {
                const { error: updateError } = await supabase_1.db.payments()
                    .update({
                    invoice_id: matchResult.invoice.id,
                    confidence: matchResult.confidence,
                    is_matched: true
                })
                    .eq('id', payment.id);
                if (!updateError) {
                    await updateInvoiceAfterPayment(matchResult.invoice.id);
                    matchedCount++;
                    results.push({
                        paymentId: payment.id,
                        invoiceId: matchResult.invoice.id,
                        confidence: matchResult.confidence
                    });
                }
            }
        }
        res.json({
            success: true,
            message: `Auto-matching completed. ${matchedCount} payments matched.`,
            data: {
                matchedCount,
                totalProcessed: unmatchedPayments?.length || 0,
                results
            }
        });
    }
    catch (error) {
        console.error('Error running auto-match:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to run auto-matching'
        });
    }
});
exports.debugPaymentMatching = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: invoices } = await supabase_1.db.invoices()
            .select('id, number, qr_reference, total, status')
            .eq('company_id', companyId);
        const { data: payments } = await supabase_1.db.payments()
            .select('id, amount, reference, value_date, is_matched, confidence')
            .eq('company_id', companyId);
        const debugResults = [];
        for (const payment of payments || []) {
            const matchResult = await findMatchingInvoice(payment, companyId);
            debugResults.push({
                payment: {
                    id: payment.id,
                    amount: payment.amount,
                    amountCHF: (payment.amount / 100).toFixed(2),
                    reference: payment.reference,
                    valueDate: payment.value_date,
                    isMatched: payment.is_matched,
                    confidence: payment.confidence
                },
                matching: {
                    found: !!matchResult.invoice,
                    confidence: matchResult.confidence,
                    invoiceId: matchResult.invoice?.id,
                    invoiceNumber: matchResult.invoice?.number,
                    invoiceTotal: matchResult.invoice?.total,
                    invoiceTotalCHF: matchResult.invoice ? (matchResult.invoice.total / 100).toFixed(2) : null
                }
            });
        }
        res.json({
            success: true,
            data: {
                companyId,
                invoices: (invoices || []).map(inv => ({
                    id: inv.id,
                    number: inv.number,
                    qrReference: inv.qr_reference,
                    total: inv.total,
                    totalCHF: (inv.total / 100).toFixed(2),
                    status: inv.status
                })),
                debugResults
            }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'debug payment matching');
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
//# sourceMappingURL=paymentController.js.map