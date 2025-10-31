import { Router } from 'express'
import {
  getQuotes,
  getQuote,
  createQuote,
  updateQuote,
  updateQuoteStatus,
  sendQuoteEmail,
  deleteQuote,
  getQuoteByToken,
  acceptQuote,
  downloadQuotePDF
} from '../controllers/quoteController'
import { authenticateToken } from '../middleware/auth'
import { validateRequest, schemas } from '../middleware/validation'

const router = Router()

// Public routes (no authentication required)
router.get('/token/:token', getQuoteByToken)
router.post('/accept/:token', acceptQuote)

// Apply authentication to all routes below
router.use(authenticateToken)

/**
 * @route   GET /api/v1/quotes
 * @desc    Get all quotes
 * @access  Private
 */
router.get('/', getQuotes)

/**
 * @route   GET /api/v1/quotes/:id
 * @desc    Get quote by ID
 * @access  Private
 */
router.get('/:id', validateRequest({ params: schemas.id }), getQuote)

/**
 * @route   POST /api/v1/quotes
 * @desc    Create new quote
 * @access  Private
 */
router.post('/', validateRequest({ body: schemas.createQuote }), createQuote)

/**
 * @route   PUT /api/v1/quotes/:id
 * @desc    Update quote
 * @access  Private
 */
router.put('/:id', validateRequest({ params: schemas.id, body: schemas.createQuote }), updateQuote)

/**
 * @route   PATCH /api/v1/quotes/:id/status
 * @desc    Update quote status
 * @access  Private
 */
router.patch('/:id/status', validateRequest({ 
  params: schemas.id,
  body: schemas.updateQuoteStatus 
}), updateQuoteStatus)

/**
 * @route   POST /api/v1/quotes/:id/send
 * @desc    Send quote email to customer
 * @access  Private
 */
router.post('/:id/send', validateRequest({ params: schemas.id }), sendQuoteEmail)

/**
 * @route   DELETE /api/v1/quotes/:id
 * @desc    Delete quote
 * @access  Private
 */
router.delete('/:id', validateRequest({ params: schemas.id }), deleteQuote)

/**
 * @route   GET /api/v1/quotes/:id/pdf
 * @desc    Download quote PDF
 * @access  Private
 */
router.get('/:id/pdf', validateRequest({ params: schemas.id }), downloadQuotePDF)

export default router

