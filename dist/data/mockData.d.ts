import { User, Company, Customer, Invoice, InvoiceItem, Payment } from '../types';
export declare const mockUsers: User[];
export declare const mockCompanies: Company[];
export declare const mockCustomers: Customer[];
export declare const mockInvoices: Invoice[];
export declare const mockInvoiceItems: InvoiceItem[];
export declare const mockPayments: Payment[];
export declare const generateId: () => string;
export declare const findUserByEmail: (email: string) => User | undefined;
export declare const findCompanyByUser: (userId: string) => Company | undefined;
//# sourceMappingURL=mockData.d.ts.map