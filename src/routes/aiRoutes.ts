import express from 'express'
import { authenticateToken } from '../middleware/auth'
import { chat, queryInvoices, getStats } from '../controllers/aiController'
import { executeAction } from '../controllers/aiActionController'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

/**
 * @route   POST /api/v1/ai/chat
 * @desc    Send a message to the AI assistant
 * @access  Private
 */
router.post('/chat', chat)

/**
 * @route   POST /api/v1/ai/execute
 * @desc    Execute an AI action automatically
 * @access  Private
 */
router.post('/execute', executeAction)

/**
 * @route   POST /api/v1/ai/query-invoices
 * @desc    Query invoices with natural language
 * @access  Private
 */
router.post('/query-invoices', queryInvoices)

/**
 * @route   GET /api/v1/ai/stats
 * @desc    Get business statistics
 * @access  Private
 */
router.get('/stats', getStats)

export default router

