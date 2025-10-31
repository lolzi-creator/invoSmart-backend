import express from 'express'
import { authenticateToken } from '../middleware/auth'
import multer from 'multer'
import { 
  getExpenses, 
  getExpense, 
  createExpense, 
  updateExpense, 
  deleteExpense,
  uploadExpenseFiles,
  deleteExpenseFile,
  getExpenseCategories,
  getExpenseStats,
  exportExpenses
} from '../controllers/expenseController'

const router = express.Router()

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
})

// All routes require authentication
router.use(authenticateToken)

// Get expenses with pagination and filters
router.get('/', getExpenses)

// Get expense categories (must be before /:id route)
router.get('/categories', getExpenseCategories)

// Get expense statistics (must be before /:id route)
router.get('/stats', getExpenseStats)

// Get single expense
router.get('/:id', getExpense)

// Create new expense
router.post('/', createExpense)

// Update expense
router.put('/:id', updateExpense)

// Delete expense
router.delete('/:id', deleteExpense)

// Upload files for expense
router.post('/:id/files', upload.array('files', 10), uploadExpenseFiles)

// Delete file from expense
router.delete('/:id/files/:fileId', deleteExpenseFile)

// Export expenses (PDF + Excel + ZIP)
router.post('/export', exportExpenses)

export default router
