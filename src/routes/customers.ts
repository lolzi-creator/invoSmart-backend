import { Router } from 'express'
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  importCustomers,
  getCustomerStats
} from '../controllers/customerController'
import { authenticateToken } from '../middleware/auth'
import { validateRequest, schemas } from '../middleware/validation'

const router = Router()

// Apply authentication to all routes
router.use(authenticateToken)

/**
 * @route   GET /api/v1/customers/stats
 * @desc    Get customer statistics
 * @access  Private
 */
router.get('/stats', getCustomerStats)

/**
 * @route   POST /api/v1/customers/import
 * @desc    Bulk import customers from CSV
 * @access  Private
 */
router.post('/import', importCustomers)

/**
 * @route   GET /api/v1/customers
 * @desc    Get all customers with pagination and filtering
 * @access  Private
 */
router.get('/', getCustomers)

/**
 * @route   POST /api/v1/customers
 * @desc    Create new customer
 * @access  Private
 */
router.post('/', validateRequest({ body: schemas.createCustomer }), createCustomer)

/**
 * @route   GET /api/v1/customers/:id
 * @desc    Get customer by ID
 * @access  Private
 */
router.get('/:id', validateRequest({ params: schemas.id }), getCustomer)

/**
 * @route   PUT /api/v1/customers/:id
 * @desc    Update customer
 * @access  Private
 */
router.put('/:id', validateRequest({ params: schemas.id, body: schemas.updateCustomer }), updateCustomer)

/**
 * @route   DELETE /api/v1/customers/:id
 * @desc    Delete customer
 * @access  Private
 */
router.delete('/:id', validateRequest({ params: schemas.id }), deleteCustomer)

export default router
