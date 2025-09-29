"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = require("./config");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = __importDefault(require("./routes/auth"));
const customers_1 = __importDefault(require("./routes/customers"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const payments_1 = __importDefault(require("./routes/payments"));
const emails_1 = __importDefault(require("./routes/emails"));
const app = (0, express_1.default)();
try {
    (0, config_1.validateConfig)();
}
catch (error) {
    console.error('Configuration validation failed:', error);
    process.exit(1);
}
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Access-Control-Allow-Origin']
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.config.rateLimit.windowMs,
    max: config_1.config.rateLimit.maxRequests,
    message: {
        success: false,
        error: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
if (config_1.config.nodeEnv !== 'test') {
    app.use((0, morgan_1.default)(config_1.config.nodeEnv === 'production' ? 'combined' : 'dev'));
}
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Swiss Invoice API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: config_1.config.nodeEnv
    });
});
app.use('/api/v1', (req, res, next) => {
    res.header('X-API-Version', 'v1');
    next();
});
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/customers', customers_1.default);
app.use('/api/v1/invoices', invoices_1.default);
app.use('/api/v1/payments', payments_1.default);
app.use('/api/v1/emails', emails_1.default);
app.get('/api/v1/test', (req, res) => {
    res.json({
        success: true,
        message: 'API is working!',
        endpoints: {
            auth: '/api/v1/auth',
            customers: '/api/v1/customers',
            invoices: '/api/v1/invoices',
            payments: '/api/v1/payments',
            emails: '/api/v1/emails'
        }
    });
});
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
    });
});
app.use(errorHandler_1.errorHandler);
const PORT = config_1.config.port;
if (config_1.config.nodeEnv !== 'test') {
    app.listen(PORT, () => {
        console.log(`🚀 Swiss Invoice API Server running on port ${PORT}`);
        console.log(`🌍 Environment: ${config_1.config.nodeEnv}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`🔗 API Base URL: http://localhost:${PORT}/api/v1`);
        if (config_1.config.nodeEnv === 'development') {
            console.log('\n📋 Available endpoints:');
            console.log('  - GET  /health');
            console.log('  - GET  /api/v1/test');
            console.log('  - POST /api/v1/auth/login');
            console.log('  - POST /api/v1/auth/register');
            console.log('  - GET  /api/v1/auth/profile');
            console.log('  - POST /api/v1/auth/refresh');
            console.log('  - PUT  /api/v1/auth/profile');
            console.log('  - PUT  /api/v1/auth/password');
            console.log('  - GET  /api/v1/customers (coming soon)');
        }
    });
}
exports.default = app;
//# sourceMappingURL=index.js.map