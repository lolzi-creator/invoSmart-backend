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
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const config_1 = require("../config");
const errorHandler_1 = require("../middleware/errorHandler");
const types_1 = require("../types");
const mockData_1 = require("../data/mockData");
const mockUsersWithPasswords = [];
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
const createUserResponse = (user) => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
};
exports.login = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    const user = mockUsersWithPasswords.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        res.status(401).json({
            success: false,
            error: 'Invalid email or password'
        });
        return;
    }
    if (!user.isActive) {
        res.status(401).json({
            success: false,
            error: 'Account is deactivated'
        });
        return;
    }
    const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
    if (!isPasswordValid) {
        res.status(401).json({
            success: false,
            error: 'Invalid email or password'
        });
        return;
    }
    const company = mockData_1.mockCompanies.find(c => c.id === user.companyId);
    if (!company) {
        res.status(500).json({
            success: false,
            error: 'Company not found'
        });
        return;
    }
    const token = generateToken(user, company);
    const response = {
        token,
        user: createUserResponse(user),
        company
    };
    res.json({
        success: true,
        message: 'Login successful',
        data: response
    });
});
exports.register = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, email, password, companyName, address, zip, city, phone, companyEmail, uid, vatNumber, iban } = req.body;
    const existingUser = mockUsersWithPasswords.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
        res.status(409).json({
            success: false,
            error: 'User with this email already exists'
        });
        return;
    }
    const existingCompany = mockData_1.mockCompanies.find(c => c.email.toLowerCase() === companyEmail.toLowerCase());
    if (existingCompany) {
        res.status(409).json({
            success: false,
            error: 'Company with this email already exists'
        });
        return;
    }
    const hashedPassword = await bcryptjs_1.default.hash(password, 12);
    const company = {
        id: (0, mockData_1.generateId)(),
        name: companyName,
        address,
        zip,
        city,
        country: 'CH',
        phone: phone || '',
        email: companyEmail,
        website: '',
        uid: uid || '',
        vatNumber: vatNumber || '',
        iban: iban || '',
        qrIban: '',
        logoUrl: '',
        defaultPaymentTerms: 30,
        defaultLanguage: 'de',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const user = {
        id: (0, mockData_1.generateId)(),
        email: email.toLowerCase(),
        name,
        password: hashedPassword,
        role: types_1.UserRole.ADMIN,
        isActive: true,
        companyId: company.id,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    mockData_1.mockCompanies.push(company);
    mockUsersWithPasswords.push(user);
    mockData_1.mockUsers.push(createUserResponse(user));
    const token = generateToken(user, company);
    const response = {
        token,
        user: createUserResponse(user),
        company
    };
    res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: response
    });
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
    const user = mockUsersWithPasswords.find(u => u.id === userId);
    if (!user) {
        res.status(404).json({
            success: false,
            error: 'User not found'
        });
        return;
    }
    const company = mockData_1.mockCompanies.find(c => c.id === user.companyId);
    res.json({
        success: true,
        data: {
            user: createUserResponse(user),
            company
        }
    });
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
    const user = mockData_1.mockUsers.find(u => u.id === userId);
    const company = mockData_1.mockCompanies.find(c => c.id === user?.companyId);
    if (!user || !company) {
        res.status(404).json({
            success: false,
            error: 'User or company not found'
        });
        return;
    }
    const token = generateToken(user, company);
    res.json({
        success: true,
        message: 'Token refreshed',
        data: { token }
    });
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
    const userIndex = mockUsersWithPasswords.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        res.status(404).json({
            success: false,
            error: 'User not found'
        });
        return;
    }
    if (email && email !== mockUsersWithPasswords[userIndex].email) {
        const emailTaken = mockUsersWithPasswords.some(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== userId);
        if (emailTaken) {
            res.status(409).json({
                success: false,
                error: 'Email already in use'
            });
            return;
        }
    }
    if (name)
        mockUsersWithPasswords[userIndex].name = name;
    if (email)
        mockUsersWithPasswords[userIndex].email = email.toLowerCase();
    mockUsersWithPasswords[userIndex].updatedAt = new Date();
    const mainUserIndex = mockData_1.mockUsers.findIndex(u => u.id === userId);
    if (mainUserIndex !== -1) {
        if (name)
            mockData_1.mockUsers[mainUserIndex].name = name;
        if (email)
            mockData_1.mockUsers[mainUserIndex].email = email.toLowerCase();
        mockData_1.mockUsers[mainUserIndex].updatedAt = new Date();
    }
    res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
            user: createUserResponse(mockUsersWithPasswords[userIndex])
        }
    });
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
    const userIndex = mockUsersWithPasswords.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        res.status(404).json({
            success: false,
            error: 'User not found'
        });
        return;
    }
    const user = mockUsersWithPasswords[userIndex];
    const isCurrentPasswordValid = await bcryptjs_1.default.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
        res.status(400).json({
            success: false,
            error: 'Current password is incorrect'
        });
        return;
    }
    const hashedNewPassword = await bcryptjs_1.default.hash(newPassword, 12);
    mockUsersWithPasswords[userIndex].password = hashedNewPassword;
    mockUsersWithPasswords[userIndex].updatedAt = new Date();
    res.json({
        success: true,
        message: 'Password changed successfully'
    });
});
//# sourceMappingURL=authControllerOld.js.map