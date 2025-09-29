"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.updateProfile = exports.refreshToken = exports.getProfile = exports.register = exports.login = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const errorHandler_1 = require("../middleware/errorHandler");
const config_1 = require("../config");
const supabase_1 = require("../lib/supabase");
const generateToken = (user, company) => {
    const payload = {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.companyId,
            isActive: user.isActive
        },
        company: {
            id: company.id,
            name: company.name,
            email: company.email,
            country: company.country,
            defaultLanguage: company.defaultLanguage
        }
    };
    return jwt.sign(payload, config_1.config.jwtSecret, { expiresIn: '7d' });
};
const createUserResponse = (dbUser) => {
    return {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        isActive: dbUser.is_active,
        companyId: dbUser.company_id,
        createdAt: new Date(dbUser.created_at),
        updatedAt: new Date(dbUser.updated_at)
    };
};
const createCompanyResponse = (dbCompany) => {
    return {
        id: dbCompany.id,
        name: dbCompany.name,
        address: dbCompany.address,
        zip: dbCompany.zip,
        city: dbCompany.city,
        country: dbCompany.country,
        phone: dbCompany.phone,
        email: dbCompany.email,
        website: dbCompany.website,
        uid: dbCompany.uid,
        vatNumber: dbCompany.vat_number,
        iban: dbCompany.iban,
        qrIban: dbCompany.qr_iban,
        logoUrl: dbCompany.logo_url,
        defaultPaymentTerms: dbCompany.default_payment_terms,
        defaultLanguage: dbCompany.default_language,
        createdAt: new Date(dbCompany.created_at),
        updatedAt: new Date(dbCompany.updated_at)
    };
};
exports.login = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: users, error: userError } = await supabase_1.db.users()
            .select('*')
            .eq('email', email.toLowerCase())
            .eq('is_active', true)
            .single();
        if (userError || !users) {
            res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
            return;
        }
        const user = users;
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isPasswordValid) {
            res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
            return;
        }
        const { data: companyData, error: companyError } = await supabase_1.db.companies()
            .select('*')
            .eq('id', user.company_id)
            .single();
        if (companyError || !companyData) {
            res.status(500).json({
                success: false,
                error: 'Company not found'
            });
            return;
        }
        const company = createCompanyResponse(companyData);
        const userResponse = createUserResponse(user);
        const token = generateToken(userResponse, company);
        const response = {
            token,
            user: userResponse,
            company
        };
        res.json({
            success: true,
            message: 'Login successful',
            data: response
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'login');
    }
});
exports.register = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, email, password, companyName, address, zip, city, phone, companyEmail, uid, vatNumber, iban } = req.body;
    try {
        const { data: existingUser } = await supabase_1.db.users()
            .select('id')
            .eq('email', email.toLowerCase())
            .single();
        if (existingUser) {
            res.status(409).json({
                success: false,
                error: 'User with this email already exists'
            });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const { data: companyData, error: companyError } = await supabase_1.db.companies()
            .insert({
            name: companyName,
            address,
            zip,
            city,
            country: 'CH',
            phone: phone || null,
            email: companyEmail,
            uid: uid || null,
            vat_number: vatNumber || null,
            iban: iban || null,
            default_payment_terms: 30,
            default_language: 'de'
        })
            .select()
            .single();
        if (companyError || !companyData) {
            (0, supabase_1.handleSupabaseError)(companyError, 'create company');
            return;
        }
        const company = companyData;
        const { data: userData, error: userError } = await supabase_1.db.users()
            .insert({
            email: email.toLowerCase(),
            password_hash: hashedPassword,
            name,
            role: 'ADMIN',
            is_active: true,
            company_id: company.id
        })
            .select()
            .single();
        if (userError || !userData) {
            await supabase_1.db.companies().delete().eq('id', company.id);
            (0, supabase_1.handleSupabaseError)(userError, 'create user');
            return;
        }
        const user = userData;
        await Promise.all([
            supabase_1.db.companies().rpc('create_default_vat_rates', { company_uuid: company.id }),
            supabase_1.db.companies().rpc('create_default_email_templates', { company_uuid: company.id })
        ]);
        const userResponse = createUserResponse(user);
        const companyResponse = createCompanyResponse(company);
        const token = generateToken(userResponse, companyResponse);
        const response = {
            token,
            user: userResponse,
            company: companyResponse
        };
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: response
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'register');
    }
});
exports.getProfile = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: userData, error: userError } = await supabase_1.db.users()
            .select(`
        *,
        companies (*)
      `)
            .eq('id', userId)
            .single();
        if (userError || !userData) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        const user = userData;
        const userResponse = createUserResponse(user);
        const companyResponse = createCompanyResponse(user.companies);
        res.json({
            success: true,
            data: {
                user: userResponse,
                company: companyResponse
            }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'get profile');
    }
});
exports.refreshToken = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: userData, error: userError } = await supabase_1.db.users()
            .select(`
        *,
        companies (*)
      `)
            .eq('id', userId)
            .eq('is_active', true)
            .single();
        if (userError || !userData) {
            res.status(404).json({
                success: false,
                error: 'User not found or inactive'
            });
            return;
        }
        const user = userData;
        const userResponse = createUserResponse(user);
        const companyResponse = createCompanyResponse(user.companies);
        const token = generateToken(userResponse, companyResponse);
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                token,
                user: userResponse,
                company: companyResponse
            }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'refresh token');
    }
});
exports.updateProfile = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { name, email } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const updates = {};
        if (name)
            updates.name = name;
        if (email) {
            const { data: existingUser } = await supabase_1.db.users()
                .select('id')
                .eq('email', email.toLowerCase())
                .neq('id', userId)
                .single();
            if (existingUser) {
                res.status(409).json({
                    success: false,
                    error: 'Email already in use'
                });
                return;
            }
            updates.email = email.toLowerCase();
        }
        const { data: userData, error: userError } = await supabase_1.db.users()
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        if (userError || !userData) {
            (0, supabase_1.handleSupabaseError)(userError, 'update profile');
            return;
        }
        const user = userData;
        const userResponse = createUserResponse(user);
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: userResponse
            }
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'update profile');
    }
});
exports.changePassword = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    try {
        const { data: userData, error: userError } = await supabase_1.db.users()
            .select('password_hash')
            .eq('id', userId)
            .single();
        if (userError || !userData) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        const user = userData;
        const isCurrentPasswordValid = await bcryptjs_1.default.compare(currentPassword, user.password_hash);
        if (!isCurrentPasswordValid) {
            res.status(400).json({
                success: false,
                error: 'Current password is incorrect'
            });
            return;
        }
        const hashedNewPassword = await bcryptjs_1.default.hash(newPassword, 12);
        const { error: updateError } = await supabase_1.db.users()
            .update({ password_hash: hashedNewPassword })
            .eq('id', userId);
        if (updateError) {
            (0, supabase_1.handleSupabaseError)(updateError, 'change password');
            return;
        }
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    }
    catch (error) {
        (0, supabase_1.handleSupabaseError)(error, 'change password');
    }
});
//# sourceMappingURL=authControllerSupabase.js.map