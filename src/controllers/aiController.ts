import { Response } from 'express'
import { AuthenticatedRequest } from '../types'
import { AIService } from '../services/aiService'
import { asyncHandler } from '../middleware/errorHandler'

/**
 * Send a message to the AI assistant
 */
export const chat = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { messages } = req.body
  const companyId = req.user?.companyId
  const userId = req.user?.id

  if (!companyId || !userId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({
      success: false,
      error: 'Messages array is required'
    })
    return
  }

  const response = await AIService.chat(messages, companyId, userId)

  res.json({
    success: true,
    data: response
  })
})

/**
 * Query invoices with natural language
 */
export const queryInvoices = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { query } = req.body
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  const invoices = await AIService.queryInvoices(companyId, query)

  res.json({
    success: true,
    data: invoices
  })
})

/**
 * Get business statistics
 */
export const getStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId

  if (!companyId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    })
    return
  }

  const stats = await AIService.getStats(companyId)

  res.json({
    success: true,
    data: stats
  })
})

