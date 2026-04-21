import prisma from '@/lib/prisma'
import type { Role } from '@prisma/client'

/**
 * Roles that have full data access (not filtered to personal data)
 */
export const ADMIN_ROLES: Role[] = ['ADMIN', 'HR', 'MANAGER']

/**
 * Check if user has admin-level access
 * @param userRole - The role of the logged-in user
 * @returns true if user can access all data, false if restricted to personal data
 */
export function hasAdminAccess(userRole: string): boolean {
  return ADMIN_ROLES.includes(userRole as Role)
}

/**
 * Get the employee ID for a user's personal data filtering
 * Returns null if user has admin access (no filtering needed)
 * @param userEmail - The email of the logged-in user
 * @param userRole - The role of the logged-in user
 * @returns The employee ID for filtering, or null if no filtering needed
 */
export async function getEmployeeIdForFiltering(
  userEmail: string,
  userRole: string
): Promise<string | null> {
  // Admin roles don't need filtering
  if (hasAdminAccess(userRole)) {
    return null
  }

  // Find user and their linked employee
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { employees: true },
  })

  if (!user) {
    return null
  }

  // Return linked employee ID if exists
  if (user.employees && user.employees.length > 0) {
    return user.employees[0].id
  }

  // Auto-link by email match if no explicit link exists
  const matchingEmployee = await prisma.employee.findFirst({
    where: { email: userEmail },
  })

  if (matchingEmployee && !matchingEmployee.userId) {
    await prisma.employee.update({
      where: { id: matchingEmployee.id },
      data: { userId: user.id },
    })
    console.log(`Auto-linked user ${userEmail} to employee ${matchingEmployee.fullName}`)
    return matchingEmployee.id
  }

  return null
}

/**
 * Build a Prisma where clause for filtering data by user role
 * @param userEmail - The email of the logged-in user
 * @param userRole - The role of the logged-in user
 * @param employeeIdParam - Optional employee ID from query params (for admin filtering)
 * @returns Where clause object for Prisma queries
 */
export async function buildRoleBasedWhereClause(
  userEmail: string,
  userRole: string,
  employeeIdParam?: string
): Promise<Record<string, unknown>> {
  const where: Record<string, unknown> = {}

  // Admin roles can filter by specific employee or see all
  if (hasAdminAccess(userRole)) {
    if (employeeIdParam) {
      where.employeeId = employeeIdParam
    }
    // No employeeId means return all data
    return where
  }

  // Non-admin users only see their own data
  const linkedEmployeeId = await getEmployeeIdForFiltering(userEmail, userRole)
  
  if (linkedEmployeeId) {
    where.employeeId = linkedEmployeeId
  } else {
    // EMPLOYEE role with no linked employee sees nothing
    // Use a valid MongoDB ObjectID that doesn't exist
    where.employeeId = '000000000000000000000000'
  }

  return where
}
