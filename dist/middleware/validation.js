"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemas = exports.validateRequest = void 0;
const joi_1 = __importDefault(require("joi"));
const validateRequest = (schema) => {
    return (req, res, next) => {
        const errors = [];
        if (schema.body) {
            const { error } = schema.body.validate(req.body);
            if (error) {
                errors.push(`Body: ${error.details.map(d => d.message).join(', ')}`);
            }
        }
        if (schema.query) {
            const { error } = schema.query.validate(req.query);
            if (error) {
                errors.push(`Query: ${error.details.map(d => d.message).join(', ')}`);
            }
        }
        if (schema.params) {
            const { error } = schema.params.validate(req.params);
            if (error) {
                errors.push(`Params: ${error.details.map(d => d.message).join(', ')}`);
            }
        }
        if (errors.length > 0) {
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
            return;
        }
        next();
    };
};
exports.validateRequest = validateRequest;
exports.schemas = {
    pagination: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(100).default(20),
        sortBy: joi_1.default.string().optional(),
        sortOrder: joi_1.default.string().valid('asc', 'desc').default('desc')
    }),
    id: joi_1.default.object({
        id: joi_1.default.string().required()
    }),
    companyId: joi_1.default.object({
        companyId: joi_1.default.string().required()
    }),
    login: joi_1.default.object({
        email: joi_1.default.string().email().required(),
        password: joi_1.default.string().min(6).required()
    }),
    register: joi_1.default.object({
        name: joi_1.default.string().min(2).max(100).required(),
        email: joi_1.default.string().email().required(),
        password: joi_1.default.string().min(6).required(),
        companyName: joi_1.default.string().min(2).max(100).required(),
        address: joi_1.default.string().min(5).max(200).required(),
        zip: joi_1.default.string().min(4).max(10).required(),
        city: joi_1.default.string().min(2).max(100).required(),
        phone: joi_1.default.string().optional(),
        companyEmail: joi_1.default.string().email().required(),
        uid: joi_1.default.string().optional(),
        vatNumber: joi_1.default.string().optional(),
        iban: joi_1.default.string().optional()
    }),
    createCustomer: joi_1.default.object({
        name: joi_1.default.string().min(2).max(100).required(),
        company: joi_1.default.string().max(100).optional(),
        address: joi_1.default.string().min(5).max(200).required(),
        zip: joi_1.default.string().min(4).max(10).required(),
        city: joi_1.default.string().min(2).max(100).required(),
        country: joi_1.default.string().length(2).default('CH'),
        email: joi_1.default.string().email().optional(),
        phone: joi_1.default.string().optional(),
        uid: joi_1.default.string().optional(),
        vatNumber: joi_1.default.string().optional(),
        paymentTerms: joi_1.default.number().integer().min(0).max(365).default(30),
        creditLimit: joi_1.default.number().integer().min(0).optional(),
        language: joi_1.default.string().valid('de', 'fr', 'it', 'en').default('de'),
        notes: joi_1.default.string().max(1000).optional()
    }),
    updateCustomer: joi_1.default.object({
        name: joi_1.default.string().min(2).max(100).optional(),
        company: joi_1.default.string().max(100).optional(),
        address: joi_1.default.string().min(5).max(200).optional(),
        zip: joi_1.default.string().min(4).max(10).optional(),
        city: joi_1.default.string().min(2).max(100).optional(),
        country: joi_1.default.string().length(2).optional(),
        email: joi_1.default.string().email().optional(),
        phone: joi_1.default.string().optional(),
        uid: joi_1.default.string().optional(),
        vatNumber: joi_1.default.string().optional(),
        paymentTerms: joi_1.default.number().integer().min(0).max(365).optional(),
        creditLimit: joi_1.default.number().integer().min(0).optional(),
        language: joi_1.default.string().valid('de', 'fr', 'it', 'en').optional(),
        notes: joi_1.default.string().max(1000).optional(),
        isActive: joi_1.default.boolean().optional()
    }),
    createInvoice: joi_1.default.object({
        customerId: joi_1.default.string().required(),
        date: joi_1.default.date().optional(),
        dueDate: joi_1.default.date().optional(),
        discountCode: joi_1.default.string().optional(),
        discountAmount: joi_1.default.number().min(0).default(0),
        items: joi_1.default.array().items(joi_1.default.object({
            description: joi_1.default.string().min(1).max(500).required(),
            quantity: joi_1.default.number().positive().required(),
            unit: joi_1.default.string().max(20).default('Stück'),
            unitPrice: joi_1.default.number().min(0).required(),
            discount: joi_1.default.number().min(0).max(100).default(0),
            vatRate: joi_1.default.number().min(0).max(100).required()
        })).min(1).required()
    }),
    updateInvoice: joi_1.default.object({
        customerId: joi_1.default.string().optional(),
        date: joi_1.default.date().optional(),
        dueDate: joi_1.default.date().optional(),
        status: joi_1.default.string().valid('DRAFT', 'SENT', 'PAID', 'OVERDUE').optional(),
        discountCode: joi_1.default.string().optional(),
        discountAmount: joi_1.default.number().min(0).optional(),
        internalNotes: joi_1.default.string().allow('').optional(),
        items: joi_1.default.array().items(joi_1.default.object({
            description: joi_1.default.string().min(1).max(500).required(),
            quantity: joi_1.default.number().positive().required(),
            unit: joi_1.default.string().max(20).default('Stück'),
            unitPrice: joi_1.default.number().min(0).required(),
            discount: joi_1.default.number().min(0).max(100).default(0),
            vatRate: joi_1.default.number().min(0).max(100).required()
        })).min(1).optional()
    }),
    updateInvoiceStatus: joi_1.default.object({
        status: joi_1.default.string().valid('DRAFT', 'OPEN', 'PARTIAL_PAID', 'PAID', 'OVERDUE', 'CANCELLED').required()
    }),
    createPayment: joi_1.default.object({
        invoiceId: joi_1.default.string().optional(),
        amount: joi_1.default.number().positive().required(),
        valueDate: joi_1.default.date().required(),
        reference: joi_1.default.string().optional(),
        description: joi_1.default.string().max(500).optional(),
        notes: joi_1.default.string().max(1000).optional()
    }),
    matchPayment: joi_1.default.object({
        invoiceId: joi_1.default.string().optional().allow(null)
    }),
    importPayments: joi_1.default.object({
        payments: joi_1.default.array().items(joi_1.default.object({
            amount: joi_1.default.number().positive().required(),
            valueDate: joi_1.default.date().required(),
            reference: joi_1.default.string().optional(),
            description: joi_1.default.string().max(500).optional(),
            notes: joi_1.default.string().max(1000).optional()
        })).min(1).max(10000).required(),
        importBatch: joi_1.default.string().optional()
    }),
    sendEmail: joi_1.default.object({
        templateId: joi_1.default.string().optional(),
        customSubject: joi_1.default.string().max(200).optional(),
        customBody: joi_1.default.string().optional()
    }),
    sendReminder: joi_1.default.object({
        level: joi_1.default.number().integer().min(1).max(3).default(1),
        templateId: joi_1.default.string().optional(),
        customSubject: joi_1.default.string().max(200).optional(),
        customBody: joi_1.default.string().optional()
    }),
    previewEmail: joi_1.default.object({
        templateId: joi_1.default.string().optional(),
        type: joi_1.default.string().valid('INVOICE', 'REMINDER_1', 'REMINDER_2', 'REMINDER_3').default('INVOICE'),
        customSubject: joi_1.default.string().max(200).optional(),
        customBody: joi_1.default.string().optional()
    }),
    createEmailTemplate: joi_1.default.object({
        name: joi_1.default.string().min(1).max(100).required(),
        subject: joi_1.default.string().min(1).max(200).required(),
        body: joi_1.default.string().min(1).required(),
        type: joi_1.default.string().valid('INVOICE', 'REMINDER_1', 'REMINDER_2', 'REMINDER_3').required(),
        language: joi_1.default.string().valid('de', 'fr', 'it', 'en').default('de')
    }),
    updateEmailTemplate: joi_1.default.object({
        name: joi_1.default.string().min(1).max(100).optional(),
        subject: joi_1.default.string().min(1).max(200).optional(),
        body: joi_1.default.string().min(1).optional(),
        type: joi_1.default.string().valid('INVOICE', 'REMINDER_1', 'REMINDER_2', 'REMINDER_3').optional(),
        language: joi_1.default.string().valid('de', 'fr', 'it', 'en').optional()
    })
};
//# sourceMappingURL=validation.js.map