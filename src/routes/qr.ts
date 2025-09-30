import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import { generateTestQR } from '../controllers/qrController'

const router = Router()

router.use(authenticateToken)

// POST /api/v1/qr/test - returns PNG dataUrl and payload
router.post('/test', generateTestQR)

export default router


