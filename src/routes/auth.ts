import { Router } from 'express'
import { validateRequest, schemas } from '../middleware/validation'
import { authenticateToken } from '../middleware/auth'
import {
  login,
  register,
  getProfile,
  refreshToken,
  updateProfile,
  changePassword
} from '../controllers/authController'
import Joi from 'joi'

const router = Router()

// Additional validation schemas for auth routes
const authSchemas = {
  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().optional()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().min(6).required(),
    newPassword: Joi.string().min(6).required()
  })
}

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validateRequest({ body: schemas.login }), login)

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user and company
 * @access  Public
 */
router.post('/register', validateRequest({ body: schemas.register }), register)

/**
 * @route   GET /api/v1/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, getProfile)

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh', authenticateToken, refreshToken)

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', 
  authenticateToken, 
  validateRequest({ body: authSchemas.updateProfile }), 
  updateProfile
)

/**
 * @route   PUT /api/v1/auth/password
 * @desc    Change user password
 * @access  Private
 */
router.put('/password', 
  authenticateToken, 
  validateRequest({ body: authSchemas.changePassword }), 
  changePassword
)

export default router
