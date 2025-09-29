"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentStats = exports.deletePayment = exports.matchPayment = exports.importPayments = exports.createPayment = exports.getPayment = exports.getPayments = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const types_1 = require("../types");
const mockData_1 = require("../data/mockData");
const ensureCompanyAccess = (req) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        throw new Error('Company access required');
    }
    return companyId;
};
const findBestInvoiceMatch = (payment, companyInvoices) => {
    let bestMatch = null;
    if (payment.reference) {
        const qrMatch = companyInvoices.find(invoice => invoice.qrReference === payment.reference &&
            invoice.total - invoice.paidAmount > 0);
        if (qrMatch) {
            return { invoice: qrMatch, confidence: types_1.MatchConfidence.HIGH };
        }
    }
    const amountMatches = companyInvoices.filter(invoice => {
        const outstanding = invoice.total - invoice.paidAmount;
        const amountDiff = Math.abs(outstanding - payment.amount);
        const daysDiff = Math.abs(payment.valueDate.getTime() - invoice.date.getTime()) / (1000 * 60 * 60 * 24);
        return amountDiff === 0 && daysDiff <= 30 && outstanding > 0;
    });
    if (amountMatches.length === 1) {
        return { invoice: amountMatches[0], confidence: types_1.MatchConfidence.MEDIUM };
    }
    const amountOnlyMatches = companyInvoices.filter(invoice => {
        const outstanding = invoice.total - invoice.paidAmount;
        return outstanding === payment.amount && outstanding > 0;
    });
    if (amountOnlyMatches.length === 1) {
        return { invoice: amountOnlyMatches[0], confidence: types_1.MatchConfidence.LOW };
    }
    return null;
};
const updateInvoicePaymentStatus = (invoice) => {
    const totalPaid = invoice.paidAmount;
    if (totalPaid === 0) {
        invoice.status = types_1.InvoiceStatus.OPEN;
    }
    else if (totalPaid >= invoice.total) {
        invoice.status = types_1.InvoiceStatus.PAID;
    }
    else {
        invoice.status = types_1.InvoiceStatus.PARTIAL_PAID;
    }
    invoice.updatedAt = new Date();
};
exports.getPayments = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = ensureCompanyAccess(req);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const isMatched = req.query.isMatched;
    const confidence = req.query.confidence;
    const invoiceId = req.query.invoiceId;
    const sortBy = req.query.sortBy || 'valueDate';
    const sortOrder = req.query.sortOrder || 'desc';
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : undefined;
    let filteredPayments = mockData_1.mockPayments.filter(p => p.companyId === companyId);
    if (search) {
        const searchLower = search.toLowerCase();
        filteredPayments = filteredPayments.filter(payment => payment.reference?.toLowerCase().includes(searchLower) ||
            payment.description?.toLowerCase().includes(searchLower) ||
            payment.notes?.toLowerCase().includes(searchLower));
    }
    if (isMatched !== undefined) {
        const matchedFilter = isMatched === 'true';
        filteredPayments = filteredPayments.filter(p => p.isMatched === matchedFilter);
    }
    if (confidence) {
        filteredPayments = filteredPayments.filter(p => p.confidence === confidence);
    }
    if (invoiceId) {
        filteredPayments = filteredPayments.filter(p => p.invoiceId === invoiceId);
    }
    if (dateFrom) {
        filteredPayments = filteredPayments.filter(p => p.valueDate >= dateFrom);
    }
    if (dateTo) {
        filteredPayments = filteredPayments.filter(p => p.valueDate <= dateTo);
    }
    filteredPayments.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];
        if (aValue instanceof Date && bValue instanceof Date) {
            return sortOrder === 'desc'
                ? bValue.getTime() - aValue.getTime()
                : aValue.getTime() - bValue.getTime();
        }
        if (aValue === undefined)
            aValue = '';
        if (bValue === undefined)
            bValue = '';
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        if (sortOrder === 'desc') {
            return bStr.localeCompare(aStr);
        }
        return aStr.localeCompare(bStr);
    });
    const total = filteredPayments.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedPayments = filteredPayments.slice(offset, offset + limit);
    const populatedPayments = paginatedPayments.map(payment => ({
        ...payment,
        invoice: payment.invoiceId ? mockData_1.mockInvoices.find(i => i.id === payment.invoiceId) : undefined
    }));
    const response = {
        data: populatedPayments,
        total,
        page,
        limit,
        totalPages
    };
    res.json({
        success: true,
        data: response
    });
});
exports.getPayment = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const companyId = ensureCompanyAccess(req);
    const payment = mockData_1.mockPayments.find(p => p.id === id && p.companyId === companyId);
    if (!payment) {
        res.status(404).json({
            success: false,
            error: 'Payment not found'
        });
        return;
    }
    const populatedPayment = {
        ...payment,
        invoice: payment.invoiceId ? mockData_1.mockInvoices.find(i => i.id === payment.invoiceId) : undefined
    };
    res.json({
        success: true,
        data: populatedPayment
    });
});
exports.createPayment = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = ensureCompanyAccess(req);
    const { invoiceId, amount, valueDate, reference, description, notes } = req.body;
    let targetInvoice;
    if (invoiceId) {
        targetInvoice = mockData_1.mockInvoices.find(i => i.id === invoiceId && i.companyId === companyId);
        if (!targetInvoice) {
            res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
            return;
        }
    }
    const amountInRappen = Math.round(amount * 100);
    const payment = {
        id: (0, mockData_1.generateId)(),
        invoiceId: invoiceId || undefined,
        companyId,
        amount: amountInRappen,
        valueDate: new Date(valueDate),
        reference: reference || undefined,
        description: description || undefined,
        confidence: invoiceId ? types_1.MatchConfidence.MANUAL : types_1.MatchConfidence.LOW,
        isMatched: !!invoiceId,
        notes: notes || undefined,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    if (targetInvoice) {
        targetInvoice.paidAmount += amountInRappen;
        updateInvoicePaymentStatus(targetInvoice);
        const invoiceIndex = mockData_1.mockInvoices.findIndex(i => i.id === targetInvoice.id);
        if (invoiceIndex !== -1) {
            mockData_1.mockInvoices[invoiceIndex] = targetInvoice;
        }
    }
    mockData_1.mockPayments.push(payment);
    const responsePayment = {
        ...payment,
        invoice: targetInvoice
    };
    res.status(201).json({
        success: true,
        message: 'Payment created successfully',
        data: responsePayment
    });
});
exports.importPayments = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = ensureCompanyAccess(req);
    const { payments: paymentData, importBatch } = req.body;
    if (!Array.isArray(paymentData) || paymentData.length === 0) {
        res.status(400).json({
            success: false,
            error: 'No payments provided for import'
        });
        return;
    }
    const companyInvoices = mockData_1.mockInvoices.filter(i => i.companyId === companyId);
    const results = {
        imported: 0,
        matched: 0,
        unmatched: 0,
        errors: []
    };
    const batch = importBatch || `import_${Date.now()}`;
    for (let i = 0; i < paymentData.length; i++) {
        const paymentItem = paymentData[i];
        try {
            if (!paymentItem.amount || !paymentItem.valueDate) {
                results.errors.push(`Row ${i + 1}: Missing required fields (amount, valueDate)`);
                continue;
            }
            const amountInRappen = Math.round(paymentItem.amount * 100);
            const payment = {
                id: (0, mockData_1.generateId)(),
                companyId,
                amount: amountInRappen,
                valueDate: new Date(paymentItem.valueDate),
                reference: paymentItem.reference || undefined,
                description: paymentItem.description || undefined,
                confidence: types_1.MatchConfidence.LOW,
                isMatched: false,
                importBatch: batch,
                rawData: paymentItem,
                notes: paymentItem.notes || undefined,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const match = findBestInvoiceMatch(payment, companyInvoices);
            if (match) {
                payment.invoiceId = match.invoice.id;
                payment.confidence = match.confidence;
                payment.isMatched = true;
                match.invoice.paidAmount += amountInRappen;
                updateInvoicePaymentStatus(match.invoice);
                const invoiceIndex = mockData_1.mockInvoices.findIndex(i => i.id === match.invoice.id);
                if (invoiceIndex !== -1) {
                    mockData_1.mockInvoices[invoiceIndex] = match.invoice;
                }
                results.matched++;
            }
            else {
                results.unmatched++;
            }
            mockData_1.mockPayments.push(payment);
            results.imported++;
        }
        catch (error) {
            results.errors.push(`Row ${i + 1}: ${error}`);
        }
    }
    res.json({
        success: true,
        message: 'Import completed',
        data: results
    });
});
exports.matchPayment = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { invoiceId } = req.body;
    const companyId = ensureCompanyAccess(req);
    const paymentIndex = mockData_1.mockPayments.findIndex(p => p.id === id && p.companyId === companyId);
    if (paymentIndex === -1) {
        res.status(404).json({
            success: false,
            error: 'Payment not found'
        });
        return;
    }
    const payment = mockData_1.mockPayments[paymentIndex];
    if (payment.isMatched && payment.invoiceId) {
        const oldInvoice = mockData_1.mockInvoices.find(i => i.id === payment.invoiceId);
        if (oldInvoice && oldInvoice.companyId === companyId) {
            oldInvoice.paidAmount -= payment.amount;
            updateInvoicePaymentStatus(oldInvoice);
            const oldInvoiceIndex = mockData_1.mockInvoices.findIndex(i => i.id === oldInvoice.id);
            if (oldInvoiceIndex !== -1) {
                mockData_1.mockInvoices[oldInvoiceIndex] = oldInvoice;
            }
        }
    }
    let targetInvoice;
    if (invoiceId) {
        targetInvoice = mockData_1.mockInvoices.find(i => i.id === invoiceId && i.companyId === companyId);
        if (!targetInvoice) {
            res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
            return;
        }
        targetInvoice.paidAmount += payment.amount;
        updateInvoicePaymentStatus(targetInvoice);
        const invoiceIndex = mockData_1.mockInvoices.findIndex(i => i.id === targetInvoice.id);
        if (invoiceIndex !== -1) {
            mockData_1.mockInvoices[invoiceIndex] = targetInvoice;
        }
        payment.invoiceId = invoiceId;
        payment.confidence = types_1.MatchConfidence.MANUAL;
        payment.isMatched = true;
    }
    else {
        payment.invoiceId = undefined;
        payment.confidence = types_1.MatchConfidence.LOW;
        payment.isMatched = false;
    }
    payment.updatedAt = new Date();
    mockData_1.mockPayments[paymentIndex] = payment;
    res.json({
        success: true,
        message: invoiceId ? 'Payment matched to invoice' : 'Payment unmatched',
        data: {
            id: payment.id,
            invoiceId: payment.invoiceId,
            isMatched: payment.isMatched,
            confidence: payment.confidence
        }
    });
});
exports.deletePayment = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const companyId = ensureCompanyAccess(req);
    const paymentIndex = mockData_1.mockPayments.findIndex(p => p.id === id && p.companyId === companyId);
    if (paymentIndex === -1) {
        res.status(404).json({
            success: false,
            error: 'Payment not found'
        });
        return;
    }
    const payment = mockData_1.mockPayments[paymentIndex];
    if (payment.isMatched && payment.invoiceId) {
        const invoice = mockData_1.mockInvoices.find(i => i.id === payment.invoiceId);
        if (invoice && invoice.companyId === companyId) {
            invoice.paidAmount -= payment.amount;
            updateInvoicePaymentStatus(invoice);
            const invoiceIndex = mockData_1.mockInvoices.findIndex(i => i.id === invoice.id);
            if (invoiceIndex !== -1) {
                mockData_1.mockInvoices[invoiceIndex] = invoice;
            }
        }
    }
    mockData_1.mockPayments.splice(paymentIndex, 1);
    res.json({
        success: true,
        message: 'Payment deleted successfully'
    });
});
exports.getPaymentStats = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = ensureCompanyAccess(req);
    const companyPayments = mockData_1.mockPayments.filter(p => p.companyId === companyId);
    const stats = {
        total: companyPayments.length,
        matched: companyPayments.filter(p => p.isMatched).length,
        unmatched: companyPayments.filter(p => !p.isMatched).length,
        totalAmount: companyPayments.reduce((sum, payment) => sum + payment.amount, 0),
        matchedAmount: companyPayments
            .filter(p => p.isMatched)
            .reduce((sum, payment) => sum + payment.amount, 0),
        unmatchedAmount: companyPayments
            .filter(p => !p.isMatched)
            .reduce((sum, payment) => sum + payment.amount, 0),
        byConfidence: companyPayments.reduce((acc, payment) => {
            acc[payment.confidence] = (acc[payment.confidence] || 0) + 1;
            return acc;
        }, {}),
        thisMonth: {
            count: companyPayments.filter(p => {
                const now = new Date();
                return p.valueDate.getMonth() === now.getMonth() && p.valueDate.getFullYear() === now.getFullYear();
            }).length,
            amount: companyPayments
                .filter(p => {
                const now = new Date();
                return p.valueDate.getMonth() === now.getMonth() && p.valueDate.getFullYear() === now.getFullYear();
            })
                .reduce((sum, payment) => sum + payment.amount, 0)
        }
    };
    res.json({
        success: true,
        data: stats
    });
});
//# sourceMappingURL=paymentControllerOld.js.map