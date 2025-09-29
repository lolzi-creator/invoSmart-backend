"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewEmail = exports.deleteEmailTemplate = exports.updateEmailTemplate = exports.createEmailTemplate = exports.getEmailTemplates = exports.sendReminderEmail = exports.sendInvoiceEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const errorHandler_1 = require("../middleware/errorHandler");
const types_1 = require("../types");
const mockData_1 = require("../data/mockData");
const mockEmailTemplates = [
    {
        id: 'default-invoice-de',
        name: 'Standard Rechnung (Deutsch)',
        subject: 'Rechnung {{invoiceNumber}} von {{companyName}}',
        body: `Sehr geehrte Damen und Herren,

anbei erhalten Sie die Rechnung {{invoiceNumber}} vom {{invoiceDate}} über CHF {{total}}.

Zahlungsziel: {{dueDate}}
Zahlungsreferenz: {{qrReference}}

Vielen Dank für Ihr Vertrauen.

Mit freundlichen Grüssen
{{companyName}}
{{companyAddress}}
{{companyCity}}

Diese E-Mail wurde automatisch generiert.`,
        type: types_1.EmailType.INVOICE,
        language: 'de',
        companyId: '',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'default-reminder1-de',
        name: '1. Mahnung (Deutsch)',
        subject: '1. Zahlungserinnerung - Rechnung {{invoiceNumber}}',
        body: `Sehr geehrte Damen und Herren,

unsere Rechnung {{invoiceNumber}} vom {{invoiceDate}} über CHF {{total}} ist seit dem {{dueDate}} fällig.

Falls Sie die Zahlung bereits geleistet haben, betrachten Sie dieses Schreiben als gegenstandslos.

Andernfalls bitten wir Sie, den offenen Betrag binnen 10 Tagen zu begleichen.

Zahlungsreferenz: {{qrReference}}

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüssen
{{companyName}}`,
        type: types_1.EmailType.REMINDER_1,
        language: 'de',
        companyId: '',
        createdAt: new Date(),
        updatedAt: new Date()
    }
];
const ensureCompanyAccess = (req) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        throw new Error('Company access required');
    }
    return companyId;
};
const createTransporter = () => {
    return nodemailer_1.default.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
            user: 'test@ethereal.email',
            pass: 'test123'
        }
    });
};
const replaceTemplateVariables = (template, invoice, customer, company) => {
    const variables = {
        '{{invoiceNumber}}': invoice.number,
        '{{invoiceDate}}': invoice.date.toLocaleDateString('de-CH'),
        '{{dueDate}}': invoice.dueDate.toLocaleDateString('de-CH'),
        '{{total}}': (invoice.total / 100).toLocaleString('de-CH', { minimumFractionDigits: 2 }),
        '{{subtotal}}': (invoice.subtotal / 100).toLocaleString('de-CH', { minimumFractionDigits: 2 }),
        '{{vatAmount}}': (invoice.vatAmount / 100).toLocaleString('de-CH', { minimumFractionDigits: 2 }),
        '{{paidAmount}}': (invoice.paidAmount / 100).toLocaleString('de-CH', { minimumFractionDigits: 2 }),
        '{{outstandingAmount}}': ((invoice.total - invoice.paidAmount) / 100).toLocaleString('de-CH', { minimumFractionDigits: 2 }),
        '{{qrReference}}': invoice.qrReference,
        '{{reminderLevel}}': invoice.reminderLevel.toString(),
        '{{customerName}}': customer.name,
        '{{customerCompany}}': customer.company || '',
        '{{customerAddress}}': customer.address,
        '{{customerZip}}': customer.zip,
        '{{customerCity}}': customer.city,
        '{{customerEmail}}': customer.email || '',
        '{{companyName}}': company.name,
        '{{companyAddress}}': company.address,
        '{{companyZip}}': company.zip,
        '{{companyCity}}': company.city,
        '{{companyPhone}}': company.phone || '',
        '{{companyEmail}}': company.email,
        '{{companyWebsite}}': company.website || '',
        '{{companyUid}}': company.uid || '',
        '{{companyVatNumber}}': company.vatNumber || '',
        '{{companyIban}}': company.iban || '',
        '{{currentDate}}': new Date().toLocaleDateString('de-CH'),
        '{{currentYear}}': new Date().getFullYear().toString()
    };
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
        result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });
    return result;
};
const getEmailTemplate = (companyId, type, language = 'de') => {
    let template = mockEmailTemplates.find(t => t.companyId === companyId &&
        t.type === type &&
        t.language === language);
    if (!template) {
        template = mockEmailTemplates.find(t => t.companyId === '' &&
            t.type === type &&
            t.language === language);
    }
    if (template && template.companyId === '') {
        const companyCopy = {
            ...template,
            id: (0, mockData_1.generateId)(),
            companyId,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        mockEmailTemplates.push(companyCopy);
        return companyCopy;
    }
    if (!template) {
        throw new Error(`No email template found for type ${type} and language ${language}`);
    }
    return template;
};
exports.sendInvoiceEmail = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { invoiceId } = req.params;
    const { templateId, customSubject, customBody } = req.body;
    const companyId = ensureCompanyAccess(req);
    const invoice = mockData_1.mockInvoices.find(i => i.id === invoiceId && i.companyId === companyId);
    if (!invoice) {
        res.status(404).json({
            success: false,
            error: 'Invoice not found'
        });
        return;
    }
    const customer = mockData_1.mockCustomers.find(c => c.id === invoice.customerId);
    if (!customer || !customer.email) {
        res.status(400).json({
            success: false,
            error: 'Customer email not found'
        });
        return;
    }
    const company = mockData_1.mockCompanies.find(c => c.id === companyId);
    if (!company) {
        res.status(404).json({
            success: false,
            error: 'Company not found'
        });
        return;
    }
    try {
        let template;
        if (templateId) {
            const customTemplate = mockEmailTemplates.find(t => t.id === templateId && t.companyId === companyId);
            if (!customTemplate) {
                res.status(404).json({
                    success: false,
                    error: 'Email template not found'
                });
                return;
            }
            template = customTemplate;
        }
        else {
            template = getEmailTemplate(companyId, types_1.EmailType.INVOICE, customer.language);
        }
        const subject = customSubject || replaceTemplateVariables(template.subject, invoice, customer, company);
        const body = customBody || replaceTemplateVariables(template.body, invoice, customer, company);
        const transporter = createTransporter();
        const mailOptions = {
            from: `"${company.name}" <${company.email}>`,
            to: customer.email,
            subject,
            text: body,
            html: body.replace(/\n/g, '<br>')
        };
        const info = await transporter.sendMail(mailOptions);
        invoice.emailSentCount++;
        invoice.sentAt = new Date();
        invoice.updatedAt = new Date();
        const invoiceIndex = mockData_1.mockInvoices.findIndex(i => i.id === invoice.id);
        if (invoiceIndex !== -1) {
            mockData_1.mockInvoices[invoiceIndex] = invoice;
        }
        res.json({
            success: true,
            message: 'Invoice email sent successfully',
            data: {
                messageId: info.messageId,
                preview: nodemailer_1.default.getTestMessageUrl(info),
                to: customer.email,
                subject,
                sentAt: new Date()
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to send email',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.sendReminderEmail = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { invoiceId } = req.params;
    const { level = 1, templateId, customSubject, customBody } = req.body;
    const companyId = ensureCompanyAccess(req);
    const invoice = mockData_1.mockInvoices.find(i => i.id === invoiceId && i.companyId === companyId);
    if (!invoice) {
        res.status(404).json({
            success: false,
            error: 'Invoice not found'
        });
        return;
    }
    if (invoice.dueDate > new Date()) {
        res.status(400).json({
            success: false,
            error: 'Invoice is not yet overdue'
        });
        return;
    }
    if (invoice.paidAmount >= invoice.total) {
        res.status(400).json({
            success: false,
            error: 'Invoice is already paid'
        });
        return;
    }
    const customer = mockData_1.mockCustomers.find(c => c.id === invoice.customerId);
    if (!customer || !customer.email) {
        res.status(400).json({
            success: false,
            error: 'Customer email not found'
        });
        return;
    }
    const company = mockData_1.mockCompanies.find(c => c.id === companyId);
    if (!company) {
        res.status(404).json({
            success: false,
            error: 'Company not found'
        });
        return;
    }
    try {
        const reminderTypes = [types_1.EmailType.REMINDER_1, types_1.EmailType.REMINDER_2, types_1.EmailType.REMINDER_3];
        const reminderType = reminderTypes[Math.min(level - 1, 2)];
        let template;
        if (templateId) {
            const customTemplate = mockEmailTemplates.find(t => t.id === templateId && t.companyId === companyId);
            if (!customTemplate) {
                res.status(404).json({
                    success: false,
                    error: 'Email template not found'
                });
                return;
            }
            template = customTemplate;
        }
        else {
            template = getEmailTemplate(companyId, reminderType, customer.language);
        }
        const subject = customSubject || replaceTemplateVariables(template.subject, invoice, customer, company);
        const body = customBody || replaceTemplateVariables(template.body, invoice, customer, company);
        const transporter = createTransporter();
        const mailOptions = {
            from: `"${company.name}" <${company.email}>`,
            to: customer.email,
            subject,
            text: body,
            html: body.replace(/\n/g, '<br>')
        };
        const info = await transporter.sendMail(mailOptions);
        invoice.reminderLevel = Math.max(invoice.reminderLevel, level);
        invoice.lastReminderAt = new Date();
        invoice.emailSentCount++;
        invoice.status = types_1.InvoiceStatus.OVERDUE;
        invoice.updatedAt = new Date();
        const invoiceIndex = mockData_1.mockInvoices.findIndex(i => i.id === invoice.id);
        if (invoiceIndex !== -1) {
            mockData_1.mockInvoices[invoiceIndex] = invoice;
        }
        res.json({
            success: true,
            message: `Reminder level ${level} sent successfully`,
            data: {
                messageId: info.messageId,
                preview: nodemailer_1.default.getTestMessageUrl(info),
                to: customer.email,
                subject,
                reminderLevel: level,
                sentAt: new Date()
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to send reminder email',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.getEmailTemplates = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = ensureCompanyAccess(req);
    const { type, language } = req.query;
    let templates = mockEmailTemplates.filter(t => t.companyId === companyId || t.companyId === '');
    if (type) {
        templates = templates.filter(t => t.type === type);
    }
    if (language) {
        templates = templates.filter(t => t.language === language);
    }
    res.json({
        success: true,
        data: templates
    });
});
exports.createEmailTemplate = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = ensureCompanyAccess(req);
    const { name, subject, body, type, language = 'de' } = req.body;
    const existingTemplate = mockEmailTemplates.find(t => t.companyId === companyId &&
        t.name.toLowerCase() === name.toLowerCase());
    if (existingTemplate) {
        res.status(409).json({
            success: false,
            error: 'Template with this name already exists'
        });
        return;
    }
    const template = {
        id: (0, mockData_1.generateId)(),
        name,
        subject,
        body,
        type,
        language,
        companyId,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    mockEmailTemplates.push(template);
    res.status(201).json({
        success: true,
        message: 'Email template created successfully',
        data: template
    });
});
exports.updateEmailTemplate = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const companyId = ensureCompanyAccess(req);
    const templateIndex = mockEmailTemplates.findIndex(t => t.id === id && t.companyId === companyId);
    if (templateIndex === -1) {
        res.status(404).json({
            success: false,
            error: 'Email template not found'
        });
        return;
    }
    const template = mockEmailTemplates[templateIndex];
    const { name, subject, body, type, language } = req.body;
    if (name && name !== template.name) {
        const nameConflict = mockEmailTemplates.some(t => t.companyId === companyId &&
            t.name.toLowerCase() === name.toLowerCase() &&
            t.id !== id);
        if (nameConflict) {
            res.status(409).json({
                success: false,
                error: 'Template name already in use'
            });
            return;
        }
    }
    if (name !== undefined)
        template.name = name;
    if (subject !== undefined)
        template.subject = subject;
    if (body !== undefined)
        template.body = body;
    if (type !== undefined)
        template.type = type;
    if (language !== undefined)
        template.language = language;
    template.updatedAt = new Date();
    mockEmailTemplates[templateIndex] = template;
    res.json({
        success: true,
        message: 'Email template updated successfully',
        data: template
    });
});
exports.deleteEmailTemplate = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const companyId = ensureCompanyAccess(req);
    const templateIndex = mockEmailTemplates.findIndex(t => t.id === id && t.companyId === companyId);
    if (templateIndex === -1) {
        res.status(404).json({
            success: false,
            error: 'Email template not found'
        });
        return;
    }
    if (mockEmailTemplates[templateIndex].companyId === '') {
        res.status(400).json({
            success: false,
            error: 'Cannot delete default template'
        });
        return;
    }
    mockEmailTemplates.splice(templateIndex, 1);
    res.json({
        success: true,
        message: 'Email template deleted successfully'
    });
});
exports.previewEmail = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { invoiceId } = req.params;
    const { templateId, type = 'INVOICE', customSubject, customBody } = req.body;
    const companyId = ensureCompanyAccess(req);
    const invoice = mockData_1.mockInvoices.find(i => i.id === invoiceId && i.companyId === companyId);
    if (!invoice) {
        res.status(404).json({
            success: false,
            error: 'Invoice not found'
        });
        return;
    }
    const customer = mockData_1.mockCustomers.find(c => c.id === invoice.customerId);
    if (!customer) {
        res.status(404).json({
            success: false,
            error: 'Customer not found'
        });
        return;
    }
    const company = mockData_1.mockCompanies.find(c => c.id === companyId);
    if (!company) {
        res.status(404).json({
            success: false,
            error: 'Company not found'
        });
        return;
    }
    try {
        let template;
        if (templateId) {
            const customTemplate = mockEmailTemplates.find(t => t.id === templateId && t.companyId === companyId);
            if (!customTemplate) {
                res.status(404).json({
                    success: false,
                    error: 'Email template not found'
                });
                return;
            }
            template = customTemplate;
        }
        else {
            template = getEmailTemplate(companyId, type, customer.language);
        }
        const subject = customSubject || replaceTemplateVariables(template.subject, invoice, customer, company);
        const body = customBody || replaceTemplateVariables(template.body, invoice, customer, company);
        res.json({
            success: true,
            data: {
                template: {
                    id: template.id,
                    name: template.name,
                    type: template.type
                },
                preview: {
                    from: `"${company.name}" <${company.email}>`,
                    to: customer.email || 'customer@example.com',
                    subject,
                    body,
                    html: body.replace(/\n/g, '<br>')
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to generate preview',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
//# sourceMappingURL=emailControllerOld.js.map