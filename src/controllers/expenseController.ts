import { Response } from 'express'
import { supabaseAdmin, db, handleSupabaseError, DatabaseExpense, ExpenseAttachment } from '../lib/supabase'
import { AuthenticatedRequest } from '../types'

// Helper function to generate file path
const generateFilePath = (companyId: string, filename: string): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${companyId}/${year}/${month}/${filename}`
}

// Helper function to generate unique filename
const generateUniqueFilename = (originalName: string): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extension = originalName.split('.').pop()
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
  return `${nameWithoutExt}_${timestamp}_${random}.${extension}`
}

// Get all expenses with pagination and filters
export const getExpenses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId
    if (!companyId) {
      return res.status(401).json({ error: 'Company ID required' })
    }

    const {
      page = 1,
      limit = 10,
      category,
      status,
      startDate,
      endDate,
      search
    } = req.query

    const offset = (Number(page) - 1) * Number(limit)

    let query = db.expenses()
      .select('*')
      .eq('company_id', companyId)
      .order('expense_date', { ascending: false })

    // Apply filters
    if (category) {
      query = query.eq('category', category)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (startDate) {
      query = query.gte('expense_date', startDate)
    }
    if (endDate) {
      query = query.lte('expense_date', endDate)
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Get total count for pagination
    const countQuery = db.expenses()
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
    
    if (category) countQuery.eq('category', category)
    if (status) countQuery.eq('status', status)
    if (startDate) countQuery.gte('expense_date', startDate)
    if (endDate) countQuery.lte('expense_date', endDate)
    if (search) countQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    
    const { count } = await countQuery
    
    // Get paginated results
    const { data: expenses, error } = await query
      .range(offset, offset + Number(limit) - 1)

    if (error) {
      handleSupabaseError(error, 'fetch expenses')
    }

    // Generate signed URLs for attachments
    const expensesWithUrls = await Promise.all(
      (expenses || []).map(async (expense) => {
        const attachmentsWithUrls = await Promise.all(
          (expense.attachments || []).map(async (attachment: ExpenseAttachment) => {
            try {
              // Check if filePath exists and is valid (using camelCase as stored in DB)
              if (!attachment.filePath) {
                return attachment
              }

              const { data: signedUrl } = await supabaseAdmin.storage
                .from('expenses')
                .createSignedUrl(attachment.filePath, 3600) // 1 hour expiry
              
              return {
                ...attachment,
                url: signedUrl?.signedUrl
              }
            } catch (error) {
              console.error('Error generating signed URL:', error)
              return attachment
            }
          })
        )

        return {
          ...expense,
          attachments: attachmentsWithUrls
        }
      })
    )

    return res.json({
      success: true,
      data: {
        expenses: expensesWithUrls,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count || 0,
          pages: Math.ceil((count || 0) / Number(limit))
        }
      }
    })

  } catch (error) {
    console.error('Error fetching expenses:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Get single expense
export const getExpense = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID required' })
    }

    const { data: expense, error } = await db.expenses()
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Expense not found' })
      }
      handleSupabaseError(error, 'fetch expense')
    }

    // Generate signed URLs for attachments
    const attachmentsWithUrls = await Promise.all(
      (expense.attachments || []).map(async (attachment: ExpenseAttachment) => {
        try {
          // Check if filePath exists and is valid (using camelCase as stored in DB)
          if (!attachment.filePath) {
            return attachment
          }

          const { data: signedUrl } = await supabaseAdmin.storage
            .from('expenses')
            .createSignedUrl(attachment.filePath, 3600)
          
          return {
            ...attachment,
            url: signedUrl?.signedUrl
          }
        } catch (error) {
          console.error('Error generating signed URL:', error)
          return attachment
        }
      })
    )

    return res.json({
      success: true,
      data: {
        expense: {
          ...expense,
          attachments: attachmentsWithUrls
        }
      }
    })

  } catch (error) {
    console.error('Error fetching expense:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Create new expense
export const createExpense = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Company ID and User ID required' })
    }

    const {
      title,
      description,
      amount,
      currency = 'CHF',
      category,
      subcategory,
      payment_method,
      expense_date,
      payment_date,
      vat_rate = 7.7,
      is_tax_deductible = true
    } = req.body

    if (!title || !amount || !category || !expense_date) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, amount, category, expense_date' 
      })
    }

    // Calculate VAT amount
    const vatAmount = Math.round(amount * (vat_rate / 100))

    const expenseData = {
      company_id: companyId,
      user_id: userId,
      title,
      description,
      amount: Math.round(amount), // Convert to Rappen
      currency,
      category,
      subcategory,
      payment_method,
      expense_date,
      payment_date,
      vat_rate,
      vat_amount: vatAmount,
      is_tax_deductible,
      attachments: []
    }

    const { data: expense, error } = await db.expenses()
      .insert(expenseData)
      .select()
      .single()

    if (error) {
      handleSupabaseError(error, 'create expense')
    }

    return res.status(201).json({
      success: true,
      data: { expense },
      message: 'Expense created successfully'
    })

  } catch (error) {
    console.error('Error creating expense:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Update expense
export const updateExpense = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID required' })
    }

    const {
      title,
      description,
      amount,
      currency,
      category,
      subcategory,
      payment_method,
      expense_date,
      payment_date,
      status,
      vat_rate,
      is_tax_deductible
    } = req.body

    const updateData: any = {}
    
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (amount !== undefined) {
      updateData.amount = Math.round(amount)
      // Recalculate VAT if amount changed
      if (vat_rate !== undefined) {
        updateData.vat_amount = Math.round(amount * (vat_rate / 100))
      }
    }
    if (currency !== undefined) updateData.currency = currency
    if (category !== undefined) updateData.category = category
    if (subcategory !== undefined) updateData.subcategory = subcategory
    if (payment_method !== undefined) updateData.payment_method = payment_method
    if (expense_date !== undefined) updateData.expense_date = expense_date
    if (payment_date !== undefined) updateData.payment_date = payment_date
    if (status !== undefined) updateData.status = status
    if (vat_rate !== undefined) {
      updateData.vat_rate = vat_rate
      // Recalculate VAT amount
      const currentAmount = amount || (await db.expenses().select('amount').eq('id', id).single()).data?.amount
      if (currentAmount) {
        updateData.vat_amount = Math.round(currentAmount * (vat_rate / 100))
      }
    }
    if (is_tax_deductible !== undefined) updateData.is_tax_deductible = is_tax_deductible

    updateData.updated_at = new Date().toISOString()

    const { data: expense, error } = await db.expenses()
      .update(updateData)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Expense not found' })
      }
      handleSupabaseError(error, 'update expense')
    }

    return res.json({
      success: true,
      data: { expense },
      message: 'Expense updated successfully'
    })

  } catch (error) {
    console.error('Error updating expense:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Delete expense
export const deleteExpense = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID required' })
    }

    // First get the expense to access attachments
    const { data: expense, error: fetchError } = await db.expenses()
      .select('attachments')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Expense not found' })
      }
      handleSupabaseError(fetchError, 'fetch expense for deletion')
    }

    // Delete files from storage
    if (expense && expense.attachments && expense.attachments.length > 0) {
      const filePaths = expense.attachments.map((attachment: ExpenseAttachment) => attachment.filePath)
      
      try {
        await supabaseAdmin.storage
          .from('expenses')
          .remove(filePaths)
      } catch (storageError) {
        console.error('Error deleting files from storage:', storageError)
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete from database
    const { error } = await db.expenses()
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      handleSupabaseError(error, 'delete expense')
    }

    return res.json({
      success: true,
      message: 'Expense deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting expense:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Upload files to expense
export const uploadExpenseFiles = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID required' })
    }

    // Check if expense exists and belongs to company
    const { data: expense, error: fetchError } = await db.expenses()
      .select('id, attachments')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Expense not found' })
      }
      handleSupabaseError(fetchError, 'fetch expense for file upload')
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' })
    }

    const uploadedFiles: ExpenseAttachment[] = []

    for (const file of req.files) {
      try {
        const uniqueFilename = generateUniqueFilename(file.originalname)
        const filePath = generateFilePath(companyId, uniqueFilename)

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('expenses')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            cacheControl: '3600'
          })

        if (uploadError) {
          console.error('Error uploading file to storage:', uploadError)
          continue
        }

        const attachment: ExpenseAttachment = {
          id: crypto.randomUUID(),
          expense_id: id,
          filename: uniqueFilename,
          originalName: file.originalname,
          filePath: uploadData.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date().toISOString()
        }

        uploadedFiles.push(attachment)
      } catch (fileError) {
        console.error('Error processing file:', fileError)
        continue
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'No files were successfully uploaded' })
    }

    // Update expense with new attachments
    const updatedAttachments = [...(expense?.attachments || []), ...uploadedFiles]

    const { error: updateError } = await db.expenses()
      .update({ 
        attachments: updatedAttachments,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', companyId)

    if (updateError) {
      handleSupabaseError(updateError, 'update expense attachments')
    }

    return res.json({
      success: true,
      data: { 
        uploadedFiles,
        totalAttachments: updatedAttachments.length
      },
      message: `${uploadedFiles.length} file(s) uploaded successfully`
    })

  } catch (error) {
    console.error('Error uploading files:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Delete file from expense
export const deleteExpenseFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, fileId } = req.params
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID required' })
    }

    // Get expense with attachments
    const { data: expense, error: fetchError } = await db.expenses()
      .select('attachments')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Expense not found' })
      }
      handleSupabaseError(fetchError, 'fetch expense for file deletion')
    }

    // Find the file to delete
    const fileToDelete = expense?.attachments?.find((attachment: ExpenseAttachment) => attachment.id === fileId)
    
    if (!fileToDelete) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Delete from storage
    try {
      await supabaseAdmin.storage
        .from('expenses')
        .remove([fileToDelete.filePath])
    } catch (storageError) {
      console.error('Error deleting file from storage:', storageError)
      // Continue with database update even if storage deletion fails
    }

    // Remove from expense attachments
    const updatedAttachments = (expense?.attachments || []).filter((attachment: ExpenseAttachment) => attachment.id !== fileId)

    const { error: updateError } = await db.expenses()
      .update({ 
        attachments: updatedAttachments,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', companyId)

    if (updateError) {
      handleSupabaseError(updateError, 'update expense attachments')
    }

    return res.json({
      success: true,
      message: 'File deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting file:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Get expense categories
export const getExpenseCategories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = [
      'Office Supplies',
      'Equipment',
      'Software & Subscriptions',
      'Travel & Transportation',
      'Meals & Entertainment',
      'Marketing & Advertising',
      'Professional Services',
      'Utilities',
      'Rent & Facilities',
      'Insurance',
      'Training & Education',
      'Other'
    ]

    return res.json({
      success: true,
      data: { categories }
    })

  } catch (error) {
    console.error('Error fetching categories:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Get expense statistics
export const getExpenseStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId
    const { period = 'month' } = req.query

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID required' })
    }

    let dateFilter = ''
    if (period === 'month') {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      dateFilter = startOfMonth.toISOString().split('T')[0]
    } else if (period === 'year') {
      const startOfYear = new Date()
      startOfYear.setMonth(0, 1)
      startOfYear.setHours(0, 0, 0, 0)
      dateFilter = startOfYear.toISOString().split('T')[0]
    }

    let query = db.expenses()
      .select('amount, category, status, expense_date')
      .eq('company_id', companyId)

    if (dateFilter) {
      query = query.gte('expense_date', dateFilter)
    }

    const { data: expenses, error } = await query

    if (error) {
      handleSupabaseError(error, 'fetch expense stats')
    }

    const totalAmount = expenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0
    const totalCount = expenses?.length || 0

    // Group by category
    const categoryStats = expenses?.reduce((acc, expense) => {
      const category = expense.category
      if (!acc[category]) {
        acc[category] = { count: 0, amount: 0 }
      }
      acc[category].count++
      acc[category].amount += expense.amount
      return acc
    }, {} as Record<string, { count: number, amount: number }>) || {}

    // Group by status
    const statusStats = expenses?.reduce((acc, expense) => {
      const status = expense.status
      if (!acc[status]) {
        acc[status] = { count: 0, amount: 0 }
      }
      acc[status].count++
      acc[status].amount += expense.amount
      return acc
    }, {} as Record<string, { count: number, amount: number }>) || {}

    return res.json({
      success: true,
      data: {
        totalAmount,
        totalCount,
        categoryStats,
        statusStats,
        period
      }
    })

  } catch (error) {
    console.error('Error fetching expense stats:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}







