import express from 'express'
import { authenticateToken } from '../middleware/auth'
import { 
  getVatRates,
  updateVatRates
} from '../controllers/vatRateController'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// Get VAT rates for company
router.get('/', getVatRates)

// Update VAT rates for company
router.put('/', updateVatRates)

export default router

