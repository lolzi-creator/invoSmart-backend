import { Request, Response, NextFunction } from 'express'
import Joi from 'joi'

export const validateRequest = (schema: {
  body?: Joi.ObjectSchema
  query?: Joi.ObjectSchema
  params?: Joi.ObjectSchema
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = []

    // Validate body
    if (schema.body) {
      const { error } = schema.body.validate(req.body)
      if (error) {
        errors.push(`Body: ${error.details.map(d => d.message).join(', ')}`)
      }
    }

    // Validate query
    if (schema.query) {
      const { error } = schema.query.validate(req.query)
      if (error) {
        errors.push(`Query: ${error.details.map(d => d.message).join(', ')}`)
      }
    }

    // Validate params
    if (schema.params) {
      const { error } = schema.params.validate(req.params)
      if (error) {
        errors.push(`Params: ${error.details.map(d => d.message).join(', ')}`)
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      })
      return
    }

    next()
  }
}

// Common validation schemas
export const schemas = {
  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // ID parameter
  id: Joi.object({
    id: Joi.string().required()
  }),

  // Company ID check
  companyId: Joi.object({
    companyId: Joi.string().required()
  }),

  // Auth schemas
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),

  register: Joi.object({
    // User data
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    
    // Company data
    companyName: Joi.string().min(2).max(100).required(),
    address: Joi.string().min(5).max(200).required(),
    zip: Joi.string().min(4).max(10).required(),
    city: Joi.string().min(2).max(100).required(),
    phone: Joi.string().optional(),
    companyEmail: Joi.string().email().required(),
    uid: Joi.string().optional(),
    vatNumber: Joi.string().optional(),
    iban: Joi.string().optional()
  }),

  // Customer schemas
  createCustomer: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    company: Joi.string().max(100).optional(),
    address: Joi.string().min(5).max(200).required(),
    zip: Joi.string().min(4).max(10).required(),
    city: Joi.string().min(2).max(100).required(),
    country: Joi.string().length(2).default('CH'),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional(),
    uid: Joi.string().optional(),
    vatNumber: Joi.string().optional(),
    paymentTerms: Joi.number().integer().min(0).max(365).default(30),
    creditLimit: Joi.number().integer().min(0).optional(),
    language: Joi.string().valid('de', 'fr', 'it', 'en').default('de'),
    notes: Joi.string().max(1000).optional()
  }),

  updateCustomer: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    company: Joi.string().max(100).optional(),
    address: Joi.string().min(5).max(200).optional(),
    zip: Joi.string().min(4).max(10).optional(),
    city: Joi.string().min(2).max(100).optional(),
    country: Joi.string().length(2).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional(),
    uid: Joi.string().optional(),
    vatNumber: Joi.string().optional(),
    paymentTerms: Joi.number().integer().min(0).max(365).optional(),
    creditLimit: Joi.number().integer().min(0).optional(),
    language: Joi.string().valid('de', 'fr', 'it', 'en').optional(),
    notes: Joi.string().max(1000).optional(),
    isActive: Joi.boolean().optional()
  }),

  // Invoice schemas
  createInvoice: Joi.object({
    customerId: Joi.string().required(),
    date: Joi.date().optional(),
    dueDate: Joi.date().optional(),
    discountCode: Joi.string().optional(),
    discountAmount: Joi.number().min(0).default(0),
    items: Joi.array().items(
      Joi.object({
        description: Joi.string().min(1).max(500).required(),
        quantity: Joi.number().positive().required(),
        unit: Joi.string().max(20).default('Stück'),
        unitPrice: Joi.number().min(0).required(),
        discount: Joi.number().min(0).max(100).default(0),
        vatRate: Joi.number().min(0).max(100).required()
      })
    ).min(1).required()
  }),

  updateInvoice: Joi.object({
    customerId: Joi.string().optional(),
    date: Joi.date().optional(),
    dueDate: Joi.date().optional(),
    discountCode: Joi.string().optional(),
    discountAmount: Joi.number().min(0).optional(),
    items: Joi.array().items(
      Joi.object({
        description: Joi.string().min(1).max(500).required(),
        quantity: Joi.number().positive().required(),
        unit: Joi.string().max(20).default('Stück'),
        unitPrice: Joi.number().min(0).required(),
        discount: Joi.number().min(0).max(100).default(0),
        vatRate: Joi.number().min(0).max(100).required()
      })
    ).min(1).optional()
  }),

  updateInvoiceStatus: Joi.object({
    status: Joi.string().valid('DRAFT', 'OPEN', 'PARTIAL_PAID', 'PAID', 'OVERDUE', 'CANCELLED').required()
  }),

  // Payment schemas
  createPayment: Joi.object({
    invoiceId: Joi.string().optional(),
    amount: Joi.number().positive().required(),
    valueDate: Joi.date().required(),
    reference: Joi.string().optional(),
    description: Joi.string().max(500).optional(),
    notes: Joi.string().max(1000).optional()
  }),

  matchPayment: Joi.object({
    invoiceId: Joi.string().optional().allow(null)
  }),

  importPayments: Joi.object({
    payments: Joi.array().items(
      Joi.object({
        amount: Joi.number().positive().required(),
        valueDate: Joi.date().required(),
        reference: Joi.string().optional(),
        description: Joi.string().max(500).optional(),
        notes: Joi.string().max(1000).optional()
      })
    ).min(1).max(10000).required(),
    importBatch: Joi.string().optional()
  }),

  // Email schemas
  sendEmail: Joi.object({
    templateId: Joi.string().optional(),
    customSubject: Joi.string().max(200).optional(),
    customBody: Joi.string().optional()
  }),

  sendReminder: Joi.object({
    level: Joi.number().integer().min(1).max(3).default(1),
    templateId: Joi.string().optional(),
    customSubject: Joi.string().max(200).optional(),
    customBody: Joi.string().optional()
  }),

  previewEmail: Joi.object({
    templateId: Joi.string().optional(),
    type: Joi.string().valid('INVOICE', 'REMINDER_1', 'REMINDER_2', 'REMINDER_3').default('INVOICE'),
    customSubject: Joi.string().max(200).optional(),
    customBody: Joi.string().optional()
  }),

  createEmailTemplate: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    subject: Joi.string().min(1).max(200).required(),
    body: Joi.string().min(1).required(),
    type: Joi.string().valid('INVOICE', 'REMINDER_1', 'REMINDER_2', 'REMINDER_3').required(),
    language: Joi.string().valid('de', 'fr', 'it', 'en').default('de')
  }),

  updateEmailTemplate: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    subject: Joi.string().min(1).max(200).optional(),
    body: Joi.string().min(1).optional(),
    type: Joi.string().valid('INVOICE', 'REMINDER_1', 'REMINDER_2', 'REMINDER_3').optional(),
    language: Joi.string().valid('de', 'fr', 'it', 'en').optional()
  })
}
