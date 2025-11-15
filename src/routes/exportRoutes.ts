import express from 'express'
import { authenticateToken } from '../middleware/auth'
import {
  exportInvoicesCSV,
  exportQuotesCSV,
  exportPaymentsCSV,
  exportCustomersCSV,
  exportInvoicesPDF,
  exportQuotesPDF,
  exportPaymentsPDF,
  exportCustomersPDF
} from '../controllers/exportController'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// CSV Export routes
router.get('/invoices/csv', exportInvoicesCSV)
router.get('/quotes/csv', exportQuotesCSV)
router.get('/payments/csv', exportPaymentsCSV)
router.get('/customers/csv', exportCustomersCSV)

// PDF Export routes
router.get('/invoices/pdf', exportInvoicesPDF)
router.get('/quotes/pdf', exportQuotesPDF)
router.get('/payments/pdf', exportPaymentsPDF)
router.get('/customers/pdf', exportCustomersPDF)

export default router

