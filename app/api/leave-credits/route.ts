import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { hasAdminAccess } from '@/lib/auth-helpers'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const userEmail = cookieStore.get('userEmail')?.value

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { employees: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const year = searchParams.get('year') || String(new Date().getFullYear())

    if (hasAdminAccess(user.role)) {
      const targetId = employeeId || user.employees?.[0]?.id
      
      const credits = await prisma.leaveCredit.findMany({
        where: { employeeId: targetId, year: parseInt(year) },
        include: { transactions: { orderBy: { createdAt: 'desc' } } },
      })
      
      return NextResponse.json(credits)
    } else {
      if (!user.employees || user.employees.length === 0) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
      }

      const credits = await prisma.leaveCredit.findMany({
        where: { 
          employeeId: user.employees[0].id, 
          year: parseInt(year) 
        },
        include: { transactions: { orderBy: { createdAt: 'desc' } } },
      })
      
      return NextResponse.json(credits)
    }
  } catch (error) {
    console.error('Error fetching leave credits:', error)
    return NextResponse.json({ error: 'Failed to fetch leave credits' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const userEmail = cookieStore.get('userEmail')?.value

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    })

    if (!hasAdminAccess(user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json()
    const { employeeId, leaveType, days, description } = body

    const year = new Date().getFullYear()
    let leaveCredit = await prisma.leaveCredit.findUnique({
      where: {
        employeeId_leaveType_year: { employeeId, leaveType, year },
      },
    })

    if (!leaveCredit) {
      leaveCredit = await prisma.leaveCredit.create({
        data: { employeeId, leaveType, year, totalDays: 0, usedDays: 0, availableDays: 0 },
      })
    }

    const isAddition = days > 0
    const newBalance = isAddition 
      ? leaveCredit.availableDays + Math.abs(days)
      : Math.max(0, leaveCredit.availableDays - Math.abs(days))

    const transaction = await prisma.$transaction(async (tx) => {
      await tx.leaveCreditTransaction.create({
        data: {
          leaveCreditId: leaveCredit!.id,
          type: 'ADJUSTMENT',
          days,
          balanceBefore: leaveCredit!.availableDays,
          balanceAfter: newBalance,
          description: description || `Manual adjustment: ${days > 0 ? '+' : ''}${days} days`,
        },
      })

      return tx.leaveCredit.update({
        where: { id: leaveCredit!.id },
        data: {
          totalDays: isAddition ? { increment: Math.abs(days) } : leaveCredit.totalDays,
          availableDays: newBalance,
        },
      })
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Error adjusting leave credits:', error)
    return NextResponse.json({ error: 'Failed to adjust leave credits' }, { status: 500 })
  }
}
