"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomerStats = exports.importCustomers = exports.deleteCustomer = exports.updateCustomer = exports.createCustomer = exports.getCustomer = exports.getCustomers = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const mockData_1 = require("../data/mockData");
const ensureCompanyAccess = (req, customerId) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        throw new Error('Company access required');
    }
    if (customerId) {
        const customer = mockData_1.mockCustomers.find(c => c.id === customerId);
        if (!customer || customer.companyId !== companyId) {
            throw new Error('Customer not found or access denied');
        }
    }
    return companyId;
};
exports.getCustomers = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = ensureCompanyAccess(req);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const isActive = req.query.isActive;
    const sortBy = req.query.sortBy || 'name';
    const sortOrder = req.query.sortOrder || 'asc';
    let filteredCustomers = mockData_1.mockCustomers.filter(c => c.companyId === companyId);
    if (search) {
        const searchLower = search.toLowerCase();
        filteredCustomers = filteredCustomers.filter(customer => customer.name.toLowerCase().includes(searchLower) ||
            customer.company?.toLowerCase().includes(searchLower) ||
            customer.email?.toLowerCase().includes(searchLower) ||
            customer.city.toLowerCase().includes(searchLower));
    }
    if (isActive !== undefined) {
        const activeFilter = isActive === 'true';
        filteredCustomers = filteredCustomers.filter(c => c.isActive === activeFilter);
    }
    filteredCustomers.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];
        if (aValue === undefined)
            aValue = '';
        if (bValue === undefined)
            bValue = '';
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        if (sortOrder === 'desc') {
            return bStr.localeCompare(aStr);
        }
        return aStr.localeCompare(bStr);
    });
    const total = filteredCustomers.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedCustomers = filteredCustomers.slice(offset, offset + limit);
    const response = {
        data: paginatedCustomers,
        total,
        page,
        limit,
        totalPages
    };
    res.json({
        success: true,
        data: response
    });
});
exports.getCustomer = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Company access required'
        });
        return;
    }
    const customer = mockData_1.mockCustomers.find(c => c.id === id && c.companyId === companyId);
    if (!customer) {
        res.status(404).json({
            success: false,
            error: 'Customer not found'
        });
        return;
    }
    res.json({
        success: true,
        data: customer
    });
});
exports.createCustomer = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = ensureCompanyAccess(req);
    const { name, company, address, zip, city, country = 'CH', email, phone, uid, paymentTerms = 30, language = 'de', notes } = req.body;
    if (email) {
        const existingCustomer = mockData_1.mockCustomers.find(c => c.companyId === companyId &&
            c.email?.toLowerCase() === email.toLowerCase());
        if (existingCustomer) {
            res.status(409).json({
                success: false,
                error: 'Customer with this email already exists'
            });
            return;
        }
    }
    const customer = {
        id: (0, mockData_1.generateId)(),
        name,
        company: company || undefined,
        address,
        zip,
        city,
        country,
        email: email || undefined,
        phone: phone || undefined,
        uid: uid || undefined,
        paymentTerms,
        language,
        notes: notes || undefined,
        isActive: true,
        companyId,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    mockData_1.mockCustomers.push(customer);
    res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: customer
    });
});
exports.updateCustomer = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Company access required'
        });
        return;
    }
    const customerIndex = mockData_1.mockCustomers.findIndex(c => c.id === id && c.companyId === companyId);
    if (customerIndex === -1) {
        res.status(404).json({
            success: false,
            error: 'Customer not found'
        });
        return;
    }
    const customer = mockData_1.mockCustomers[customerIndex];
    const { name, company, address, zip, city, country, email, phone, uid, paymentTerms, language, notes, isActive } = req.body;
    if (email && email !== customer.email) {
        const emailTaken = mockData_1.mockCustomers.some(c => c.companyId === customer.companyId &&
            c.email?.toLowerCase() === email.toLowerCase() &&
            c.id !== id);
        if (emailTaken) {
            res.status(409).json({
                success: false,
                error: 'Email already in use by another customer'
            });
            return;
        }
    }
    if (name !== undefined)
        customer.name = name;
    if (company !== undefined)
        customer.company = company || undefined;
    if (address !== undefined)
        customer.address = address;
    if (zip !== undefined)
        customer.zip = zip;
    if (city !== undefined)
        customer.city = city;
    if (country !== undefined)
        customer.country = country;
    if (email !== undefined)
        customer.email = email || undefined;
    if (phone !== undefined)
        customer.phone = phone || undefined;
    if (uid !== undefined)
        customer.uid = uid || undefined;
    if (paymentTerms !== undefined)
        customer.paymentTerms = paymentTerms;
    if (language !== undefined)
        customer.language = language;
    if (notes !== undefined)
        customer.notes = notes || undefined;
    if (isActive !== undefined)
        customer.isActive = isActive;
    customer.updatedAt = new Date();
    mockData_1.mockCustomers[customerIndex] = customer;
    res.json({
        success: true,
        message: 'Customer updated successfully',
        data: customer
    });
});
exports.deleteCustomer = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Company access required'
        });
        return;
    }
    const customerIndex = mockData_1.mockCustomers.findIndex(c => c.id === id && c.companyId === companyId);
    if (customerIndex === -1) {
        res.status(404).json({
            success: false,
            error: 'Customer not found'
        });
        return;
    }
    mockData_1.mockCustomers.splice(customerIndex, 1);
    res.json({
        success: true,
        message: 'Customer deleted successfully'
    });
});
exports.importCustomers = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = ensureCompanyAccess(req);
    const { customers, overwriteExisting = false } = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
        res.status(400).json({
            success: false,
            error: 'No customers provided for import'
        });
        return;
    }
    const results = {
        imported: 0,
        skipped: 0,
        errors: []
    };
    for (let i = 0; i < customers.length; i++) {
        const customerData = customers[i];
        try {
            if (!customerData.name || !customerData.address || !customerData.zip || !customerData.city) {
                results.errors.push(`Row ${i + 1}: Missing required fields (name, address, zip, city)`);
                results.skipped++;
                continue;
            }
            const existingCustomer = customerData.email
                ? mockData_1.mockCustomers.find(c => c.companyId === companyId &&
                    c.email?.toLowerCase() === customerData.email.toLowerCase())
                : null;
            if (existingCustomer && !overwriteExisting) {
                results.errors.push(`Row ${i + 1}: Customer with email ${customerData.email} already exists`);
                results.skipped++;
                continue;
            }
            if (existingCustomer && overwriteExisting) {
                const customerIndex = mockData_1.mockCustomers.findIndex(c => c.id === existingCustomer.id);
                mockData_1.mockCustomers[customerIndex] = {
                    ...existingCustomer,
                    ...customerData,
                    id: existingCustomer.id,
                    companyId: existingCustomer.companyId,
                    createdAt: existingCustomer.createdAt,
                    updatedAt: new Date()
                };
            }
            else {
                const newCustomer = {
                    id: (0, mockData_1.generateId)(),
                    name: customerData.name,
                    company: customerData.company,
                    address: customerData.address,
                    zip: customerData.zip,
                    city: customerData.city,
                    country: customerData.country || 'CH',
                    email: customerData.email,
                    phone: customerData.phone,
                    uid: customerData.uid,
                    paymentTerms: customerData.paymentTerms || 30,
                    language: customerData.language || 'de',
                    notes: customerData.notes,
                    isActive: true,
                    companyId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                mockData_1.mockCustomers.push(newCustomer);
            }
            results.imported++;
        }
        catch (error) {
            results.errors.push(`Row ${i + 1}: ${error}`);
            results.skipped++;
        }
    }
    res.json({
        success: true,
        message: 'Import completed',
        data: results
    });
});
exports.getCustomerStats = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = ensureCompanyAccess(req);
    const companyCustomers = mockData_1.mockCustomers.filter(c => c.companyId === companyId);
    const stats = {
        total: companyCustomers.length,
        active: companyCustomers.filter(c => c.isActive).length,
        inactive: companyCustomers.filter(c => !c.isActive).length,
        withEmail: companyCustomers.filter(c => c.email).length,
        byCountry: companyCustomers.reduce((acc, customer) => {
            acc[customer.country] = (acc[customer.country] || 0) + 1;
            return acc;
        }, {}),
        byLanguage: companyCustomers.reduce((acc, customer) => {
            acc[customer.language] = (acc[customer.language] || 0) + 1;
            return acc;
        }, {})
    };
    res.json({
        success: true,
        data: stats
    });
});
//# sourceMappingURL=customerControllerOld.js.map