import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import {
  getInvitationByToken,
  acceptInvitation,
  getInvitations,
  cancelInvitation
} from '../controllers/invitationController'

const router = Router()

// Public routes (no auth required)
/**
 * @route   GET /api/v1/invitations/:token
 * @desc    Get invitation details by token
 * @access  Public
 */
router.get('/:token', getInvitationByToken)

/**
 * @route   POST /api/v1/invitations/:token/accept
 * @desc    Accept invitation and create user account
 * @access  Public
 */
router.post('/:token/accept', acceptInvitation)

// Protected routes (admin only)
router.use(authenticateToken)

/**
 * @route   GET /api/v1/invitations
 * @desc    Get all invitations for company
 * @access  Private (Admin only)
 */
router.get('/', getInvitations)

/**
 * @route   DELETE /api/v1/invitations/:id
 * @desc    Cancel/Delete invitation
 * @access  Private (Admin only)
 */
router.delete('/:id', cancelInvitation)

export default router

