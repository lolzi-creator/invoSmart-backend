import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import {
  sendInvoiceReminder,
  sendInvoiceNotification,
  sendBulkReminders,
  testEmail
} from '../controllers/emailController'

console.log('📧 Loading email routes...')

const router = Router()

// All email routes require authentication
router.use(authenticateToken)

// Send reminder for specific invoice
router.post('/reminder', sendInvoiceReminder)

// Send invoice notification
router.post('/notification', sendInvoiceNotification)

// Send bulk reminders for all overdue invoices
router.post('/bulk-reminders', sendBulkReminders)

// Send test email
router.post('/test', testEmail)

// Simple email templates endpoint
router.get('/templates', (req, res) => {
  res.json({
    success: true,
    message: 'Email templates endpoint - coming soon',
    data: []
  })
})

// Simple send invoice email endpoint
router.post('/invoice/:invoiceId', (req, res) => {
  res.json({
    success: true,
    message: 'Send invoice email - coming soon',
    data: null
  })
})

// Simple send reminder email endpoint
router.post('/reminder/:invoiceId', (req, res) => {
  res.json({
    success: true,
    message: 'Send reminder email - coming soon',
    data: null
  })
})

// Simple preview email endpoint
router.get('/preview/:invoiceId', (req, res) => {
  res.json({
    success: true,
    message: 'Preview email - coming soon',
    data: null
  })
})

console.log('📧 Email routes loaded successfully!')

export default router