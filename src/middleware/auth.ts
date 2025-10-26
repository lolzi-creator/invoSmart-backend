import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { User, UserRole, AuthenticatedRequest } from '../types'

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Access token required'
    })
    return
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any
    req.user = decoded.user
    next()
  } catch (error) {
    res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    })
    return
  }
}

export const requireRole = (roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      })
      return
    }

    if (!roles.includes(req.user.role as UserRole)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      })
      return
    }

    next()
  }
}

export const requireAdmin = requireRole([UserRole.ADMIN])

export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return next()
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any
    req.user = decoded.user
  } catch (error) {
    // Token invalid, but continue anyway
  }

  next()
}
