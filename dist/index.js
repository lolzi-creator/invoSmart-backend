"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const config_1 = require("./config");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = __importDefault(require("./routes/auth"));
const customers_1 = __importDefault(require("./routes/customers"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const quotes_1 = __importDefault(require("./routes/quotes"));
const payments_1 = __importDefault(require("./routes/payments"));
const qr_1 = __importDefault(require("./routes/qr"));
const emails_1 = __importDefault(require("./routes/emails"));
const expenses_1 = __importDefault(require("./routes/expenses"));
const users_1 = __importDefault(require("./routes/users"));
const audit_1 = __importDefault(require("./routes/audit"));
const invitations_1 = __importDefault(require("./routes/invitations"));
const permissions_1 = __importDefault(require("./routes/permissions"));
const company_1 = __importDefault(require("./routes/company"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const vatRates_1 = __importDefault(require("./routes/vatRates"));
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
console.log('🚀 Registering API routes...');
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/customers', customers_1.default);
app.use('/api/v1/invoices', invoices_1.default);
app.use('/api/v1/quotes', quotes_1.default);
app.use('/api/v1/payments', payments_1.default);
app.use('/api/v1/qr', qr_1.default);
app.use('/api/v1/emails', emails_1.default);
app.use('/api/v1/expenses', expenses_1.default);
app.use('/api/v1/users', users_1.default);
app.use('/api/v1/audit', audit_1.default);
app.use('/api/v1/invitations', invitations_1.default);
app.use('/api/v1/permissions', permissions_1.default);
app.use('/api/v1/company', company_1.default);
app.use('/api/v1/dashboard', dashboard_1.default);
app.use('/api/v1/vat-rates', vatRates_1.default);
console.log('✅ All API routes registered!');
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
app.post('/api/v1/test-email', async (req, res) => {
    try {
        console.log('🧪 Testing email service...');
        const invoiceData = req.body.invoice || {
            number: 'RE-2025-0001',
            total: 2154,
            due_date: '2025-11-05',
            date: '2025-10-06',
            customer_name: 'mahnunh',
            customer_company: '',
            customer_email: '',
            customer_language: 'de',
            subtotal: 2000,
            vat_amount: 154,
            status: 'OPEN'
        };
        const formatAmount = (amount) => {
            return new Intl.NumberFormat('de-CH', {
                style: 'currency',
                currency: 'CHF'
            }).format(amount / 100);
        };
        const formatDate = (date) => {
            return new Date(date).toLocaleDateString('de-CH');
        };
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const result = await resend.emails.send({
            from: `${config_1.config.email.fromName} <${config_1.config.email.fromEmail}>`,
            to: ['mkrshkov@gmail.com'],
            subject: `Zahlungserinnerung - Rechnung ${invoiceData.number}`,
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Zahlungserinnerung</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 0; background: #f8f9fa; }
            .container { background: white; margin: 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: #1a1a1a; color: white; padding: 24px; text-align: center; }
            .logo { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
            .content { padding: 32px 24px; }
            .greeting { font-size: 18px; margin-bottom: 24px; color: #1a1a1a; }
            .invoice-card { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 24px 0; }
            .invoice-number { font-size: 20px; font-weight: bold; color: #1a1a1a; margin-bottom: 16px; }
            .amount { font-size: 32px; font-weight: bold; color: #dc3545; margin: 16px 0; }
            .due-date { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 12px; margin: 16px 0; color: #856404; }
            .payment-info { background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 6px; padding: 16px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 24px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
            .button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 16px 0; }
            .contact-info { margin-top: 20px; }
            .highlight { background: #fff3cd; padding: 2px 4px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">invoSmart</div>
              <div style="font-size: 14px; opacity: 0.8;">Zahlungserinnerung</div>
            </div>
            
            <div class="content">
              <div class="greeting">
                Hallo ${invoiceData.customer_company ? invoiceData.customer_company : invoiceData.customer_name},
              </div>
              
              <p>wir möchten Sie freundlich daran erinnern, dass die Zahlung für folgende Rechnung noch aussteht:</p>
              
              <div class="invoice-card">
                <div class="invoice-number">Rechnung ${invoiceData.number}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span>Rechnungsbetrag:</span>
                  <span class="amount">${formatAmount(invoiceData.total)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Rechnungsdatum:</span>
                  <span>${formatDate(invoiceData.date)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Fälligkeitsdatum:</span>
                  <span class="highlight">${formatDate(invoiceData.due_date)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Status:</span>
                  <span style="color: #dc3545; font-weight: 500;">${invoiceData.status === 'OVERDUE' ? 'Überfällig' : 'Offen'}</span>
                </div>
              </div>
              
              <div class="due-date">
                <strong>⚠️ Wichtiger Hinweis:</strong> Der Zahlungstermin ist am <strong>${formatDate(invoiceData.due_date)}</strong> abgelaufen.
              </div>
              
              <p>Falls Sie diese Rechnung bereits bezahlt haben, können Sie diese E-Mail ignorieren. Bei Fragen oder Problemen stehen wir Ihnen gerne zur Verfügung.</p>
              
              <div class="payment-info">
                <strong>💳 Zahlungsinformationen:</strong><br>
                • QR-Referenz: ${invoiceData.number}<br>
                • Betrag: ${formatAmount(invoiceData.total)}<br>
                • Bitte überweisen Sie den Betrag bis zum ${formatDate(invoiceData.due_date)}
              </div>
              
              <p>Vielen Dank für Ihre prompte Zahlung!</p>
              
              <p>Mit freundlichen Grüssen,<br>
              <strong>Admin AG</strong><br>
              <span style="color: #6c757d; font-size: 14px;">Ihr invoSmart Team</span></p>
            </div>
            
            <div class="footer">
              <div class="contact-info">
                <strong>Kontakt:</strong><br>
                📧 mkrshkov@gmail.com<br>
                🌐 invoSmart.com<br>
                📞 +41 78 220 92 71
              </div>
              <div style="margin-top: 16px; font-size: 12px; color: #999;">
                Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht direkt auf diese E-Mail.
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
            text: `ZAHLUNGSERINNERUNG - RECHNUNG ${invoiceData.number}

Hallo ${invoiceData.customer_company ? invoiceData.customer_company : invoiceData.customer_name},

wir möchten Sie freundlich daran erinnern, dass die Zahlung für folgende Rechnung noch aussteht:

Rechnung: ${invoiceData.number}
Rechnungsbetrag: ${formatAmount(invoiceData.total)}
Rechnungsdatum: ${formatDate(invoiceData.date)}
Fälligkeitsdatum: ${formatDate(invoiceData.due_date)}
Status: ${invoiceData.status === 'OVERDUE' ? 'Überfällig' : 'Offen'}

WICHTIGER HINWEIS: Der Zahlungstermin ist am ${formatDate(invoiceData.due_date)} abgelaufen.

Zahlungsinformationen:
• QR-Referenz: ${invoiceData.number}
• Betrag: ${formatAmount(invoiceData.total)}
• Bitte überweisen Sie den Betrag bis zum ${formatDate(invoiceData.due_date)}

Falls Sie diese Rechnung bereits bezahlt haben, können Sie diese E-Mail ignorieren. Bei Fragen oder Problemen stehen wir Ihnen gerne zur Verfügung.

Vielen Dank für Ihre prompte Zahlung!

Mit freundlichen Grüssen,
Admin AG
Ihr invoSmart Team

---
Kontakt:
📧 mkrshkov@gmail.com
🌐 invoSmart.com
📞 +41 78 220 92 71

Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht direkt auf diese E-Mail.`
        });
        console.log('✅ Email sent successfully:', result.data?.id);
        res.json({
            success: true,
            message: 'Test email sent successfully!',
            messageId: result.data?.id
        });
    }
    catch (error) {
        console.error('❌ Email test failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send test email',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
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