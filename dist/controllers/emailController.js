"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testEmail = exports.sendBulkReminders = exports.sendInvoiceNotification = exports.sendInvoiceReminder = void 0;
const supabase_1 = require("../lib/supabase");
const emailService_1 = __importDefault(require("../services/emailService"));
const sendInvoiceReminder = async (req, res) => {
    try {
        const { invoiceId, reminderLevel = 1 } = req.body;
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Company ID required' });
        }
        if (!invoiceId) {
            return res.status(400).json({ error: 'Invoice ID required' });
        }
        const { data: invoice, error: invoiceError } = await supabase_1.supabase
            .from('invoices')
            .select(`
        *,
        customers (*),
        companies (*)
      `)
            .eq('id', invoiceId)
            .eq('company_id', companyId)
            .single();
        if (invoiceError || !invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        const invoiceData = invoice;
        const emailService = new emailService_1.default();
        const result = await emailService.sendInvoiceReminder({
            invoice: invoiceData,
            customer: invoiceData.customers,
            company: invoiceData.companies,
            reminderLevel
        });
        if (result.success) {
            await supabase_1.supabase
                .from('invoices')
                .update({
                reminder_level: reminderLevel,
                last_reminder_at: new Date().toISOString()
            })
                .eq('id', invoiceId);
            return res.json({
                success: true,
                message: 'Reminder sent successfully',
                data: result
            });
        }
        else {
            return res.status(500).json({
                success: false,
                error: 'Failed to send reminder',
                details: result.error
            });
        }
    }
    catch (error) {
        console.error('Error sending reminder:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};
exports.sendInvoiceReminder = sendInvoiceReminder;
const sendInvoiceNotification = async (req, res) => {
    try {
        const { invoiceId } = req.body;
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Company ID required' });
        }
        if (!invoiceId) {
            return res.status(400).json({ error: 'Invoice ID required' });
        }
        const { data: invoice, error: invoiceError } = await supabase_1.supabase
            .from('invoices')
            .select(`
        *,
        customers (*),
        companies (*)
      `)
            .eq('id', invoiceId)
            .eq('company_id', companyId)
            .single();
        if (invoiceError || !invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        const invoiceData = invoice;
        const emailService = new emailService_1.default();
        const result = await emailService.sendInvoiceNotification({
            invoice: invoiceData,
            customer: invoiceData.customers,
            company: invoiceData.companies
        });
        if (result.success) {
            await supabase_1.supabase
                .from('invoices')
                .update({
                sent_at: new Date().toISOString(),
                email_sent_count: (invoiceData.email_sent_count || 0) + 1
            })
                .eq('id', invoiceId);
            return res.json({
                success: true,
                message: 'Notification sent successfully',
                data: result
            });
        }
        else {
            return res.status(500).json({
                success: false,
                error: 'Failed to send notification',
                details: result.error
            });
        }
    }
    catch (error) {
        console.error('Error sending notification:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};
exports.sendInvoiceNotification = sendInvoiceNotification;
const sendBulkReminders = async (req, res) => {
    try {
        const { reminderLevel = 1 } = req.body;
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Company ID required' });
        }
        const { data: invoices, error: invoicesError } = await supabase_1.supabase
            .from('invoices')
            .select(`
        *,
        customers (*),
        companies (*)
      `)
            .eq('company_id', companyId)
            .in('status', ['OPEN', 'PARTIAL_PAID'])
            .lt('due_date', new Date().toISOString().split('T')[0]);
        if (invoicesError) {
            return res.status(500).json({ error: 'Failed to fetch invoices' });
        }
        if (!invoices || invoices.length === 0) {
            return res.json({
                success: true,
                message: 'No overdue invoices found',
                sent: 0
            });
        }
        const emailService = new emailService_1.default();
        let sentCount = 0;
        const errors = [];
        for (const invoice of invoices) {
            try {
                const invoiceData = invoice;
                const result = await emailService.sendInvoiceReminder({
                    invoice: invoiceData,
                    customer: invoiceData.customers,
                    company: invoiceData.companies,
                    reminderLevel
                });
                if (result.success) {
                    await supabase_1.supabase
                        .from('invoices')
                        .update({
                        reminder_level: reminderLevel,
                        last_reminder_at: new Date().toISOString()
                    })
                        .eq('id', invoice.id);
                    sentCount++;
                }
                else {
                    errors.push(`Invoice ${invoice.number}: ${result.error}`);
                }
            }
            catch (error) {
                errors.push(`Invoice ${invoice.number}: ${error}`);
            }
        }
        return res.json({
            success: true,
            message: `Bulk reminders sent: ${sentCount}/${invoices.length}`,
            sent: sentCount,
            total: invoices.length,
            errors: errors.length > 0 ? errors : undefined
        });
    }
    catch (error) {
        console.error('Error sending bulk reminders:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};
exports.sendBulkReminders = sendBulkReminders;
const testEmail = async (req, res) => {
    try {
        const { email } = req.body;
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Company ID required' });
        }
        if (!email) {
            return res.status(400).json({ error: 'Email address required' });
        }
        const { data: company, error: companyError } = await supabase_1.supabase
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .single();
        if (companyError || !company) {
            return res.status(404).json({ error: 'Company not found' });
        }
        const testInvoiceData = {
            id: 'test',
            number: 'TEST-2025-001',
            date: new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            subtotal: 100000,
            vat_amount: 8000,
            total: 108000,
            status: 'OPEN',
            customers: {
                name: 'Test Customer',
                email: email,
                company: 'Test Company Ltd.',
                language: 'de'
            },
            companies: company
        };
        const emailService = new emailService_1.default();
        const result = await emailService.sendInvoiceReminder({
            invoice: testInvoiceData,
            customer: testInvoiceData.customers,
            company: testInvoiceData.companies,
            reminderLevel: 1
        });
        if (result.success) {
            return res.json({
                success: true,
                message: 'Email sent successfully',
                data: result
            });
        }
        else {
            return res.status(500).json({
                success: false,
                error: 'Failed to send email',
                details: result.error
            });
        }
    }
    catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};
exports.testEmail = testEmail;
//# sourceMappingURL=emailController.js.map