import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { z } from 'zod'
import type { HolidayType } from '@prisma/client'

const createHolidaySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date format'),
  type: z.enum(['REGULAR', 'SPECIAL', 'SPECIAL_NON_WORK']),
  branchId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

const updateHolidaySchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  type: z.enum(['REGULAR', 'SPECIAL', 'SPECIAL_NON_WORK']).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const type = searchParams.get('type')
    const branchId = searchParams.get('branchId')
    const isActive = searchParams.get('isActive')

    const where: {
      year?: number
      type?: HolidayType
      branchId?: string | null
      isActive?: boolean
    } = {}

    if (year) {
      where.year = parseInt(year)
    }

    if (type) {
      where.type = type as HolidayType
    }

    if (branchId === 'null') {
      where.branchId = null
    } else if (branchId) {
      where.branchId = branchId
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
    })

    return NextResponse.json(holidays)
  } catch (error) {
    console.error('Error fetching holidays:', error)
    return NextResponse.json(
      { error: 'Failed to fetch holidays' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('userRole')?.value

    if (!userRole || !['ADMIN', 'HR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin or HR access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const result = createHolidaySchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, date, type, branchId, isActive = true } = result.data
    const dateObj = new Date(date)
    const year = dateObj.getFullYear()

    const holiday = await prisma.holiday.create({
      data: {
        name,
        date: dateObj,
        year,
        type,
        branchId: branchId || null,
        isActive,
      },
    })

    return NextResponse.json(holiday, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating holiday:', error)
    const err = error as { code?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Holiday already exists for this date' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create holiday' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('userRole')?.value

    if (!userRole || !['ADMIN', 'HR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin or HR access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const result = updateHolidaySchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { id, name, type, isActive } = result.data
    const updateData: {
      name?: string
      type?: HolidayType
      isActive?: boolean
    } = {}

    if (name !== undefined) updateData.name = name
    if (type !== undefined) updateData.type = type as HolidayType
    if (isActive !== undefined) updateData.isActive = isActive

    const holiday = await prisma.holiday.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(holiday)
  } catch (error) {
    console.error('Error updating holiday:', error)
    return NextResponse.json(
      { error: 'Failed to update holiday' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('userRole')?.value

    if (!userRole || !['ADMIN', 'HR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin or HR access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Holiday ID is required' },
        { status: 400 }
      )
    }

    await prisma.holiday.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Holiday deleted successfully' })
  } catch (error) {
    console.error('Error deleting holiday:', error)
    return NextResponse.json(
      { error: 'Failed to delete holiday' },
      { status: 500 }
    )
  }
}
