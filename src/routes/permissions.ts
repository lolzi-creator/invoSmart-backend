import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import {
  getPermissions,
  getRolePermissions,
  updateRolePermissions,
  resetRolePermissions
} from '../controllers/permissionController'

const router = Router()

// All routes require authentication and admin role
router.use(authenticateToken)

/**
 * @route   GET /api/v1/permissions
 * @desc    Get all available permissions grouped by module
 * @access  Private (Admin only)
 */
router.get('/', getPermissions)

/**
 * @route   GET /api/v1/permissions/roles/:role
 * @desc    Get permissions for a specific role
 * @access  Private (Admin only)
 */
router.get('/roles/:role', getRolePermissions)

/**
 * @route   PUT /api/v1/permissions/roles/:role
 * @desc    Update permissions for a specific role
 * @access  Private (Admin only)
 */
router.put('/roles/:role', updateRolePermissions)

/**
 * @route   POST /api/v1/permissions/roles/:role/reset
 * @desc    Reset role permissions to defaults
 * @access  Private (Admin only)
 */
router.post('/roles/:role/reset', resetRolePermissions)

export default router

