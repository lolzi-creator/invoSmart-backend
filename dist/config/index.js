"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '3001'),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    supabase: {
        url: process.env.SUPABASE_URL || '',
        anonKey: process.env.SUPABASE_ANON_KEY || '',
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    },
    email: {
        resendApiKey: process.env.RESEND_API_KEY || '',
        fromEmail: 'onboarding@resend.dev',
        fromName: process.env.FROM_NAME || 'invoSmart'
    },
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '999999')
    },
    cors: {
        origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001']
    },
    swiss: {
        defaultCountry: 'CH',
        supportedLanguages: ['de', 'fr', 'it', 'en'],
        defaultLanguage: 'de',
        vatRates: {
            standard: 7.7,
            reduced: 2.5,
            exempt: 0
        }
    },
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
};
function validateConfig() {
    const required = [
        'JWT_SECRET'
    ];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}
exports.default = exports.config;
//# sourceMappingURL=index.js.map