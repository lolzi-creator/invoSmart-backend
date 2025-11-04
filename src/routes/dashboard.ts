import { Router } from 'express'
import { getDashboardStats } from '../controllers/dashboardController'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// Apply authentication to all routes
router.use(authenticateToken)

/**
 * @route   GET /api/v1/dashboard/stats
 * @desc    Get comprehensive dashboard statistics
 * @access  Private
 */
router.get('/stats', getDashboardStats)

export default router

