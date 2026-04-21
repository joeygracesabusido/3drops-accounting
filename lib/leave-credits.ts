import prisma from '@/lib/prisma'

const MONTHLY_ACCRUAL_DAYS = 1.25

export interface AccrualResult {
  success: boolean
  accrued: number
  employeeId: string
  error?: string
}

export async function calculateMonthlyAccrual(
  employeeId: string,
  year: number,
  month: number
): Promise<AccrualResult> {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        hireDate: true,
        regularizationDate: true,
        employeeStatus: true,
        isActive: true,
      },
    })

    if (!employee) {
      return { success: false, accrued: 0, employeeId, error: 'Employee not found' }
    }

    if (employee.employeeStatus !== 'REGULAR') {
      return { success: false, accrued: 0, employeeId, error: 'Employee is not regular' }
    }

    if (!employee.isActive) {
      return { success: false, accrued: 0, employeeId, error: 'Employee is inactive' }
    }

    const accrualStartDate = employee.regularizationDate || employee.hireDate
    
    const firstMonthStart = new Date(year, month - 1, 1)
    
    if (accrualStartDate > firstMonthStart) {
      return { 
        success: false, 
        accrued: 0, 
        employeeId, 
        error: 'Employee hired mid-month - no accrual until next month' 
      }
    }

    const existingTransaction = await prisma.leaveCreditTransaction.findFirst({
      where: {
        leaveCredit: { employeeId },
        type: 'MONTHLY_ACCRUAL',
        description: { contains: `${getMonthName(month)} ${year}` },
      },
    })

    if (existingTransaction) {
      return { success: false, accrued: 0, employeeId, error: 'Already accrued for this month' }
    }

    let leaveCredit = await prisma.leaveCredit.findUnique({
      where: {
        employeeId_leaveType_year: {
          employeeId,
          leaveType: 'VACATION',
          year,
        },
      },
    })

    if (!leaveCredit) {
      leaveCredit = await prisma.leaveCredit.create({
        data: {
          employeeId,
          leaveType: 'VACATION',
          year,
          totalDays: 0,
          usedDays: 0,
          availableDays: 0,
        },
      })
    }

    await prisma.$transaction(async (tx) => {
      // Re-check for duplicate within transaction to prevent race condition
      const startOfMonth = new Date(year, month - 1, 1)
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999)
      
      const existingInTx = await tx.leaveCreditTransaction.findFirst({
        where: {
          leaveCredit: { employeeId },
          type: 'MONTHLY_ACCRUAL',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      })

      if (existingInTx) {
        throw new Error('DUPLICATE_ACCRUAL')
      }

      // Lock and get current balance
      const currentCredit = await tx.leaveCredit.findUnique({
        where: { id: leaveCredit!.id },
      })

      if (!currentCredit) {
        throw new Error('CREDIT_NOT_FOUND')
      }

      const prevBalance = currentCredit.availableDays
      const newBalance = prevBalance + MONTHLY_ACCRUAL_DAYS

      await tx.leaveCreditTransaction.create({
        data: {
          leaveCreditId: leaveCredit!.id,
          type: 'MONTHLY_ACCRUAL',
          days: MONTHLY_ACCRUAL_DAYS,
          balanceBefore: prevBalance,
          balanceAfter: newBalance,
          description: `Monthly accrual for ${getMonthName(month)} ${year}`,
        },
      })

      const updated = await tx.leaveCredit.update({
        where: { id: leaveCredit!.id },
        data: {
          totalDays: { increment: MONTHLY_ACCRUAL_DAYS },
          availableDays: { increment: MONTHLY_ACCRUAL_DAYS },
        },
      })

      return updated
    })

    return { success: true, accrued: MONTHLY_ACCRUAL_DAYS, employeeId }
  } catch (error) {
    console.error('Error calculating monthly accrual:', error)
    return { success: false, accrued: 0, employeeId, error: 'Internal error' }
  }
}

export async function getLeaveBalance(
  employeeId: string,
  year: number = new Date().getFullYear()
): Promise<{ vacation: number; sick: number }> {
  const credits = await prisma.leaveCredit.findMany({
    where: { employeeId, year },
  })

  const vacation = credits.find((c: { leaveType: string; availableDays: number }) => c.leaveType === 'VACATION')?.availableDays || 0
  const sick = credits.find((c: { leaveType: string; availableDays: number }) => c.leaveType === 'SICK')?.availableDays || 0

  return { vacation, sick }
}

export async function deductLeave(
  employeeId: string,
  leaveType: string,
  days: number,
  leaveRequestId: string,
  year: number = new Date().getFullYear()
): Promise<boolean> {
  try {
    const leaveCredit = await prisma.leaveCredit.findUnique({
      where: {
        employeeId_leaveType_year: { employeeId, leaveType, year },
      },
    })

    if (!leaveCredit || leaveCredit.availableDays < days) {
      return false
    }

    await prisma.$transaction(async (tx) => {
      await tx.leaveCreditTransaction.create({
        data: {
          leaveCreditId: leaveCredit.id,
          type: 'USED',
          days: -days,
          balanceBefore: leaveCredit.availableDays,
          balanceAfter: leaveCredit.availableDays - days,
          description: `Leave used - Request ID: ${leaveRequestId}`,
          referenceId: leaveRequestId,
        },
      })

      await tx.leaveCredit.update({
        where: { id: leaveCredit.id },
        data: {
          usedDays: { increment: days },
          availableDays: { decrement: days },
        },
      })
    })

    return true
  } catch (error) {
    console.error('Error deducting leave:', error)
    return false
  }
}

function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[month - 1]
}
