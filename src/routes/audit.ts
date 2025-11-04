import { Router } from 'express'
import { getAuditLogs, getAuditStats } from '../controllers/auditController'
import { authenticateToken } from '../middleware/auth'

const router = Router()

router.use(authenticateToken)

/**
 * @route   GET /api/v1/audit
 * @desc    Get audit logs with filters and pagination
 * @access  Private
 */
router.get('/', getAuditLogs)

/**
 * @route   GET /api/v1/audit/stats
 * @desc    Get audit log statistics
 * @access  Private
 */
router.get('/stats', getAuditStats)

export default router




