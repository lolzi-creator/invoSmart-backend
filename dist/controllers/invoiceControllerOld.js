"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvoiceStats = exports.updateInvoiceStatus = exports.deleteInvoice = exports.updateInvoice = exports.createInvoice = exports.getInvoice = exports.getInvoices = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const types_1 = require("../types");
const mockData_1 = require("../data/mockData");
const generateInvoiceNumber = (companyId) => {
    const year = new Date().getFullYear();
    const companyInvoices = mockData_1.mockInvoices.filter(i => i.companyId === companyId &&
        i.date.getFullYear() === year);
    const nextNumber = companyInvoices.length + 1;
    return `RE-${year}-${nextNumber.toString().padStart(4, '0')}`;
};
const generateQRReference = (invoiceNumber, companyId) => {
    const baseNumber = `${companyId.slice(-6)}${invoiceNumber.replace(/\D/g, '')}`;
    const checksum = calculateModulo10(baseNumber);
    return `${baseNumber}${checksum}`;
};
const calculateModulo10 = (number) => {
    const weights = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
    let carry = 0;
    for (let i = 0; i < number.length; i++) {
        carry = weights[(carry + parseInt(number[i])) % 10];
    }
    return ((10 - carry) % 10).toString();
};
const calculateInvoiceTotals = (items, discountAmount = 0) => {
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const vatAmount = items.reduce((sum, item) => sum + item.vatAmount, 0);
    const total = subtotal + vatAmount - discountAmount;
    return { subtotal, vatAmount, total };
};
const ensureCompanyAccess = (req) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        throw new Error('Company access required');
    }
    return companyId;
};
exports.getInvoices = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = ensureCompanyAccess(req);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status;
    const customerId = req.query.customerId;
    const sortBy = req.query.sortBy || 'date';
    const sortOrder = req.query.sortOrder || 'desc';
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : undefined;
    let filteredInvoices = mockData_1.mockInvoices.filter(i => i.companyId === companyId);
    if (search) {
        const searchLower = search.toLowerCase();
        filteredInvoices = filteredInvoices.filter(invoice => invoice.number.toLowerCase().includes(searchLower) ||
            invoice.customer?.name.toLowerCase().includes(searchLower) ||
            invoice.customer?.company?.toLowerCase().includes(searchLower));
    }
    if (status) {
        filteredInvoices = filteredInvoices.filter(i => i.status === status);
    }
    if (customerId) {
        filteredInvoices = filteredInvoices.filter(i => i.customerId === customerId);
    }
    if (dateFrom) {
        filteredInvoices = filteredInvoices.filter(i => i.date >= dateFrom);
    }
    if (dateTo) {
        filteredInvoices = filteredInvoices.filter(i => i.date <= dateTo);
    }
    filteredInvoices.sort((a, b) => {
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
    const total = filteredInvoices.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedInvoices = filteredInvoices.slice(offset, offset + limit);
    const populatedInvoices = paginatedInvoices.map(invoice => ({
        ...invoice,
        customer: mockData_1.mockCustomers.find(c => c.id === invoice.customerId)
    }));
    const response = {
        data: populatedInvoices,
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
exports.getInvoice = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const companyId = ensureCompanyAccess(req);
    const invoice = mockData_1.mockInvoices.find(i => i.id === id && i.companyId === companyId);
    if (!invoice) {
        res.status(404).json({
            success: false,
            error: 'Invoice not found'
        });
        return;
    }
    const populatedInvoice = {
        ...invoice,
        customer: mockData_1.mockCustomers.find(c => c.id === invoice.customerId),
        items: mockData_1.mockInvoiceItems.filter(item => item.invoiceId === invoice.id)
    };
    res.json({
        success: true,
        data: populatedInvoice
    });
});
exports.createInvoice = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = ensureCompanyAccess(req);
    const { customerId, date = new Date(), dueDate, items, discountCode, discountAmount = 0 } = req.body;
    const customer = mockData_1.mockCustomers.find(c => c.id === customerId && c.companyId === companyId);
    if (!customer) {
        res.status(404).json({
            success: false,
            error: 'Customer not found'
        });
        return;
    }
    const invoiceDate = new Date(date);
    const calculatedDueDate = dueDate ? new Date(dueDate) : new Date(invoiceDate.getTime() + (customer.paymentTerms * 24 * 60 * 60 * 1000));
    const invoiceNumber = generateInvoiceNumber(companyId);
    const qrReference = generateQRReference(invoiceNumber, companyId);
    const invoiceId = (0, mockData_1.generateId)();
    const processedItems = items.map((item, index) => {
        const quantity = Math.round(item.quantity * 1000);
        const unitPrice = Math.round(item.unitPrice * 100);
        const discount = Math.round((item.discount || 0) * 100);
        const vatRate = Math.round(item.vatRate * 100);
        const lineSubtotal = Math.round((quantity * unitPrice) / 1000);
        const discountAmount = Math.round((lineSubtotal * discount) / 10000);
        const lineAfterDiscount = lineSubtotal - discountAmount;
        const vatAmount = Math.round((lineAfterDiscount * vatRate) / 10000);
        const lineTotal = lineAfterDiscount;
        return {
            id: (0, mockData_1.generateId)(),
            invoiceId,
            description: item.description,
            quantity,
            unit: item.unit || 'Stück',
            unitPrice,
            discount,
            vatRate,
            lineTotal,
            vatAmount,
            sortOrder: index + 1
        };
    });
    const { subtotal, vatAmount, total } = calculateInvoiceTotals(processedItems, Math.round(discountAmount * 100));
    const invoice = {
        id: invoiceId,
        number: invoiceNumber,
        customerId,
        companyId,
        date: invoiceDate,
        dueDate: calculatedDueDate,
        status: types_1.InvoiceStatus.DRAFT,
        subtotal,
        vatAmount,
        total,
        paidAmount: 0,
        qrReference,
        reminderLevel: 0,
        emailSentCount: 0,
        discountCode: discountCode || undefined,
        discountAmount: Math.round(discountAmount * 100),
        items: processedItems,
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date()
    };
    mockData_1.mockInvoices.push(invoice);
    mockData_1.mockInvoiceItems.push(...processedItems);
    const responseInvoice = {
        ...invoice,
        customer
    };
    res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: responseInvoice
    });
});
exports.updateInvoice = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const companyId = ensureCompanyAccess(req);
    const invoiceIndex = mockData_1.mockInvoices.findIndex(i => i.id === id && i.companyId === companyId);
    if (invoiceIndex === -1) {
        res.status(404).json({
            success: false,
            error: 'Invoice not found'
        });
        return;
    }
    const invoice = mockData_1.mockInvoices[invoiceIndex];
    if (invoice.status !== types_1.InvoiceStatus.DRAFT) {
        res.status(400).json({
            success: false,
            error: 'Can only update draft invoices'
        });
        return;
    }
    const { customerId, date, dueDate, items, discountCode, discountAmount } = req.body;
    if (customerId !== undefined) {
        const customer = mockData_1.mockCustomers.find(c => c.id === customerId && c.companyId === companyId);
        if (!customer) {
            res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
            return;
        }
        invoice.customerId = customerId;
    }
    if (date !== undefined)
        invoice.date = new Date(date);
    if (dueDate !== undefined)
        invoice.dueDate = new Date(dueDate);
    if (discountCode !== undefined)
        invoice.discountCode = discountCode;
    if (discountAmount !== undefined)
        invoice.discountAmount = Math.round(discountAmount * 100);
    if (items) {
        const oldItemIds = mockData_1.mockInvoiceItems
            .filter(item => item.invoiceId === id)
            .map(item => item.id);
        oldItemIds.forEach(itemId => {
            const itemIndex = mockData_1.mockInvoiceItems.findIndex(item => item.id === itemId);
            if (itemIndex !== -1) {
                mockData_1.mockInvoiceItems.splice(itemIndex, 1);
            }
        });
        const newItems = items.map((item, index) => {
            const quantity = Math.round(item.quantity * 1000);
            const unitPrice = Math.round(item.unitPrice * 100);
            const discount = Math.round((item.discount || 0) * 100);
            const vatRate = Math.round(item.vatRate * 100);
            const lineSubtotal = Math.round((quantity * unitPrice) / 1000);
            const discountAmount = Math.round((lineSubtotal * discount) / 10000);
            const lineAfterDiscount = lineSubtotal - discountAmount;
            const vatAmount = Math.round((lineAfterDiscount * vatRate) / 10000);
            const lineTotal = lineAfterDiscount;
            return {
                id: (0, mockData_1.generateId)(),
                invoiceId: id,
                description: item.description,
                quantity,
                unit: item.unit || 'Stück',
                unitPrice,
                discount,
                vatRate,
                lineTotal,
                vatAmount,
                sortOrder: index + 1
            };
        });
        mockData_1.mockInvoiceItems.push(...newItems);
        const { subtotal, vatAmount, total } = calculateInvoiceTotals(newItems, invoice.discountAmount);
        invoice.subtotal = subtotal;
        invoice.vatAmount = vatAmount;
        invoice.total = total;
    }
    invoice.updatedAt = new Date();
    mockData_1.mockInvoices[invoiceIndex] = invoice;
    const customer = mockData_1.mockCustomers.find(c => c.id === invoice.customerId);
    const invoiceItems = mockData_1.mockInvoiceItems.filter(item => item.invoiceId === invoice.id);
    const responseInvoice = {
        ...invoice,
        customer,
        items: invoiceItems
    };
    res.json({
        success: true,
        message: 'Invoice updated successfully',
        data: responseInvoice
    });
});
exports.deleteInvoice = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const companyId = ensureCompanyAccess(req);
    const invoiceIndex = mockData_1.mockInvoices.findIndex(i => i.id === id && i.companyId === companyId);
    if (invoiceIndex === -1) {
        res.status(404).json({
            success: false,
            error: 'Invoice not found'
        });
        return;
    }
    const invoice = mockData_1.mockInvoices[invoiceIndex];
    if (invoice.status !== types_1.InvoiceStatus.DRAFT) {
        res.status(400).json({
            success: false,
            error: 'Can only delete draft invoices'
        });
        return;
    }
    const itemsToRemove = mockData_1.mockInvoiceItems.filter(item => item.invoiceId === id);
    itemsToRemove.forEach(item => {
        const itemIndex = mockData_1.mockInvoiceItems.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
            mockData_1.mockInvoiceItems.splice(itemIndex, 1);
        }
    });
    mockData_1.mockInvoices.splice(invoiceIndex, 1);
    res.json({
        success: true,
        message: 'Invoice deleted successfully'
    });
});
exports.updateInvoiceStatus = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const companyId = ensureCompanyAccess(req);
    const invoiceIndex = mockData_1.mockInvoices.findIndex(i => i.id === id && i.companyId === companyId);
    if (invoiceIndex === -1) {
        res.status(404).json({
            success: false,
            error: 'Invoice not found'
        });
        return;
    }
    const invoice = mockData_1.mockInvoices[invoiceIndex];
    const allowedTransitions = {
        [types_1.InvoiceStatus.DRAFT]: [types_1.InvoiceStatus.OPEN, types_1.InvoiceStatus.CANCELLED],
        [types_1.InvoiceStatus.OPEN]: [types_1.InvoiceStatus.PARTIAL_PAID, types_1.InvoiceStatus.PAID, types_1.InvoiceStatus.OVERDUE, types_1.InvoiceStatus.CANCELLED],
        [types_1.InvoiceStatus.PARTIAL_PAID]: [types_1.InvoiceStatus.PAID, types_1.InvoiceStatus.OVERDUE],
        [types_1.InvoiceStatus.PAID]: [],
        [types_1.InvoiceStatus.OVERDUE]: [types_1.InvoiceStatus.PARTIAL_PAID, types_1.InvoiceStatus.PAID],
        [types_1.InvoiceStatus.CANCELLED]: []
    };
    if (!allowedTransitions[invoice.status].includes(status)) {
        res.status(400).json({
            success: false,
            error: `Cannot change status from ${invoice.status} to ${status}`
        });
        return;
    }
    invoice.status = status;
    invoice.updatedAt = new Date();
    if (status === types_1.InvoiceStatus.OPEN && !invoice.sentAt) {
        invoice.sentAt = new Date();
    }
    mockData_1.mockInvoices[invoiceIndex] = invoice;
    res.json({
        success: true,
        message: 'Invoice status updated successfully',
        data: { id: invoice.id, status: invoice.status }
    });
});
exports.getInvoiceStats = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = ensureCompanyAccess(req);
    const companyInvoices = mockData_1.mockInvoices.filter(i => i.companyId === companyId);
    const stats = {
        total: companyInvoices.length,
        byStatus: companyInvoices.reduce((acc, invoice) => {
            acc[invoice.status] = (acc[invoice.status] || 0) + 1;
            return acc;
        }, {}),
        totalAmount: companyInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
        paidAmount: companyInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0),
        outstandingAmount: companyInvoices.reduce((sum, invoice) => sum + (invoice.total - invoice.paidAmount), 0),
        overdueCount: companyInvoices.filter(i => i.status === types_1.InvoiceStatus.OVERDUE).length,
        thisMonth: {
            count: companyInvoices.filter(i => {
                const now = new Date();
                return i.date.getMonth() === now.getMonth() && i.date.getFullYear() === now.getFullYear();
            }).length,
            amount: companyInvoices
                .filter(i => {
                const now = new Date();
                return i.date.getMonth() === now.getMonth() && i.date.getFullYear() === now.getFullYear();
            })
                .reduce((sum, invoice) => sum + invoice.total, 0)
        }
    };
    res.json({
        success: true,
        data: stats
    });
});
//# sourceMappingURL=invoiceControllerOld.js.map