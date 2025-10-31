import { Response } from 'express'
import { db, supabaseAdmin } from '../lib/supabase'
import { AuthenticatedRequest } from '../types'

/**
 * @desc    Get all permissions grouped by module
 * @route   GET /api/v1/permissions
 * @access  Private (Admin only)
 */
export const getPermissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role } = req.user!

    if (role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can view permissions'
      })
    }

    const { data: permissions, error } = await supabaseAdmin.from('permissions')
      .select('*')
      .order('module', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching permissions:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch permissions'
      })
    }

    // Group by module
    const grouped = (permissions || []).reduce((acc: any, perm: any) => {
      if (!acc[perm.module]) {
        acc[perm.module] = []
      }
      acc[perm.module].push(perm)
      return acc
    }, {})

    return res.json({
      success: true,
      data: {
        permissions: grouped,
        allPermissions: permissions || []
      }
    })
  } catch (error) {
    console.error('Error in getPermissions:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * @desc    Get role permissions for company
 * @route   GET /api/v1/permissions/roles/:role
 * @access  Private (Admin only)
 */
export const getRolePermissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, role: userRole } = req.user!
    const { role } = req.params

    if (userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can view role permissions'
      })
    }

    if (!['ADMIN', 'EMPLOYEE'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      })
    }

    const { data: rolePermissions, error } = await supabaseAdmin.from('role_permissions')
      .select(`
        *,
        permissions (
          id,
          name,
          description,
          module
        )
      `)
      .eq('company_id', companyId)
      .eq('role', role)

    if (error) {
      console.error('Error fetching role permissions:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch role permissions'
      })
    }

    // Transform to a more usable format
    const permissionsMap: any = {}
    rolePermissions?.forEach((rp: any) => {
      if (rp.permissions) {
        permissionsMap[rp.permissions.name] = {
          id: rp.id,
          permissionId: rp.permission_id,
          isGranted: rp.is_granted,
          permission: rp.permissions
        }
      }
    })

    return res.json({
      success: true,
      data: {
        role,
        permissions: permissionsMap,
        rolePermissions: rolePermissions || []
      }
    })
  } catch (error) {
    console.error('Error in getRolePermissions:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * @desc    Update role permissions
 * @route   PUT /api/v1/permissions/roles/:role
 * @access  Private (Admin only)
 */
export const updateRolePermissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, role: userRole } = req.user!
    const { role } = req.params
    const { permissions } = req.body // { 'permission.name': true/false }

    if (userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can update role permissions'
      })
    }

    if (!['ADMIN', 'EMPLOYEE'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      })
    }

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Permissions object is required'
      })
    }

    // Get all permission IDs by name
    const { data: allPermissions, error: permError } = await supabaseAdmin.from('permissions')
      .select('id, name')

    if (permError || !allPermissions) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch permissions'
      })
    }

    const permissionMap = new Map(allPermissions.map((p: any) => [p.name, p.id]))

    // Prepare updates/inserts
    const updates: Promise<any>[] = []

    for (const [permissionName, isGranted] of Object.entries(permissions)) {
      const permissionId = permissionMap.get(permissionName)
      if (!permissionId) {
        console.warn(`Permission not found: ${permissionName}`)
        continue
      }

      // Upsert permission for this role
      updates.push(
        Promise.resolve(
          supabaseAdmin.from('role_permissions')
            .upsert({
              company_id: companyId,
              role,
              permission_id: permissionId,
              is_granted: Boolean(isGranted),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'company_id,role,permission_id'
            })
        ).catch((err: any) => {
          console.error(`Error updating permission ${permissionName}:`, err)
          return { error: err }
        })
      )
    }

    await Promise.all(updates)

    return res.json({
      success: true,
      message: 'Role permissions updated successfully'
    })
  } catch (error) {
    console.error('Error in updateRolePermissions:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * @desc    Reset role permissions to defaults
 * @route   POST /api/v1/permissions/roles/:role/reset
 * @access  Private (Admin only)
 */
export const resetRolePermissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, role: userRole } = req.user!
    const { role } = req.params

    if (userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can reset role permissions'
      })
    }

    if (!['ADMIN', 'EMPLOYEE'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      })
    }

    // Delete all existing permissions for this role
    await supabaseAdmin.from('role_permissions')
      .delete()
      .eq('company_id', companyId)
      .eq('role', role)

    // Re-initialize permissions using the database function
    const { error: initError } = await supabaseAdmin.rpc('initialize_company_permissions', {
      company_uuid: companyId
    })

    if (initError) {
      console.error('Error resetting permissions:', initError)
      return res.status(500).json({
        success: false,
        error: 'Failed to reset permissions'
      })
    }

    return res.json({
      success: true,
      message: 'Role permissions reset to defaults'
    })
  } catch (error) {
    console.error('Error in resetRolePermissions:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

