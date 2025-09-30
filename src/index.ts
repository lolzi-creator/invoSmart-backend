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
import paymentRoutes from './routes/payments'
import qrRoutes from './routes/qr'
import emailRoutes from './routes/emails'
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

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

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
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/customers', customerRoutes)
app.use('/api/v1/invoices', invoiceRoutes)
app.use('/api/v1/payments', paymentRoutes)
app.use('/api/v1/qr', qrRoutes)
app.use('/api/v1/emails', emailRoutes)
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
