import { Request } from 'express';
export interface Company {
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
    vatNumber?: string;
    iban?: string;
    qrIban?: string;
    logoUrl?: string;
    defaultPaymentTerms: number;
    defaultLanguage: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    isActive: boolean;
    companyId: string;
    company?: Company;
    createdAt: Date;
    updatedAt: Date;
}
export interface Customer {
    id: string;
    companyId: string;
    customerNumber: string;
    name: string;
    company?: string;
    email?: string;
    address: string;
    zip: string;
    city: string;
    country: string;
    phone?: string;
    uid?: string;
    vatNumber?: string;
    paymentTerms: number;
    creditLimit?: number;
    isActive: boolean;
    notes?: string;
    language: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Invoice {
    id: string;
    number: string;
    customerId: string;
    customer?: Customer;
    companyId: string;
    company?: Company;
    date: Date;
    dueDate: Date;
    serviceDate: Date;
    status: InvoiceStatus;
    subtotal: number;
    vatAmount: number;
    total: number;
    paidAmount: number;
    qrReference: string;
    reminderLevel: number;
    lastReminderAt?: Date;
    sentAt?: Date;
    emailSentCount: number;
    discountCode?: string;
    discountAmount: number;
    internalNotes?: string;
    items: InvoiceItem[];
    payments: Payment[];
    files?: InvoiceFile[];
    createdAt: Date;
    updatedAt: Date;
}
export interface CustomerStats {
    totalCustomers: number;
    activeCustomers: number;
    inactiveCustomers: number;
    customersByCountry: Record<string, number>;
    recentCustomers: Customer[];
}
export interface InvoiceItem {
    id: string;
    invoiceId: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discount: number;
    vatRate: number;
    lineTotal: number;
    vatAmount: number;
    sortOrder: number;
}
export interface InvoiceFile {
    id: string;
    invoiceId: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: Date;
}
export interface Quote {
    id: string;
    number: string;
    customerId: string;
    customer?: Customer;
    companyId: string;
    company?: Company;
    date: Date;
    expiryDate: Date;
    status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED' | 'CONVERTED';
    subtotal: number;
    vatAmount: number;
    total: number;
    discountCode?: string;
    discountAmount: number;
    internalNotes?: string;
    acceptanceToken?: string;
    acceptanceLink?: string;
    acceptedAt?: Date;
    acceptedByEmail?: string;
    sentAt?: Date;
    emailSentCount: number;
    convertedToInvoiceId?: string;
    convertedAt?: Date;
    items: QuoteItem[];
    createdAt: Date;
    updatedAt: Date;
}
export interface QuoteItem {
    id: string;
    quoteId: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discount: number;
    vatRate: number;
    lineTotal: number;
    vatAmount: number;
    sortOrder: number;
}
export interface Payment {
    id: string;
    invoiceId?: string;
    invoice?: Invoice;
    companyId: string;
    amount: number;
    valueDate: Date;
    reference?: string;
    description?: string;
    confidence: MatchConfidence;
    isMatched: boolean;
    importBatch?: string;
    rawData?: any;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface VatRate {
    id: string;
    name: string;
    rate: number;
    isDefault: boolean;
    isActive: boolean;
    companyId: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface DiscountCode {
    id: string;
    code: string;
    name?: string;
    type: DiscountType;
    value: number;
    validFrom?: Date;
    validUntil?: Date;
    isActive: boolean;
    usageLimit?: number;
    usageCount: number;
    companyId: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface EmailTemplate {
    id: string;
    companyId: string;
    name: string;
    subject: string;
    body: string;
    type: EmailType;
    language: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum UserRole {
    ADMIN = "ADMIN",
    EMPLOYEE = "EMPLOYEE"
}
export declare enum InvoiceStatus {
    DRAFT = "DRAFT",
    OPEN = "OPEN",
    PARTIAL_PAID = "PARTIAL_PAID",
    PAID = "PAID",
    OVERDUE = "OVERDUE",
    CANCELLED = "CANCELLED"
}
export declare enum MatchConfidence {
    HIGH = "HIGH",
    MEDIUM = "MEDIUM",
    LOW = "LOW",
    MANUAL = "MANUAL"
}
export declare enum DiscountType {
    PERCENTAGE = "PERCENTAGE",
    FIXED_AMOUNT = "FIXED_AMOUNT"
}
export declare enum EmailType {
    INVOICE = "INVOICE",
    REMINDER_1 = "REMINDER_1",
    REMINDER_2 = "REMINDER_2",
    REMINDER_3 = "REMINDER_3"
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface LoginResponse {
    token: string;
    user: Omit<User, 'password'>;
    company: Company;
}
export interface RegisterRequest {
    name: string;
    email: string;
    password: string;
    companyName: string;
    address: string;
    zip: string;
    city: string;
    phone?: string;
    companyEmail: string;
    website?: string;
    uid?: string;
    vatNumber?: string;
    iban?: string;
    qrIban?: string;
    bankName?: string;
    paymentTerms?: number;
    defaultLanguage?: string;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
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
    uid?: string;
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
    status: string;
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
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        name: string;
        email: string;
        companyId: string;
        role: string;
    };
}
export interface ApiError {
    message: string;
    statusCode: number;
    code?: string;
    details?: any;
}
//# sourceMappingURL=index.d.ts.map