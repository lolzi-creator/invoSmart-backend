"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePayment = exports.updatePayment = exports.getPaymentStats = exports.debugPaymentMatching = exports.getPaymentSuggestions = exports.runAutoMatch = exports.importPaymentsCAMT053 = exports.importPaymentsMT940 = exports.importPaymentsCSV = exports.importPayments = exports.matchPayment = exports.createPayment = exports.getPaymentsByInvoice = exports.getPayment = exports.getPayments = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const types_1 = require("../types");
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
    console.log('Enhanced matching for payment:', {
        id: payment.id,
        amount: payment.amount,
        reference: payment.reference,
        valueDate: payment.value_date,
        description: payment.description
    });
    console.log('Payment data types:', {
        amountType: typeof payment.amount,
        amountValue: payment.amount,
        referenceType: typeof payment.reference,
        referenceValue: payment.reference,
        valueDateType: typeof payment.value_date,
        valueDateValue: payment.value_date
    });
    const { data: allInvoices, error: invoicesError } = await supabase_1.db.invoices()
        .select(`
      *,
      customers (
        id, name, company, email
      )
    `)
        .eq('company_id', companyId)
        .in('status', ['OPEN', 'PARTIAL_PAID', 'OVERDUE', 'PAID']);
    if (invoicesError || !allInvoices) {
        console.error('Error fetching invoices:', invoicesError);
        return { confidence: 'MANUAL' };
    }
    console.log(`Found ${allInvoices.length} open invoices to match against`);
    console.log('Available invoices for matching:', allInvoices.map(inv => ({
        id: inv.id,
        number: inv.number,
        qr_reference: inv.qr_reference,
        total: inv.total,
        due_date: inv.due_date,
        status: inv.status,
        customer_id: inv.customer_id,
        has_customer: !!inv.customers
    })));
    const matchScores = [];
    for (const invoice of allInvoices) {
        const score = calculateMatchScore(payment, invoice);
        if (score.score > 0) {
            matchScores.push(score);
        }
    }
    matchScores.sort((a, b) => b.score - a.score);
    console.log('Match scores:', matchScores.map(ms => ({
        invoiceNumber: ms.invoice.number,
        score: ms.score,
        maxScore: ms.maxScore,
        confidence: ms.confidence,
        criteria: ms.criteria
    })));
    const bestMatch = matchScores[0];
    if (bestMatch) {
        if (bestMatch.criteria.reference && payment.reference && bestMatch.invoice.qr_reference) {
            const cleanPaymentRef = payment.reference.replace(/\s/g, '');
            const cleanInvoiceRef = bestMatch.invoice.qr_reference.replace(/\s/g, '');
            if (cleanPaymentRef === cleanInvoiceRef) {
                console.log('Auto-matching payment to invoice by exact QR reference:', bestMatch.invoice.number);
                return {
                    invoice: bestMatch.invoice,
                    confidence: types_1.MatchConfidence.HIGH
                };
            }
        }
        if (bestMatch.confidence !== types_1.MatchConfidence.MANUAL && bestMatch.confidence !== types_1.MatchConfidence.LOW) {
            console.log('Auto-matching payment to invoice:', bestMatch.invoice.number);
            return {
                invoice: bestMatch.invoice,
                confidence: bestMatch.confidence
            };
        }
    }
    return { confidence: types_1.MatchConfidence.MANUAL };
};
const calculateMatchScore = (payment, invoice) => {
    console.log(`\n--- Calculating match score for invoice ${invoice.number} ---`);
    console.log('Invoice data:', {
        id: invoice.id,
        number: invoice.number,
        qr_reference: invoice.qr_reference,
        total: invoice.total,
        due_date: invoice.due_date,
        status: invoice.status,
        has_customer: !!invoice.customers
    });
    const criteria = {
        reference: false,
        amount: false,
        date: false,
        customer: false
    };
    let score = 0;
    let maxScore = 0;
    maxScore += 40;
    console.log('1. Reference matching:');
    console.log('  Payment reference:', payment.reference);
    console.log('  Invoice QR reference:', invoice.qr_reference);
    console.log('  Invoice number:', invoice.number);
    if (payment.reference) {
        const cleanReference = payment.reference.replace(/\s/g, '');
        console.log('  Clean reference:', cleanReference);
        if (invoice.qr_reference && invoice.qr_reference === cleanReference) {
            score += 40;
            criteria.reference = true;
            console.log('  ✓ QR reference exact match (+40)');
        }
        else if (invoice.number === cleanReference) {
            score += 40;
            criteria.reference = true;
            console.log('  ✓ Invoice number exact match (+40)');
        }
        else if (invoice.qr_reference && invoice.qr_reference.includes(cleanReference)) {
            score += 25;
            criteria.reference = true;
            console.log('  ✓ QR reference partial match (+25)');
        }
        else if (cleanReference.includes(invoice.number)) {
            score += 25;
            criteria.reference = true;
            console.log('  ✓ Reference contains invoice number (+25)');
        }
        else {
            console.log('  ✗ No reference match');
        }
    }
    else {
        console.log('  ✗ No payment reference');
    }
    maxScore += 30;
    console.log('2. Amount matching:');
    console.log('  Payment amount:', payment.amount, typeof payment.amount);
    console.log('  Invoice total:', invoice.total, typeof invoice.total);
    console.log('  Amount difference:', Math.abs(payment.amount - invoice.total));
    if (payment.amount === invoice.total) {
        score += 30;
        criteria.amount = true;
        console.log('  ✓ Exact amount match (+30)');
    }
    else if (Math.abs(payment.amount - invoice.total) <= 1) {
        score += 25;
        criteria.amount = true;
        console.log('  ✓ Amount match within tolerance (+25)');
    }
    else {
        console.log('  ✗ No amount match');
    }
    maxScore += 20;
    const paymentDate = new Date(payment.value_date);
    const invoiceDueDate = new Date(invoice.due_date);
    if (paymentDate.toDateString() === invoiceDueDate.toDateString()) {
        score += 20;
        criteria.date = true;
    }
    else if (Math.abs(paymentDate.getTime() - invoiceDueDate.getTime()) <= 3 * 24 * 60 * 60 * 1000) {
        score += 15;
        criteria.date = true;
    }
    else if (Math.abs(paymentDate.getTime() - invoiceDueDate.getTime()) <= 7 * 24 * 60 * 60 * 1000) {
        score += 10;
        criteria.date = true;
    }
    maxScore += 10;
    if (payment.description && invoice.customers) {
        const customerName = invoice.customers.name || '';
        const customerCompany = invoice.customers.company || '';
        const description = payment.description.toLowerCase();
        if (customerName && description.includes(customerName.toLowerCase())) {
            score += 10;
            criteria.customer = true;
        }
        else if (customerCompany && description.includes(customerCompany.toLowerCase())) {
            score += 10;
            criteria.customer = true;
        }
    }
    const matchPercentage = (score / maxScore) * 100;
    const matchedCriteria = Object.values(criteria).filter(Boolean).length;
    console.log('Final scoring:');
    console.log('  Score:', score, '/', maxScore);
    console.log('  Match percentage:', matchPercentage.toFixed(1) + '%');
    console.log('  Matched criteria:', matchedCriteria);
    console.log('  Criteria details:', criteria);
    let confidence = types_1.MatchConfidence.MANUAL;
    if (matchPercentage >= 80 || matchedCriteria >= 3) {
        confidence = types_1.MatchConfidence.HIGH;
        console.log('  → HIGH confidence');
    }
    else if (matchPercentage >= 60 || matchedCriteria >= 2) {
        confidence = types_1.MatchConfidence.MEDIUM;
        console.log('  → MEDIUM confidence');
    }
    else if (matchPercentage >= 40 || matchedCriteria >= 1) {
        confidence = types_1.MatchConfidence.LOW;
        console.log('  → LOW confidence');
    }
    else {
        console.log('  → MANUAL confidence');
    }
    return {
        invoice,
        score,
        maxScore,
        criteria,
        confidence
    };
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
    const limit = parseInt(req.query.limit) || 5;
    const isMatched = req.query.isMatched === 'true' ? true : req.query.isMatched === 'false' ? false : undefined;
    const confidence = req.query.confidence;
    const dateRange = req.query.dateRange;
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
        if (dateRange) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (dateRange === 'thisWeek') {
                const monday = new Date(today);
                monday.setDate(today.getDate() - today.getDay() + 1);
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                query = query
                    .gte('value_date', monday.toISOString().split('T')[0])
                    .lte('value_date', sunday.toISOString().split('T')[0]);
            }
            else if (dateRange === 'lastWeek') {
                const lastMonday = new Date(today);
                lastMonday.setDate(today.getDate() - today.getDay() - 6);
                const lastSunday = new Date(lastMonday);
                lastSunday.setDate(lastMonday.getDate() + 6);
                query = query
                    .gte('value_date', lastMonday.toISOString().split('T')[0])
                    .lte('value_date', lastSunday.toISOString().split('T')[0]);
            }
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
        if (payment.invoiceId) {
            const { data: invoiceData, error: invoiceError } = await supabase_1.db.invoices()
                .select(`
          *,
          customers (
            id, name, company, email
          )
        `)
                .eq('id', payment.invoiceId)
                .eq('company_id', companyId)
                .single();
            if (!invoiceError && invoiceData) {
                ;
                payment.invoice = {
                    id: invoiceData.id,
                    number: invoiceData.number,
                    total: invoiceData.total / 100,
                    date: invoiceData.date,
                    dueDate: invoiceData.due_date,
                    status: invoiceData.status,
                    qrReference: invoiceData.qr_reference,
                    customer: invoiceData.customers ? {
                        id: invoiceData.customers.id,
                        name: invoiceData.customers.name,
                        company: invoiceData.customers.company,
                        email: invoiceData.customers.email
                    } : undefined
                };
            }
        }
        res.json({
            success: true,
            data: { payment }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'get payment');
    }
});
exports.getPaymentsByInvoice = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const invoiceId = req.params.invoiceId;
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
            .eq('company_id', companyId)
            .eq('invoice_id', invoiceId)
            .order('value_date', { ascending: false });
        if (error) {
            (0, supabase_1.handleSupabaseError)(error, 'get payments by invoice');
            return;
        }
        const payments = data.map(createPaymentResponse);
        res.json({
            success: true,
            data: { payments }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'get payments by invoice');
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
                const match = line.match(/:61:(\d{6})(\d{4})([CD])(\d+(?:\.\d{2})?)NTRF[^/]*\/\/([^:]+)/);
                if (match) {
                    const [, date, time, dc, amount, ref] = match;
                    currentPayment.valueDate = `20${date.substring(0, 2)}-${date.substring(2, 4)}-${date.substring(4, 6)}`;
                    currentPayment.amount = Math.round(parseFloat(amount) * 100) * (dc === 'C' ? 1 : -1);
                    currentPayment.reference = ref.trim();
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
exports.getPaymentSuggestions = (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
        const { data: allInvoices, error: invoicesError } = await supabase_1.db.invoices()
            .select(`
        *,
        customers (
          id, name, company, email
        )
      `)
            .eq('company_id', companyId)
            .in('status', ['OPEN', 'PARTIAL_PAID', 'OVERDUE', 'PAID']);
        if (invoicesError || !allInvoices) {
            res.status(400).json({
                success: false,
                error: 'Failed to fetch invoices'
            });
            return;
        }
        const suggestions = [];
        for (const invoice of allInvoices) {
            const score = calculateMatchScore(payment, invoice);
            if (score.score > 0) {
                suggestions.push(score);
            }
        }
        suggestions.sort((a, b) => b.score - a.score);
        const topSuggestions = suggestions.slice(0, 5);
        res.json({
            success: true,
            data: {
                payment: createPaymentResponse(payment),
                suggestions: topSuggestions.map(suggestion => ({
                    invoice: {
                        id: suggestion.invoice.id,
                        number: suggestion.invoice.number,
                        total: suggestion.invoice.total,
                        dueDate: suggestion.invoice.due_date,
                        customer: suggestion.invoice.customers ? {
                            name: suggestion.invoice.customers.name,
                            company: suggestion.invoice.customers.company
                        } : null
                    },
                    score: suggestion.score,
                    maxScore: suggestion.maxScore,
                    matchPercentage: Math.round((suggestion.score / suggestion.maxScore) * 100),
                    criteria: suggestion.criteria,
                    confidence: suggestion.confidence
                }))
            }
        });
    }
    catch (error) {
        console.error('Error getting payment suggestions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get payment suggestions'
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