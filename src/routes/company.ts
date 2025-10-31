import express from 'express'
import { authenticateToken } from '../middleware/auth'
import multer from 'multer'
import { 
  getCompany,
  uploadLogo,
  deleteLogo
} from '../controllers/companyController'

const router = express.Router()

// Configure multer for logo upload (single file)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for logos
  },
})

// All routes require authentication
router.use(authenticateToken)

// Get company information
router.get('/', getCompany)

// Upload company logo
router.post('/logo', upload.single('logo'), uploadLogo)

// Delete company logo
router.delete('/logo', deleteLogo)

export default router

