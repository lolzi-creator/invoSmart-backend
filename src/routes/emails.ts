import { Router } from 'express'
import {
  sendInvoiceEmail,
  sendReminderEmail,
  getEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  previewEmail
} from '../controllers/emailController'
import { authenticateToken } from '../middleware/auth'
import { validateRequest, schemas } from '../middleware/validation'

const router = Router()

// Apply authentication to all routes
router.use(authenticateToken)

/**
 * @route   GET /api/v1/emails/templates
 * @desc    Get email templates
 * @access  Private
 */
router.get('/templates', getEmailTemplates)

/**
 * @route   POST /api/v1/emails/templates
 * @desc    Create email template
 * @access  Private
 */
router.post('/templates', validateRequest({ body: schemas.createEmailTemplate }), createEmailTemplate)

/**
 * @route   PUT /api/v1/emails/templates/:id
 * @desc    Update email template
 * @access  Private
 */
router.put('/templates/:id', validateRequest({ 
  params: schemas.id, 
  body: schemas.updateEmailTemplate 
}), updateEmailTemplate)

/**
 * @route   DELETE /api/v1/emails/templates/:id
 * @desc    Delete email template
 * @access  Private
 */
router.delete('/templates/:id', validateRequest({ params: schemas.id }), deleteEmailTemplate)

/**
 * @route   POST /api/v1/emails/invoice/:invoiceId
 * @desc    Send invoice email
 * @access  Private
 */
router.post('/invoice/:invoiceId', validateRequest({ 
  body: schemas.sendEmail 
}), sendInvoiceEmail)

/**
 * @route   POST /api/v1/emails/reminder/:invoiceId
 * @desc    Send reminder email
 * @access  Private
 */
router.post('/reminder/:invoiceId', validateRequest({ 
  body: schemas.sendReminder 
}), sendReminderEmail)

/**
 * @route   GET /api/v1/emails/preview/:invoiceId
 * @desc    Preview email template
 * @access  Private
 */
router.get('/preview/:invoiceId', previewEmail)

export default router
