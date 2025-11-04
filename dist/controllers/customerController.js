"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCustomers = exports.getCustomerStats = exports.deleteCustomer = exports.updateCustomer = exports.createCustomer = exports.getCustomer = exports.getCustomers = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const supabase_1 = require("../lib/supabase");
const auditController_1 = require("./auditController");
const createCustomerResponse = (dbCustomer) => {
    return {
        id: dbCustomer.id,
        companyId: dbCustomer.company_id,
        customerNumber: dbCustomer.customer_number,
        name: dbCustomer.name,
        company: dbCustomer.company || undefined,
        email: dbCustomer.email || undefined,
        address: dbCustomer.address,
        zip: dbCustomer.zip,
        city: dbCustomer.city,
        country: dbCustomer.country,
        phone: dbCustomer.phone || undefined,
        uid: dbCustomer.uid || undefined,
        vatNumber: dbCustomer.vat_number || undefined,
        paymentTerms: dbCustomer.payment_terms,
        creditLimit: dbCustomer.credit_limit || undefined,
        isActive: dbCustomer.is_active,
        notes: dbCustomer.notes || undefined,
        language: dbCustomer.language,
        createdAt: new Date(dbCustomer.created_at),
        updatedAt: new Date(dbCustomer.updated_at)
    };
};
const ensureCompanyAccess = (userCompanyId, resourceCompanyId) => {
    if (userCompanyId !== resourceCompanyId) {
        throw new Error('Access denied to resource');
    }
};
exports.getCustomers = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'name';
    const sortOrder = req.query.sortOrder || 'asc';
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
    try {
        let query = supabase_1.db.customers()
            .select('*', { count: 'exact' })
            .eq('company_id', companyId);
        if (isActive !== undefined) {
            query = query.eq('is_active', isActive);
        }
        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`);
        }
        const ascending = sortOrder === 'asc';
        query = query.order(sortBy, { ascending });
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);
        const { data, error, count } = await query;
        if (error) {
            (0, supabase_1.handleSupabaseError)(error, 'get customers');
            return;
        }
        const customers = data.map(createCustomerResponse);
        res.json({
            success: true,
            data: {
                customers,
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    pages: Math.ceil((count || 0) / limit)
                }
            }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'get customers');
    }
});
exports.getCustomer = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const customerId = req.params.id;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data, error } = await supabase_1.db.customers()
            .select('*')
            .eq('id', customerId)
            .eq('company_id', companyId)
            .single();
        if (error || !data) {
            res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
            return;
        }
        const customer = createCustomerResponse(data);
        res.json({
            success: true,
            data: { customer }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'get customer');
    }
});
exports.createCustomer = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    const { name, company, email, address, zip, city, country = 'CH', phone, uid, vatNumber, paymentTerms = 30, creditLimit, language = 'de', notes } = req.body;
    try {
        const { data: customerNumber, error: numberError } = await supabase_1.db.customers()
            .select('customer_number')
            .eq('company_id', companyId)
            .order('customer_number', { ascending: false })
            .limit(1)
            .single();
        let nextNumber = '1001';
        if (!numberError && customerNumber) {
            const lastNumber = parseInt(customerNumber.customer_number) || 1000;
            nextNumber = (lastNumber + 1).toString();
        }
        const customerData = {
            company_id: companyId,
            customer_number: nextNumber,
            name,
            company: company || null,
            email: email || null,
            address,
            zip,
            city,
            country,
            phone: phone || null,
            uid: uid || null,
            vat_number: vatNumber || null,
            payment_terms: paymentTerms,
            credit_limit: creditLimit || null,
            is_active: true,
            notes: notes || null,
            language
        };
        const { data, error } = await supabase_1.db.customers()
            .insert(customerData)
            .select()
            .single();
        if (error || !data) {
            (0, supabase_1.handleSupabaseError)(error, 'create customer');
            return;
        }
        const customer = createCustomerResponse(data);
        try {
            await (0, auditController_1.createAuditLog)(companyId, req.user.id, req.user.name, 'CUSTOMER_CREATED', 'CUSTOMER', customer.id, {
                customerNumber: customer.customerNumber,
                customerName: customer.name,
                email: customer.email
            }, req.ip, req.get('User-Agent'));
        }
        catch (auditError) {
            console.error('Error creating audit log:', auditError);
        }
        res.status(201).json({
            success: true,
            message: 'Customer created successfully',
            data: { customer }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'create customer');
    }
});
exports.updateCustomer = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const customerId = req.params.id;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: existingCustomer, error: findError } = await supabase_1.db.customers()
            .select('*')
            .eq('id', customerId)
            .eq('company_id', companyId)
            .single();
        if (findError || !existingCustomer) {
            res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
            return;
        }
        const { name, company, email, address, zip, city, country, phone, uid, vatNumber, paymentTerms, creditLimit, isActive, language, notes } = req.body;
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (company !== undefined)
            updateData.company = company;
        if (email !== undefined)
            updateData.email = email;
        if (address !== undefined)
            updateData.address = address;
        if (zip !== undefined)
            updateData.zip = zip;
        if (city !== undefined)
            updateData.city = city;
        if (country !== undefined)
            updateData.country = country;
        if (phone !== undefined)
            updateData.phone = phone;
        if (uid !== undefined)
            updateData.uid = uid;
        if (vatNumber !== undefined)
            updateData.vat_number = vatNumber;
        if (paymentTerms !== undefined)
            updateData.payment_terms = paymentTerms;
        if (creditLimit !== undefined)
            updateData.credit_limit = creditLimit;
        if (isActive !== undefined)
            updateData.is_active = isActive;
        if (language !== undefined)
            updateData.language = language;
        if (notes !== undefined)
            updateData.notes = notes;
        const { data, error } = await supabase_1.db.customers()
            .update(updateData)
            .eq('id', customerId)
            .eq('company_id', companyId)
            .select()
            .single();
        if (error || !data) {
            (0, supabase_1.handleSupabaseError)(error, 'update customer');
            return;
        }
        const customer = createCustomerResponse(data);
        try {
            await (0, auditController_1.createAuditLog)(companyId, req.user.id, req.user.name, 'CUSTOMER_UPDATED', 'CUSTOMER', customerId, {
                customerNumber: customer.customerNumber,
                customerName: customer.name
            }, req.ip, req.get('User-Agent'));
        }
        catch (auditError) {
            console.error('Error creating audit log:', auditError);
        }
        res.json({
            success: true,
            message: 'Customer updated successfully',
            data: { customer }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'update customer');
    }
});
exports.deleteCustomer = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const customerId = req.params.id;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: invoices, error: invoiceError } = await supabase_1.db.invoices()
            .select('id')
            .eq('customer_id', customerId)
            .limit(1);
        if (invoiceError) {
            (0, supabase_1.handleSupabaseError)(invoiceError, 'check customer invoices');
            return;
        }
        if (invoices && invoices.length > 0) {
            res.status(400).json({
                success: false,
                error: 'Cannot delete customer with existing invoices'
            });
            return;
        }
        const { data: customerData } = await supabase_1.db.customers()
            .select('customer_number, name')
            .eq('id', customerId)
            .eq('company_id', companyId)
            .single();
        const { error } = await supabase_1.db.customers()
            .delete()
            .eq('id', customerId)
            .eq('company_id', companyId);
        if (error) {
            (0, supabase_1.handleSupabaseError)(error, 'delete customer');
            return;
        }
        try {
            await (0, auditController_1.createAuditLog)(companyId, req.user.id, req.user.name, 'CUSTOMER_DELETED', 'CUSTOMER', customerId, {
                customerNumber: customerData?.customer_number,
                customerName: customerData?.name
            }, req.ip, req.get('User-Agent'));
        }
        catch (auditError) {
            console.error('Error creating audit log:', auditError);
        }
        res.json({
            success: true,
            message: 'Customer deleted successfully'
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'delete customer');
    }
});
exports.getCustomerStats = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { count: totalCustomers, error: totalError } = await supabase_1.db.customers()
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId);
        if (totalError) {
            (0, supabase_1.handleSupabaseError)(totalError, 'get total customers');
            return;
        }
        const { count: activeCustomers, error: activeError } = await supabase_1.db.customers()
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('is_active', true);
        if (activeError) {
            (0, supabase_1.handleSupabaseError)(activeError, 'get active customers');
            return;
        }
        const { data: countryData, error: countryError } = await supabase_1.db.customers()
            .select('country')
            .eq('company_id', companyId);
        if (countryError) {
            (0, supabase_1.handleSupabaseError)(countryError, 'get customers by country');
            return;
        }
        const customersByCountry = countryData.reduce((acc, curr) => {
            acc[curr.country] = (acc[curr.country] || 0) + 1;
            return acc;
        }, {});
        const stats = {
            totalCustomers: totalCustomers || 0,
            activeCustomers: activeCustomers || 0,
            inactiveCustomers: (totalCustomers || 0) - (activeCustomers || 0),
            customersByCountry,
            recentCustomers: []
        };
        res.json({
            success: true,
            data: { stats }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'get customer stats');
    }
});
exports.importCustomers = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    const { customers: customerData } = req.body;
    if (!customerData || !Array.isArray(customerData)) {
        res.status(400).json({
            success: false,
            error: 'Invalid CSV data format. Expected array of customer objects.'
        });
        return;
    }
    try {
        const results = {
            imported: 0,
            failed: 0,
            errors: []
        };
        const { data: lastCustomer, error: numberError } = await supabase_1.db.customers()
            .select('customer_number')
            .eq('company_id', companyId)
            .order('customer_number', { ascending: false })
            .limit(1)
            .single();
        let currentNumber = 1000;
        if (!numberError && lastCustomer) {
            currentNumber = parseInt(lastCustomer.customer_number) || 1000;
        }
        for (let i = 0; i < customerData.length; i++) {
            const customer = customerData[i];
            try {
                if (!customer.name || customer.name.length < 2) {
                    results.errors.push(`Row ${i + 1}: Name is required (min 2 characters)`);
                    results.failed++;
                    continue;
                }
                if (!customer.address || customer.address.length < 5) {
                    results.errors.push(`Row ${i + 1}: Address is required (min 5 characters)`);
                    results.failed++;
                    continue;
                }
                if (!customer.zip || customer.zip.length < 4) {
                    results.errors.push(`Row ${i + 1}: ZIP is required (min 4 characters)`);
                    results.failed++;
                    continue;
                }
                if (!customer.city || customer.city.length < 2) {
                    results.errors.push(`Row ${i + 1}: City is required (min 2 characters)`);
                    results.failed++;
                    continue;
                }
                currentNumber++;
                const customerNumber = currentNumber.toString();
                const customerData = {
                    company_id: companyId,
                    customer_number: customerNumber,
                    name: customer.name,
                    company: customer.company || null,
                    email: customer.email || null,
                    address: customer.address,
                    zip: customer.zip,
                    city: customer.city,
                    country: customer.country || 'CH',
                    phone: customer.phone || null,
                    uid: customer.uid || null,
                    vat_number: customer.vatNumber || null,
                    payment_terms: customer.paymentTerms || 30,
                    credit_limit: customer.creditLimit || null,
                    is_active: customer.isActive !== undefined ? customer.isActive : true,
                    notes: customer.notes || null,
                    language: customer.language || 'de'
                };
                const { data, error } = await supabase_1.db.customers()
                    .insert(customerData)
                    .select()
                    .single();
                if (error) {
                    results.errors.push(`Row ${i + 1}: ${error.message}`);
                    results.failed++;
                    currentNumber--;
                }
                else {
                    results.imported++;
                }
            }
            catch (error) {
                results.errors.push(`Row ${i + 1}: ${error.message}`);
                results.failed++;
                currentNumber--;
            }
        }
        res.json({
            success: true,
            message: `Import completed. ${results.imported} customers imported, ${results.failed} failed.`,
            data: {
                imported: results.imported,
                failed: results.failed,
                errors: results.errors
            }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'import customers');
    }
});
//# sourceMappingURL=customerController.js.map