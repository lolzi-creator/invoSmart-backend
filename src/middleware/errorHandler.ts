import { Request, Response, NextFunction } from 'express'
import { config } from '../config'

export interface AppError extends Error {
  statusCode?: number
  code?: string
  isOperational?: boolean
}

export class ValidationError extends Error {
  statusCode = 400
  isOperational = true
  
  constructor(message: string, public details?: any) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends Error {
  statusCode = 401
  isOperational = true
  
  constructor(message: string = 'Authentication required') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends Error {
  statusCode = 403
  isOperational = true
  
  constructor(message: string = 'Insufficient permissions') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends Error {
  statusCode = 404
  isOperational = true
  
  constructor(message: string = 'Resource not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error {
  statusCode = 409
  isOperational = true
  
  constructor(message: string = 'Resource conflict') {
    super(message)
    this.name = 'ConflictError'
  }
}

export class InternalServerError extends Error {
  statusCode = 500
  isOperational = true
  
  constructor(message: string = 'Internal server error') {
    super(message)
    this.name = 'InternalServerError'
  }
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default error values
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal Server Error'
  let code = err.code || 'INTERNAL_ERROR'

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400
    code = 'VALIDATION_ERROR'
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401
    message = 'Invalid token'
    code = 'INVALID_TOKEN'
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Token expired'
    code = 'TOKEN_EXPIRED'
  } else if (err.name === 'CastError') {
    statusCode = 400
    message = 'Invalid ID format'
    code = 'INVALID_ID'
  }

  // Log error in development
  if (config.nodeEnv === 'development') {
    console.error('Error:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      statusCode,
      code,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params
    })
  }

  // Log only essential info in production
  if (config.nodeEnv === 'production' && statusCode >= 500) {
    console.error('Server Error:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    })
  }

  // Send error response
  const response: any = {
    success: false,
    error: message,
    code,
    timestamp: new Date().toISOString()
  }

  // Include stack trace in development
  if (config.nodeEnv === 'development') {
    response.stack = err.stack
    response.details = err
  }

  res.status(statusCode).json(response)
}

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`)
  next(error)
}
