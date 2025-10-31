import { Response } from 'express'
import { supabaseAdmin, db, handleSupabaseError, DatabaseExpense, ExpenseAttachment } from '../lib/supabase'
import { AuthenticatedRequest } from '../types'

// Helper function to sanitize names for file paths
const sanitizeForPath = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

// Helper function to generate file path (Option 3 structure)
// Format: CompanyName/Year/Month/Category/ExpenseID/filename
const generateFilePath = async (
  companyId: string, 
  expenseId: string, 
  category: string, 
  expenseDate: string,
  filename: string
): Promise<string> => {
  // Get company name
  const { data: company, error } = await db.companies()
    .select('name')
    .eq('id', companyId)
    .single()
  
  const companyName = company?.name || 'Company'
  const sanitizedCompanyName = sanitizeForPath(companyName)
  
  // Parse expense date to get year and month
  const date = new Date(expenseDate)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December']
  const monthName = monthNames[date.getMonth()]
  
  const sanitizedCategory = sanitizeForPath(category)
  
  return `${sanitizedCompanyName}/${year}/${month}-${monthName}/${sanitizedCategory}/${expenseId}/${filename}`
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
      is_tax_deductible = true,
      vendor_name,
      is_recurring = false,
      recurring_period,
      budget_category,
      notes
    } = req.body

    if (!title || !amount || !category || !expense_date) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, amount, category, expense_date' 
      })
    }

    // Calculate VAT amount
    const vatAmount = Math.round(amount * (vat_rate / 100))

    const expenseData: any = {
      company_id: companyId,
      user_id: userId,
      title,
      description,
      amount: Math.round(amount), // Convert to Rappen
      currency,
      category,
      subcategory: subcategory || null,
      payment_method: payment_method || null,
      expense_date,
      payment_date: payment_date || null,
      vat_rate,
      vat_amount: vatAmount,
      is_tax_deductible,
      attachments: []
    }
    
    // Add optional fields for Option 3
    if (vendor_name) expenseData.vendor_name = vendor_name
    if (is_recurring !== undefined) expenseData.is_recurring = is_recurring
    if (recurring_period) expenseData.recurring_period = recurring_period
    if (budget_category) expenseData.budget_category = budget_category
    if (notes) expenseData.notes = notes

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
      is_tax_deductible,
      vendor_name,
      is_recurring,
      recurring_period,
      budget_category,
      notes
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
    if (vendor_name !== undefined) updateData.vendor_name = vendor_name
    if (is_recurring !== undefined) updateData.is_recurring = is_recurring
    if (recurring_period !== undefined) updateData.recurring_period = recurring_period
    if (budget_category !== undefined) updateData.budget_category = budget_category
    if (notes !== undefined) updateData.notes = notes

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
      .select('id, attachments, category, expense_date')
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
        const filePath = await generateFilePath(
          companyId, 
          id, 
          expense?.category || 'Uncategorized',
          expense?.expense_date || new Date().toISOString().split('T')[0],
          uniqueFilename
        )

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

// Export expenses (PDF + Excel + ZIP)
export const exportExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.user?.companyId
    const { startDate, endDate, format } = req.body

    if (!companyId) {
      res.status(401).json({ error: 'Company ID required' })
      return
    }

    if (!startDate || !endDate) {
      res.status(400).json({ error: 'Start date and end date are required' })
      return
    }

    // Fetch all expenses in the date range
    const { data: expenses, error: expensesError } = await db.expenses()
      .select('*')
      .eq('company_id', companyId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .order('expense_date', { ascending: false })

    if (expensesError) {
      handleSupabaseError(expensesError, 'fetch expenses for export')
      return
    }

    if (!expenses || expenses.length === 0) {
      res.status(404).json({ error: 'No expenses found for the selected date range' })
      return
    }

    // Get company data
    const { data: company, error: companyError } = await db.companies()
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      res.status(404).json({ error: 'Company not found' })
      return
    }

    const ExcelJS = require('exceljs')
    const archiver = require('archiver')
    const htmlPdf = require('html-pdf-node')

    // Calculate totals
    const totalAmount = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0) / 100
    const totalVAT = expenses.reduce((sum, exp) => sum + (exp.vat_amount || 0), 0) / 100
    const totalCount = expenses.length

    // Group by category
    const categoryStats: Record<string, { count: number; amount: number }> = {}
    expenses.forEach(exp => {
      const category = exp.category || 'Uncategorized'
      if (!categoryStats[category]) {
        categoryStats[category] = { count: 0, amount: 0 }
      }
      categoryStats[category].count++
      categoryStats[category].amount += (exp.amount || 0) / 100
    })

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('de-CH')
    }

    // Generate PDF summary
    const pdfHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Expense Report - ${formatDate(startDate)} to ${formatDate(endDate)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
          h1 { color: #f59e0b; margin-bottom: 10px; }
          h2 { color: #333; margin-top: 30px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f8f9fa; font-weight: bold; }
          .summary { background-color: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .total { font-weight: bold; font-size: 14px; }
          .right { text-align: right; }
        </style>
      </head>
      <body>
        <h1>Expense Report</h1>
        <div>
          <p><strong>Company:</strong> ${company.name}</p>
          <p><strong>Period:</strong> ${formatDate(startDate)} - ${formatDate(endDate)}</p>
        </div>
        
        <div class="summary">
          <h2>Summary</h2>
          <p>Total Expenses: <strong>CHF ${totalAmount.toFixed(2)}</strong></p>
          <p>Total VAT: <strong>CHF ${totalVAT.toFixed(2)}</strong></p>
          <p>Total Count: <strong>${totalCount}</strong> expenses</p>
        </div>

        <h2>By Category</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th class="right">Count</th>
              <th class="right">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(categoryStats).map(([cat, stats]) => `
              <tr>
                <td>${cat}</td>
                <td class="right">${stats.count}</td>
                <td class="right">CHF ${stats.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>Detailed List</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Title</th>
              <th>Category</th>
              <th>Vendor</th>
              <th class="right">Amount</th>
              <th class="right">VAT</th>
              <th class="right">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(exp => `
              <tr>
                <td>${formatDate(exp.expense_date)}</td>
                <td>${exp.title || ''}</td>
                <td>${exp.category || ''}</td>
                <td>${exp.vendor_name || '-'}</td>
                <td class="right">CHF ${((exp.amount || 0) / 100).toFixed(2)}</td>
                <td class="right">CHF ${((exp.vat_amount || 0) / 100).toFixed(2)}</td>
                <td class="right">CHF ${(((exp.amount || 0) + (exp.vat_amount || 0)) / 100).toFixed(2)}</td>
                <td>${exp.status || 'PENDING'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `

    // Generate PDF buffer
    const pdfOptions = {
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
      printBackground: true,
      timeout: 30000
    }
    const pdfBuffer = await htmlPdf.generatePdf({ content: pdfHtml }, pdfOptions)

    // Generate Excel workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Expenses')

    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Summary')
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ]
    summarySheet.addRow({ metric: 'Total Expenses', value: `CHF ${totalAmount.toFixed(2)}` })
    summarySheet.addRow({ metric: 'Total VAT', value: `CHF ${totalVAT.toFixed(2)}` })
    summarySheet.addRow({ metric: 'Total Count', value: totalCount })
    summarySheet.addRow({ metric: 'Period', value: `${formatDate(startDate)} - ${formatDate(endDate)}` })
    summarySheet.addRow({})
    summarySheet.addRow({ metric: 'Category', value: 'Total Amount' })
    Object.entries(categoryStats).forEach(([cat, stats]) => {
      summarySheet.addRow({ metric: cat, value: `CHF ${stats.amount.toFixed(2)} (${stats.count} expenses)` })
    })

    // Add expenses sheet
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Subcategory', key: 'subcategory', width: 15 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Amount (CHF)', key: 'amount', width: 15 },
      { header: 'VAT Rate (%)', key: 'vatRate', width: 12 },
      { header: 'VAT Amount (CHF)', key: 'vatAmount', width: 15 },
      { header: 'Total (CHF)', key: 'total', width: 15 },
      { header: 'Payment Date', key: 'paymentDate', width: 12 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Tax Deductible', key: 'taxDeductible', width: 15 },
      { header: 'Description', key: 'description', width: 40 }
    ]

    expenses.forEach(exp => {
      const amountCHF = (exp.amount || 0) / 100
      const vatAmountCHF = (exp.vat_amount || 0) / 100
      const totalCHF = amountCHF + vatAmountCHF

      worksheet.addRow({
        date: formatDate(exp.expense_date),
        title: exp.title || '',
        category: exp.category || '',
        subcategory: exp.subcategory || '',
        vendor: exp.vendor_name || '',
        amount: amountCHF,
        vatRate: exp.vat_rate || 0,
        vatAmount: vatAmountCHF,
        total: totalCHF,
        paymentDate: exp.payment_date ? formatDate(exp.payment_date) : '',
        paymentMethod: exp.payment_method || '',
        status: exp.status || 'PENDING',
        taxDeductible: exp.is_tax_deductible ? 'Yes' : 'No',
        description: exp.description || ''
      })
    })

    // Add totals row
    worksheet.addRow({})
    worksheet.addRow({
      title: 'TOTALS',
      amount: totalAmount,
      vatAmount: totalVAT,
      total: totalAmount + totalVAT
    })

    // Style totals row
    const totalsRow = worksheet.getRow(worksheet.rowCount)
    totalsRow.font = { bold: true }
    ;['amount', 'vatAmount', 'total'].forEach(key => {
      const cell = totalsRow.getCell(key)
      cell.numFmt = '#,##0.00'
    })

    // Format number columns
    worksheet.getColumn('amount').numFmt = '#,##0.00'
    worksheet.getColumn('vatAmount').numFmt = '#,##0.00'
    worksheet.getColumn('total').numFmt = '#,##0.00'
    worksheet.getColumn('vatRate').numFmt = '0.00'

    // Generate Excel buffer
    const excelBuffer = await workbook.xlsx.writeBuffer()

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } })

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="expenses-export-${startDate}-to-${endDate}.zip"`)

    archive.pipe(res)

    // Add PDF to ZIP
    archive.append(pdfBuffer, { name: 'Expense-Report.pdf' })

    // Add Excel to ZIP
    archive.append(excelBuffer, { name: 'Expenses-Detail.xlsx' })

    // Download and add all receipt files
    const filePromises: Promise<void>[] = []
    for (const expense of expenses) {
      if (expense.attachments && Array.isArray(expense.attachments)) {
        for (const attachment of expense.attachments) {
          if (attachment.filePath) {
            filePromises.push(
              (async () => {
                try {
                  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
                    .from('expenses')
                    .download(attachment.filePath)

                  if (!downloadError && fileData) {
                    const buffer = Buffer.from(await fileData.arrayBuffer())
                    const fileName = attachment.originalName || attachment.filename || `file-${expense.id}.pdf`
                    const category = expense.category || 'Uncategorized'
                    archive.append(buffer, { name: `Receipts/${category}/${fileName}` })
                  }
                } catch (error) {
                  console.error(`Error downloading file ${attachment.filePath}:`, error)
                }
              })()
            )
          }
        }
      }
    }

    // Wait for all files to be added
    await Promise.all(filePromises)

    // Finalize the archive
    await archive.finalize()

  } catch (error) {
    console.error('Error exporting expenses:', error)
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}







