import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import {
  getUsers,
  inviteUser,
  updateUserRole,
  deactivateUser,
  reactivateUser
} from '../controllers/userController'

const router = Router()

// All routes require authentication
router.use(authenticateToken)

/**
 * @route   GET /api/v1/users
 * @desc    Get all users in company
 * @access  Private
 */
router.get('/', getUsers)

/**
 * @route   POST /api/v1/users/invite
 * @desc    Invite a new user to the company
 * @access  Private (Admin only)
 */
router.post('/invite', inviteUser)

/**
 * @route   PATCH /api/v1/users/:userId/role
 * @desc    Update user role
 * @access  Private (Admin only)
 */
router.patch('/:userId/role', updateUserRole)

/**
 * @route   PATCH /api/v1/users/:userId/deactivate
 * @desc    Deactivate user
 * @access  Private (Admin only)
 */
router.patch('/:userId/deactivate', deactivateUser)

/**
 * @route   PATCH /api/v1/users/:userId/reactivate
 * @desc    Reactivate user
 * @access  Private (Admin only)
 */
router.patch('/:userId/reactivate', reactivateUser)

export default router




