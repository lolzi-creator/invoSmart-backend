import { Router } from 'express'
import {
  getPayments,
  getPayment,
  getPaymentsByInvoice,
  createPayment,
  importPayments,
  importPaymentsCSV,
  importPaymentsMT940,
  importPaymentsCAMT053,
  matchPayment,
  deletePayment,
  getPaymentStats,
  getPaymentSuggestions,
  debugPaymentMatching,
  runAutoMatch
} from '../controllers/paymentController'
import { authenticateToken } from '../middleware/auth'
import { validateRequest, schemas } from '../middleware/validation'

const router = Router()

// Apply authentication to all routes
router.use(authenticateToken)

/**
 * @route   GET /api/v1/payments/stats
 * @desc    Get payment statistics
 * @access  Private
 */
router.get('/stats', getPaymentStats)

/**
 * @route   GET /api/v1/payments/debug
 * @desc    Debug payment matching
 * @access  Private
 */
router.get('/debug', debugPaymentMatching)

/**
 * @route   POST /api/v1/payments/import
 * @desc    Import payments from bank statement
 * @access  Private
 */
router.post('/import', importPayments)

/**
 * @route   POST /api/v1/payments/import/csv
 * @desc    Import payments from CSV
 * @access  Private
 */
router.post('/import/csv', importPaymentsCSV)

/**
 * @route   POST /api/v1/payments/import/mt940
 * @desc    Import payments from MT940
 * @access  Private
 */
router.post('/import/mt940', importPaymentsMT940)

/**
 * @route   POST /api/v1/payments/import/camt053
 * @desc    Import payments from CAMT.053
 * @access  Private
 */
router.post('/import/camt053', importPaymentsCAMT053)

/**
 * @route   POST /api/v1/payments/auto-match
 * @desc    Run automatic payment matching
 * @access  Private
 */
router.post('/auto-match', runAutoMatch)

/**
 * @route   GET /api/v1/payments
 * @desc    Get all payments with pagination and filtering
 * @access  Private
 */
router.get('/', getPayments)

/**
 * @route   GET /api/v1/payments/invoice/:invoiceId
 * @desc    Get payments for a specific invoice
 * @access  Private
 */
router.get('/invoice/:invoiceId', getPaymentsByInvoice)

/**
 * @route   GET /api/v1/payments/:id/suggestions
 * @desc    Get payment matching suggestions
 * @access  Private
 */
router.get('/:id/suggestions', getPaymentSuggestions)

/**
 * @route   POST /api/v1/payments
 * @desc    Create new payment
 * @access  Private
 */
router.post('/', validateRequest({ body: schemas.createPayment }), createPayment)

/**
 * @route   GET /api/v1/payments/:id
 * @desc    Get payment by ID
 * @access  Private
 */
router.get('/:id', validateRequest({ params: schemas.id }), getPayment)

/**
 * @route   PATCH /api/v1/payments/:id/match
 * @desc    Match payment to invoice
 * @access  Private
 */
router.patch('/:id/match', validateRequest({ 
  params: schemas.id,
  body: schemas.matchPayment 
}), matchPayment)

/**
 * @route   DELETE /api/v1/payments/:id
 * @desc    Delete payment
 * @access  Private
 */
router.delete('/:id', validateRequest({ params: schemas.id }), deletePayment)

export default router
