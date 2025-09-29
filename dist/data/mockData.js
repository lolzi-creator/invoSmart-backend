"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findCompanyByUser = exports.findUserByEmail = exports.generateId = exports.mockPayments = exports.mockInvoiceItems = exports.mockInvoices = exports.mockCustomers = exports.mockCompanies = exports.mockUsers = void 0;
exports.mockUsers = [];
exports.mockCompanies = [];
exports.mockCustomers = [];
exports.mockInvoices = [];
exports.mockInvoiceItems = [];
exports.mockPayments = [];
const generateId = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};
exports.generateId = generateId;
const findUserByEmail = (email) => {
    return exports.mockUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
};
exports.findUserByEmail = findUserByEmail;
const findCompanyByUser = (userId) => {
    const user = exports.mockUsers.find(u => u.id === userId);
    if (!user)
        return undefined;
    return exports.mockCompanies.find(c => c.id === user.companyId);
};
exports.findCompanyByUser = findCompanyByUser;
//# sourceMappingURL=mockData.js.map