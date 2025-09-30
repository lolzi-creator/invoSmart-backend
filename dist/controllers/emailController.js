"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewEmail = exports.sendReminderEmail = exports.sendInvoiceEmail = exports.deleteEmailTemplate = exports.updateEmailTemplate = exports.createEmailTemplate = exports.getEmailTemplates = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const errorHandler_1 = require("../middleware/errorHandler");
const supabase_1 = require("../lib/supabase");
const config_1 = require("../config");
const createEmailTemplateResponse = (dbTemplate) => {
    return {
        id: dbTemplate.id,
        companyId: dbTemplate.company_id,
        name: dbTemplate.name,
        subject: dbTemplate.subject,
        body: dbTemplate.body,
        type: dbTemplate.type,
        language: dbTemplate.language,
        isActive: dbTemplate.is_active,
        createdAt: new Date(dbTemplate.created_at),
        updatedAt: new Date(dbTemplate.updated_at)
    };
};
const createTransporter = () => {
    return nodemailer_1.default.createTransport({
        host: config_1.config.smtp.host,
        port: config_1.config.smtp.port,
        secure: config_1.config.smtp.port === 465,
        auth: {
            user: config_1.config.smtp.user,
            pass: config_1.config.smtp.pass
        }
    });
};
const replaceTemplateVariables = (template, data) => {
    let result = template;
    if (data.invoice) {
        result = result
            .replace(/{{invoiceNumber}}/g, data.invoice.number)
            .replace(/{{invoiceDate}}/g, new Date(data.invoice.date).toLocaleDateString('de-CH'))
            .replace(/{{dueDate}}/g, new Date(data.invoice.due_date).toLocaleDateString('de-CH'))
            .replace(/{{total}}/g, data.invoice.total.toFixed(2))
            .replace(/{{subtotal}}/g, data.invoice.subtotal.toFixed(2))
            .replace(/{{vatAmount}}/g, data.invoice.vat_amount.toFixed(2))
            .replace(/{{qrReference}}/g, data.invoice.qr_reference);
    }
    if (data.customer) {
        result = result
            .replace(/{{customerName}}/g, data.customer.name)
            .replace(/{{customerCompany}}/g, data.customer.company || '')
            .replace(/{{customerAddress}}/g, data.customer.address)
            .replace(/{{customerZip}}/g, data.customer.zip)
            .replace(/{{customerCity}}/g, data.customer.city);
    }
    if (data.company) {
        result = result
            .replace(/{{companyName}}/g, data.company.name)
            .replace(/{{companyAddress}}/g, data.company.address)
            .replace(/{{companyZip}}/g, data.company.zip)
            .replace(/{{companyCity}}/g, data.company.city)
            .replace(/{{companyPhone}}/g, data.company.phone || '')
            .replace(/{{companyEmail}}/g, data.company.email)
            .replace(/{{companyWebsite}}/g, data.company.website || '');
    }
    return result;
};
exports.getEmailTemplates = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data, error } = await supabase_1.db.emailTemplates()
            .select('*')
            .eq('company_id', companyId)
            .order('name', { ascending: true });
        if (error) {
            (0, supabase_1.handleSupabaseError)(error, 'get email templates');
            return;
        }
        const templates = data.map(createEmailTemplateResponse);
        res.json({
            success: true,
            data: { templates }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'get email templates');
    }
});
exports.createEmailTemplate = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    const { name, subject, body, type, language = 'de' } = req.body;
    try {
        const templateData = {
            company_id: companyId,
            name,
            subject,
            body,
            type,
            language,
            is_active: true
        };
        const { data, error } = await supabase_1.db.emailTemplates()
            .insert(templateData)
            .select()
            .single();
        if (error || !data) {
            (0, supabase_1.handleSupabaseError)(error, 'create email template');
            return;
        }
        const template = createEmailTemplateResponse(data);
        res.status(201).json({
            success: true,
            message: 'Email template created successfully',
            data: { template }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'create email template');
    }
});
exports.updateEmailTemplate = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const templateId = req.params.id;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    const { name, subject, body, type, language, isActive } = req.body;
    try {
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (subject !== undefined)
            updateData.subject = subject;
        if (body !== undefined)
            updateData.body = body;
        if (type !== undefined)
            updateData.type = type;
        if (language !== undefined)
            updateData.language = language;
        if (isActive !== undefined)
            updateData.is_active = isActive;
        const { data, error } = await supabase_1.db.emailTemplates()
            .update(updateData)
            .eq('id', templateId)
            .eq('company_id', companyId)
            .select()
            .single();
        if (error || !data) {
            res.status(404).json({
                success: false,
                error: 'Email template not found'
            });
            return;
        }
        const template = createEmailTemplateResponse(data);
        res.json({
            success: true,
            message: 'Email template updated successfully',
            data: { template }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'update email template');
    }
});
exports.deleteEmailTemplate = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const templateId = req.params.id;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { error } = await supabase_1.db.emailTemplates()
            .delete()
            .eq('id', templateId)
            .eq('company_id', companyId);
        if (error) {
            (0, supabase_1.handleSupabaseError)(error, 'delete email template');
            return;
        }
        res.json({
            success: true,
            message: 'Email template deleted successfully'
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'delete email template');
    }
});
exports.sendInvoiceEmail = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const invoiceId = req.params.invoiceId;
    const { templateId, recipientEmail } = req.body;
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
        companies (*)
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
        const { data: template, error: templateError } = await supabase_1.db.emailTemplates()
            .select('*')
            .eq('id', templateId)
            .eq('company_id', companyId)
            .single();
        if (templateError || !template) {
            res.status(404).json({
                success: false,
                error: 'Email template not found'
            });
            return;
        }
        const emailSubject = replaceTemplateVariables(template.subject, {
            invoice: invoiceData,
            customer: invoiceData.customers,
            company: invoiceData.companies
        });
        const emailBody = replaceTemplateVariables(template.body, {
            invoice: invoiceData,
            customer: invoiceData.customers,
            company: invoiceData.companies
        });
        const transporter = createTransporter();
        const recipient = recipientEmail || invoiceData.customers.email;
        if (!recipient) {
            res.status(400).json({
                success: false,
                error: 'No recipient email address provided'
            });
            return;
        }
        const mailOptions = {
            from: `"${invoiceData.companies.name}" <${config_1.config.smtp.user}>`,
            to: recipient,
            subject: emailSubject,
            text: emailBody,
            html: emailBody.replace(/\n/g, '<br>')
        };
        try {
            await transporter.sendMail(mailOptions);
            await supabase_1.db.invoices()
                .update({
                email_sent_count: invoiceData.email_sent_count + 1,
                sent_at: new Date().toISOString()
            })
                .eq('id', invoiceId);
            res.json({
                success: true,
                message: 'Invoice email sent successfully',
                data: {
                    recipient,
                    subject: emailSubject
                }
            });
        }
        catch (emailError) {
            console.error('Failed to send email:', emailError);
            res.status(500).json({
                success: false,
                error: 'Failed to send email'
            });
        }
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'send invoice email');
    }
});
exports.sendReminderEmail = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const invoiceId = req.params.invoiceId;
    const { templateId, recipientEmail } = req.body;
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
        companies (*)
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
        if (!['OPEN', 'PARTIAL_PAID', 'OVERDUE'].includes(invoiceData.status)) {
            res.status(400).json({
                success: false,
                error: 'Cannot send reminder for paid or cancelled invoice'
            });
            return;
        }
        const { data: template, error: templateError } = await supabase_1.db.emailTemplates()
            .select('*')
            .eq('id', templateId)
            .eq('company_id', companyId)
            .single();
        if (templateError || !template) {
            res.status(404).json({
                success: false,
                error: 'Email template not found'
            });
            return;
        }
        const emailSubject = replaceTemplateVariables(template.subject, {
            invoice: invoiceData,
            customer: invoiceData.customers,
            company: invoiceData.companies
        });
        const emailBody = replaceTemplateVariables(template.body, {
            invoice: invoiceData,
            customer: invoiceData.customers,
            company: invoiceData.companies
        });
        const transporter = createTransporter();
        const recipient = recipientEmail || invoiceData.customers.email;
        if (!recipient) {
            res.status(400).json({
                success: false,
                error: 'No recipient email address provided'
            });
            return;
        }
        const mailOptions = {
            from: `"${invoiceData.companies.name}" <${config_1.config.smtp.user}>`,
            to: recipient,
            subject: emailSubject,
            text: emailBody,
            html: emailBody.replace(/\n/g, '<br>')
        };
        try {
            await transporter.sendMail(mailOptions);
            await supabase_1.db.invoices()
                .update({
                reminder_level: invoiceData.reminder_level + 1,
                last_reminder_at: new Date().toISOString(),
                status: 'OVERDUE'
            })
                .eq('id', invoiceId);
            res.json({
                success: true,
                message: 'Reminder email sent successfully',
                data: {
                    recipient,
                    subject: emailSubject,
                    reminderLevel: invoiceData.reminder_level + 1
                }
            });
        }
        catch (emailError) {
            console.error('Failed to send reminder email:', emailError);
            res.status(500).json({
                success: false,
                error: 'Failed to send reminder email'
            });
        }
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'send reminder email');
    }
});
exports.previewEmail = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const invoiceId = req.params.invoiceId;
    const { templateId } = req.query;
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
        companies (*)
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
        const { data: template, error: templateError } = await supabase_1.db.emailTemplates()
            .select('*')
            .eq('id', templateId)
            .eq('company_id', companyId)
            .single();
        if (templateError || !template) {
            res.status(404).json({
                success: false,
                error: 'Email template not found'
            });
            return;
        }
        const previewSubject = replaceTemplateVariables(template.subject, {
            invoice: invoiceData,
            customer: invoiceData.customers,
            company: invoiceData.companies
        });
        const previewBody = replaceTemplateVariables(template.body, {
            invoice: invoiceData,
            customer: invoiceData.customers,
            company: invoiceData.companies
        });
        res.json({
            success: true,
            data: {
                template: createEmailTemplateResponse(template),
                preview: {
                    subject: previewSubject,
                    body: previewBody,
                    recipient: invoiceData.customers.email || 'Keine E-Mail-Adresse hinterlegt'
                }
            }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'preview email');
    }
});
//# sourceMappingURL=emailController.js.map