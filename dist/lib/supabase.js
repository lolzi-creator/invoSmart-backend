"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQRReference = exports.generateInvoiceNumber = exports.handleSupabaseError = exports.db = exports.supabaseAdmin = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("../config");
exports.supabase = (0, supabase_js_1.createClient)(config_1.config.supabase.url, config_1.config.supabase.anonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: false
    }
});
exports.supabaseAdmin = (0, supabase_js_1.createClient)(config_1.config.supabase.url, config_1.config.supabase.serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
exports.db = {
    companies: () => exports.supabaseAdmin.from('companies'),
    users: () => exports.supabaseAdmin.from('users'),
    customers: () => exports.supabaseAdmin.from('customers'),
    invoices: () => exports.supabaseAdmin.from('invoices'),
    invoiceItems: () => exports.supabaseAdmin.from('invoice_items'),
    quotes: () => exports.supabaseAdmin.from('quotes'),
    quoteItems: () => exports.supabaseAdmin.from('quote_items'),
    payments: () => exports.supabaseAdmin.from('payments'),
    vatRates: () => exports.supabaseAdmin.from('vat_rates'),
    discountCodes: () => exports.supabaseAdmin.from('discount_codes'),
    emailTemplates: () => exports.supabaseAdmin.from('email_templates'),
    expenses: () => exports.supabaseAdmin.from('expenses'),
    invoiceOverview: () => exports.supabaseAdmin.from('invoice_overview'),
    paymentStats: () => exports.supabaseAdmin.from('payment_stats')
};
const handleSupabaseError = (error, operation) => {
    console.error(`Supabase ${operation} error:`, error);
    if (error.code === 'PGRST116') {
        throw new Error('Record not found');
    }
    if (error.code === '23505') {
        throw new Error('Duplicate entry');
    }
    if (error.code === '23503') {
        throw new Error('Referenced record not found');
    }
    if (error.code === '42501') {
        throw new Error('Insufficient permissions');
    }
    throw new Error(error.message || `${operation} failed`);
};
exports.handleSupabaseError = handleSupabaseError;
const generateInvoiceNumber = async (companyId) => {
    const { data, error } = await exports.supabaseAdmin.rpc('generate_invoice_number', {
        company_uuid: companyId
    });
    if (error) {
        (0, exports.handleSupabaseError)(error, 'generate invoice number');
    }
    return data;
};
exports.generateInvoiceNumber = generateInvoiceNumber;
const generateQRReference = async (invoiceNumber, companyId) => {
    const { data, error } = await exports.supabaseAdmin.rpc('generate_qr_reference', {
        invoice_num: invoiceNumber,
        company_uuid: companyId
    });
    if (error) {
        (0, exports.handleSupabaseError)(error, 'generate QR reference');
    }
    return data;
};
exports.generateQRReference = generateQRReference;
//# sourceMappingURL=supabase.js.map