import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { getLeaveBalance } from '@/lib/leave-credits'

export const dynamic = 'force-dynamic';

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

    if (!user || !user.employees?.[0]) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId') || user.employees[0].id
    const year = searchParams.get('year') || String(new Date().getFullYear())

    if (user.role !== 'ADMIN' && employeeId !== user.employees[0].id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const balance = await getLeaveBalance(employeeId, parseInt(year))

    return NextResponse.json({
      employeeId,
      year: parseInt(year),
      vacation: balance.vacation,
      sick: balance.sick,
    })
  } catch (error) {
    console.error('Error fetching balance:', error)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 })
  }
}
