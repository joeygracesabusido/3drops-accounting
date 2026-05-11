import prisma from '@/lib/prisma'
import type { User, Employee } from '@prisma/client'

/**
 * Core utility to ensure a User is linked to their Employee record based on email.
 * Handles case-insensitive lookups and performs the linking if necessary.
 *
 * @param userEmail - The email of the logged-in user
 * @returns The linked employee ID or null if no match is found
 */
export async function ensureEmployeeLink(userEmail: string): Promise<string | null> {
  // 1. Find the user record (case-insensitive)
  const user = await prisma.user.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
    include: { employees: true },
  })

  if (!user) {
    console.error(`[Linking] No user found for email: ${userEmail}`)
    return null
  }

  // 2. If already linked, return the first employee ID
  if (user.employees && user.employees.length > 0) {
    return user.employees[0].id
  }

  // 3. Try to find an employee with the same email (case-insensitive)
  const matchingEmployee = await prisma.employee.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
  })

  if (matchingEmployee) {
    // Link the user to the employee if not already linked
    if (!matchingEmployee.userId) {
      await prisma.employee.update({
        where: { id: matchingEmployee.id },
        data: { userId: user.id },
      })
      console.log(`Auto-linked user ${user.email} (${user.id}) to employee ${matchingEmployee.fullName} (${matchingEmployee.id})`)
    }
    return matchingEmployee.id
  }

  console.error(`[Linking] No matching employee record found for user email: ${userEmail}`)
  return null
}

/**
 * Get the employee ID for a logged-in user
 *
 * @param userEmail - The email of the logged-in user
 * @param userRole - The role of the logged-in user
 * @returns The employee ID or null if not found
 */
export async function getEmployeeIdForUser(
  userEmail: string,
  userRole: string
): Promise<string | null> {
  // Admins and managers can see all employees
  if (userRole === 'ADMIN' || userRole === 'HR' || userRole === 'MANAGER') {
    return null
  }

  return ensureEmployeeLink(userEmail)
}

/**
 * Get the user and their linked employee
 *
 * @param userEmail - The email of the logged-in user
 * @returns Object with user and employee, or null if not found
 */
export async function getUserWithEmployee(
  userEmail: string
): Promise<{ user: User & { employees: Employee[] }; employee: Employee | null } | null> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
    include: { employees: true },
  })

  if (!user) {
    return null
  }

  const employeeId = await ensureEmployeeLink(userEmail)

  let employee: Employee | null = null
  if (employeeId) {
    employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    })
  }

  return { user, employee }
}
