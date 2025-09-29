export declare const supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
export declare const supabaseAdmin: import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
export declare const db: {
    companies: () => import("@supabase/postgrest-js").PostgrestQueryBuilder<any, any, any, "companies", unknown>;
    users: () => import("@supabase/postgrest-js").PostgrestQueryBuilder<any, any, any, "users", unknown>;
    customers: () => import("@supabase/postgrest-js").PostgrestQueryBuilder<any, any, any, "customers", unknown>;
    invoices: () => import("@supabase/postgrest-js").PostgrestQueryBuilder<any, any, any, "invoices", unknown>;
    invoiceItems: () => import("@supabase/postgrest-js").PostgrestQueryBuilder<any, any, any, "invoice_items", unknown>;
    payments: () => import("@supabase/postgrest-js").PostgrestQueryBuilder<any, any, any, "payments", unknown>;
    vatRates: () => import("@supabase/postgrest-js").PostgrestQueryBuilder<any, any, any, "vat_rates", unknown>;
    discountCodes: () => import("@supabase/postgrest-js").PostgrestQueryBuilder<any, any, any, "discount_codes", unknown>;
    emailTemplates: () => import("@supabase/postgrest-js").PostgrestQueryBuilder<any, any, any, "email_templates", unknown>;
    invoiceOverview: () => import("@supabase/postgrest-js").PostgrestQueryBuilder<any, any, any, "invoice_overview", unknown>;
    paymentStats: () => import("@supabase/postgrest-js").PostgrestQueryBuilder<any, any, any, "payment_stats", unknown>;
};
export declare const handleSupabaseError: (error: any, operation: string) => never;
export declare const generateInvoiceNumber: (companyId: string) => Promise<string>;
export declare const generateQRReference: (invoiceNumber: string, companyId: string) => Promise<string>;
export interface DatabaseUser {
    id: string;
    email: string;
    password_hash: string;
    name: string;
    role: 'ADMIN' | 'EMPLOYEE';
    is_active: boolean;
    company_id: string;
    created_at: string;
    updated_at: string;
}
export interface DatabaseCompany {
    id: string;
    name: string;
    address: string;
    zip: string;
    city: string;
    country: string;
    phone?: string;
    email: string;
    website?: string;
    uid?: string;
    vat_number?: string;
    iban?: string;
    qr_iban?: string;
    logo_url?: string;
    default_payment_terms: number;
    default_language: string;
    created_at: string;
    updated_at: string;
}
export interface DatabaseCustomer {
    id: string;
    company_id: string;
    customer_number: string;
    name: string;
    company?: string;
    email?: string;
    address: string;
    zip: string;
    city: string;
    country: string;
    phone?: string;
    vat_number?: string;
    payment_terms: number;
    credit_limit?: number;
    is_active: boolean;
    notes?: string;
    language: string;
    created_at: string;
    updated_at: string;
}
export interface DatabaseInvoice {
    id: string;
    number: string;
    customer_id: string;
    company_id: string;
    date: string;
    due_date: string;
    status: 'DRAFT' | 'OPEN' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    subtotal: number;
    vat_amount: number;
    total: number;
    paid_amount: number;
    qr_reference: string;
    reminder_level: number;
    last_reminder_at?: string;
    sent_at?: string;
    email_sent_count: number;
    discount_code?: string;
    discount_amount: number;
    created_at: string;
    updated_at: string;
}
export interface DatabaseInvoiceItem {
    id: string;
    invoice_id: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    discount: number;
    vat_rate: number;
    line_total: number;
    vat_amount: number;
    sort_order: number;
    created_at: string;
}
export interface DatabasePayment {
    id: string;
    invoice_id?: string;
    company_id: string;
    amount: number;
    value_date: string;
    reference?: string;
    description?: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'MANUAL';
    is_matched: boolean;
    import_batch?: string;
    raw_data?: any;
    notes?: string;
    created_at: string;
    updated_at: string;
}
export interface DatabaseEmailTemplate {
    id: string;
    company_id: string;
    name: string;
    subject: string;
    body: string;
    type: 'INVOICE' | 'REMINDER_1' | 'REMINDER_2' | 'REMINDER_3';
    language: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
//# sourceMappingURL=supabase.d.ts.map