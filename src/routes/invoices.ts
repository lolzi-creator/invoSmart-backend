import { Router } from 'express'
import {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  updateInvoiceStatus,
  getInvoiceStats,
  generateInvoiceQR,
  generateInvoicePdf,
  sendInvoiceReminder,
  generateReminderPdf
} from '../controllers/invoiceController'
import { authenticateToken } from '../middleware/auth'
import { validateRequest, schemas } from '../middleware/validation'

const router = Router()

// Apply authentication to all routes
router.use(authenticateToken)

/**
 * @route   GET /api/v1/invoices/stats
 * @desc    Get invoice statistics
 * @access  Private
 */
router.get('/stats', getInvoiceStats)

/**
 * @route   GET /api/v1/invoices
 * @desc    Get all invoices with pagination and filtering
 * @access  Private
 */
router.get('/', getInvoices)

/**
 * @route   POST /api/v1/invoices
 * @desc    Create new invoice
 * @access  Private
 */
router.post('/', validateRequest({ body: schemas.createInvoice }), createInvoice)

/**
 * @route   GET /api/v1/invoices/:id
 * @desc    Get invoice by ID
 * @access  Private
 */
router.get('/:id', validateRequest({ params: schemas.id }), getInvoice)

/**
 * @route   PUT /api/v1/invoices/:id
 * @desc    Update invoice
 * @access  Private
 */
router.put('/:id', validateRequest({ params: schemas.id }), updateInvoice)

/**
 * @route   DELETE /api/v1/invoices/:id
 * @desc    Delete invoice
 * @access  Private
 */
router.delete('/:id', validateRequest({ params: schemas.id }), deleteInvoice)

/**
 * @route   PATCH /api/v1/invoices/:id/status
 * @desc    Update invoice status
 * @access  Private
 */
router.patch('/:id/status', validateRequest({ 
  params: schemas.id,
  body: schemas.updateInvoiceStatus 
}), updateInvoiceStatus)

/**
 * @route   GET /api/v1/invoices/:id/qr
 * @desc    Generate Swiss QR code for invoice
 * @access  Private
 */
router.get('/:id/qr', validateRequest({ params: schemas.id }), generateInvoiceQR)

/**
 * @route   GET /api/v1/invoices/:id/pdf
 * @desc    Generate invoice PDF
 * @access  Private
 */
router.get('/:id/pdf', validateRequest({ params: schemas.id }), generateInvoicePdf)

/**
 * @route   POST /api/v1/invoices/:id/reminder
 * @desc    Send reminder for overdue invoice
 * @access  Private
 */
router.post('/:id/reminder', validateRequest({ params: schemas.id }), sendInvoiceReminder)

/**
 * @route   GET /api/v1/invoices/:id/reminder-pdf/:level
 * @desc    Generate reminder PDF
 * @access  Private
 */
router.get('/:id/reminder-pdf/:level', validateRequest({ params: schemas.id }), generateReminderPdf)

export default router
