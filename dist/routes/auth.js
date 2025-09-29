"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const validation_1 = require("../middleware/validation");
const auth_1 = require("../middleware/auth");
const authController_1 = require("../controllers/authController");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
const authSchemas = {
    updateProfile: joi_1.default.object({
        name: joi_1.default.string().min(2).max(100).optional(),
        email: joi_1.default.string().email().optional()
    }),
    changePassword: joi_1.default.object({
        currentPassword: joi_1.default.string().min(6).required(),
        newPassword: joi_1.default.string().min(6).required()
    })
};
router.post('/login', (0, validation_1.validateRequest)({ body: validation_1.schemas.login }), authController_1.login);
router.post('/register', (0, validation_1.validateRequest)({ body: validation_1.schemas.register }), authController_1.register);
router.get('/profile', auth_1.authenticateToken, authController_1.getProfile);
router.post('/refresh', auth_1.authenticateToken, authController_1.refreshToken);
router.put('/profile', auth_1.authenticateToken, (0, validation_1.validateRequest)({ body: authSchemas.updateProfile }), authController_1.updateProfile);
router.put('/password', auth_1.authenticateToken, (0, validation_1.validateRequest)({ body: authSchemas.changePassword }), authController_1.changePassword);
exports.default = router;
//# sourceMappingURL=auth.js.map