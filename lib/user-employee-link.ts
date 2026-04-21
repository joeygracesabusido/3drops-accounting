import prisma from '@/lib/prisma'
import type { User, Employee } from '@prisma/client'

/**
 * Get the employee ID for a logged-in user
 * Auto-links user to employee if email matches and no link exists
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
    return null;
  }

  // EMPLOYEE role can only see their own data
  if (userRole === 'EMPLOYEE') {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { employees: true },
    });

    if (user && user.employees && user.employees.length > 0) {
      return user.employees[0].id;
    }

    const matchingEmployee = await prisma.employee.findFirst({
      where: { email: userEmail },
    });

    if (matchingEmployee && !matchingEmployee.userId && user) {
      await prisma.employee.update({
        where: { id: matchingEmployee.id },
        data: { userId: user.id },
      });
      console.log(`Auto-linked user ${userEmail} to employee ${matchingEmployee.fullName}`);
      return matchingEmployee.id;
    }

    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { employees: true },
  });

  // If user already has linked employees, return the first one
  if (user && user.employees && user.employees.length > 0) {
    return user.employees[0].id;
  }

  // Try to find matching employee by email and auto-link
  const matchingEmployee = await prisma.employee.findFirst({
    where: { email: userEmail },
  });

  if (matchingEmployee && !matchingEmployee.userId && user) {
    // Link the user to the employee
    await prisma.employee.update({
      where: { id: matchingEmployee.id },
      data: { userId: user.id },
    });
    console.log(`Auto-linked user ${userEmail} to employee ${matchingEmployee.fullName}`);
    return matchingEmployee.id;
  }

  return null;
}

/**
 * Get the user and their linked employee
 * Auto-links user to employee if email matches and no link exists
 * 
 * @param userEmail - The email of the logged-in user
 * @returns Object with user and employee, or null if not found
 */
export async function getUserWithEmployee(
  userEmail: string
): Promise<{ user: User & { employees: Employee[] }; employee: Employee | null } | null> {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { employees: true },
  });

  if (!user) {
    return null;
  }

  // If user already has linked employees, return them
  if (user.employees && user.employees.length > 0) {
    return { user, employee: user.employees[0] };
  }

  // Try to find matching employee by email and auto-link
  const matchingEmployee = await prisma.employee.findFirst({
    where: { email: userEmail },
  });

  if (matchingEmployee && !matchingEmployee.userId) {
    // Link the user to the employee
    await prisma.employee.update({
      where: { id: matchingEmployee.id },
      data: { userId: user.id },
    });
    console.log(`Auto-linked user ${userEmail} to employee ${matchingEmployee.fullName}`);
    return { user, employee: matchingEmployee };
  }

  return { user, employee: null };
}
