import { Request, Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { AuthenticatedRequest } from '../types'

export interface AuditLog {
  id: string
  user_id: string
  user_name: string
  action: string
  resource_type: string
  resource_id?: string
  details: any
  ip_address?: string
  user_agent?: string
  created_at: string
}

// Create audit log entry
export const createAuditLog = async (
  companyId: string,
  userId: string,
  userName: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: any,
  ipAddress?: string,
  userAgent?: string
) => {
  try {
    const { error } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        company_id: companyId,
        user_id: userId,
        user_name: userName,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details: details || {},
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error creating audit log:', error)
    }
  } catch (error) {
    console.error('Error in createAuditLog:', error)
  }
}

// Get audit logs
export const getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.user!
    const { page = 1, limit = 50, action, resourceType, userId } = req.query

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    // Apply filters
    if (action) {
      query = query.eq('action', action)
    }
    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }

    // Apply pagination
    const from = (Number(page) - 1) * Number(limit)
    const to = from + Number(limit) - 1

    const { data: logs, error } = await query.range(from, to)

    if (error) {
      console.error('Error fetching audit logs:', error)
      return res.status(500).json({ success: false, message: 'Failed to fetch audit logs' })
    }

    // Get total count
    const { count } = await supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)

    return res.json({
      success: true,
      data: {
        logs: logs || [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count || 0,
          pages: Math.ceil((count || 0) / Number(limit))
        }
      }
    })
  } catch (error) {
    console.error('Error in getAuditLogs:', error)
    return res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

// Get audit log statistics
export const getAuditStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.user!
    const { period = '30' } = req.query

    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - Number(period))

    // Get action counts
    const { data: actionStats } = await supabaseAdmin
      .from('audit_logs')
      .select('action')
      .eq('company_id', companyId)
      .gte('created_at', daysAgo.toISOString())

    // Get user activity
    const { data: userStats } = await supabaseAdmin
      .from('audit_logs')
      .select('user_name, user_id')
      .eq('company_id', companyId)
      .gte('created_at', daysAgo.toISOString())

    // Process statistics
    const actionCounts = (actionStats || []).reduce((acc: any, log: any) => {
      acc[log.action] = (acc[log.action] || 0) + 1
      return acc
    }, {})

    const userCounts = (userStats || []).reduce((acc: any, log: any) => {
      acc[log.user_name] = (acc[log.user_name] || 0) + 1
      return acc
    }, {})

    return res.json({
      success: true,
      data: {
        actionCounts,
        userCounts,
        totalLogs: actionStats?.length || 0,
        period: Number(period)
      }
    })
  } catch (error) {
    console.error('Error in getAuditStats:', error)
    return res.status(500).json({ success: false, message: 'Internal server error' })
  }
}



