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
    items: InvoiceItem[];
    payments: Payment[];
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
    uid?: string;
    vatNumber?: string;
    iban?: string;
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
export interface ApiError {
    message: string;
    statusCode: number;
    code?: string;
    details?: any;
}
//# sourceMappingURL=index.d.ts.map