import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { config, validateConfig } from './config'
import { errorHandler } from './middleware/errorHandler'

// Import routes
import authRoutes from './routes/auth'
import customerRoutes from './routes/customers'
import invoiceRoutes from './routes/invoices'
import quoteRoutes from './routes/quotes'
import paymentRoutes from './routes/payments'
import qrRoutes from './routes/qr'
import emailRoutes from './routes/emails'
import expenseRoutes from './routes/expenses'
import userRoutes from './routes/users'
import auditRoutes from './routes/audit'
// import customerRoutes from './routes/customers'
// import invoiceRoutes from './routes/invoices'
// import paymentRoutes from './routes/payments'
// import emailRoutes from './routes/emails'

const app = express()

// Validate configuration
try {
  validateConfig()
} catch (error) {
  console.error('Configuration validation failed:', error)
  process.exit(1)
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}))

// CORS configuration - temporary fix to allow all origins
app.use(cors({
  origin: true, // Allow all origins temporarily
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Access-Control-Allow-Origin']
}))

// Rate limiting - Disabled for development
// const limiter = rateLimit({
//   windowMs: config.rateLimit.windowMs,
//   max: config.rateLimit.maxRequests,
//   message: {
//     success: false,
//     error: 'Too many requests, please try again later'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// })
// app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'))
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Swiss Invoice API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  })
})

// API routes
app.use('/api/v1', (req, res, next) => {
  res.header('X-API-Version', 'v1')
  next()
})

// API Routes
console.log('🚀 Registering API routes...')
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/customers', customerRoutes)
app.use('/api/v1/invoices', invoiceRoutes)
app.use('/api/v1/quotes', quoteRoutes)
app.use('/api/v1/payments', paymentRoutes)
app.use('/api/v1/qr', qrRoutes)
app.use('/api/v1/emails', emailRoutes)
app.use('/api/v1/expenses', expenseRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/audit', auditRoutes)
console.log('✅ All API routes registered!')
// app.use('/api/v1/customers', customerRoutes)
// app.use('/api/v1/invoices', invoiceRoutes)
// app.use('/api/v1/payments', paymentRoutes)
// app.use('/api/v1/emails', emailRoutes)

// Temporary test routes for development
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
  })
})

// Simple email test endpoint (no auth required)
app.post('/api/v1/test-email', async (req, res) => {
  try {
    console.log('🧪 Testing email service...')
    
    // Get invoice data from request body or use defaults
    const invoiceData = req.body.invoice || {
      number: 'RE-2025-0001',
      total: 2154, // 21.54 CHF in Rappen
      due_date: '2025-11-05',
      date: '2025-10-06',
      customer_name: 'mahnunh',
      customer_company: '',
      customer_email: '',
      customer_language: 'de',
      subtotal: 2000,
      vat_amount: 154,
      status: 'OPEN'
    }
    
    // Format amount in Swiss Francs
    const formatAmount = (amount: number) => {
      return new Intl.NumberFormat('de-CH', {
        style: 'currency',
        currency: 'CHF'
      }).format(amount / 100)
    }

    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString('de-CH')
    }
    
    // Import Resend directly
    const { Resend } = require('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    const result = await resend.emails.send({
      from: 'invoSmart <onboarding@resend.dev>',
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
    })

    console.log('✅ Email sent successfully:', result.data?.id)
    
    res.json({
      success: true,
      message: 'Test email sent successfully!',
      messageId: result.data?.id
    })
    
  } catch (error) {
    console.error('❌ Email test failed:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// 404 handler for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  })
})

// Global error handler
app.use(errorHandler)

// Start server
const PORT = config.port

if (config.nodeEnv !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Swiss Invoice API Server running on port ${PORT}`)
    console.log(`🌍 Environment: ${config.nodeEnv}`)
    console.log(`📊 Health check: http://localhost:${PORT}/health`)
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api/v1`)
    
    if (config.nodeEnv === 'development') {
      console.log('\n📋 Available endpoints:')
      console.log('  - GET  /health')
      console.log('  - GET  /api/v1/test')
      console.log('  - POST /api/v1/auth/login')
      console.log('  - POST /api/v1/auth/register')
      console.log('  - GET  /api/v1/auth/profile')
      console.log('  - POST /api/v1/auth/refresh')
      console.log('  - PUT  /api/v1/auth/profile')
      console.log('  - PUT  /api/v1/auth/password')
      console.log('  - GET  /api/v1/customers (coming soon)')
    }
  })
}

export default app

