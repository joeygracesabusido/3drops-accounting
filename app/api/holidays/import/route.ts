import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { PH_OFFICIAL_HOLIDAYS } from '@/lib/holidays'
import { z } from 'zod'

const importSchema = z.object({
  year: z.number().optional(),
  overwrite: z.boolean().optional(),
})

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
    const result = importSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { year, overwrite = false } = result.data

    const yearsToImport = year ? [year] : Object.keys(PH_OFFICIAL_HOLIDAYS).map(Number)
    let importedCount = 0
    let skippedCount = 0

    for (const yearNum of yearsToImport) {
      const holidays = PH_OFFICIAL_HOLIDAYS[yearNum]

      if (!holidays) continue

      for (const holidayData of holidays) {
        const dateObj = new Date(holidayData.date)

        const holidayType = holidayData.type as 'REGULAR' | 'SPECIAL' | 'SPECIAL_NON_WORK'

        if (overwrite) {
          await prisma.holiday.upsert({
            where: {
              date_branchId: {
                date: dateObj,
                // @ts-expect-error - Prisma type mismatch with optional compound unique key
                branchId: null,
              },
            },
            update: {
              name: holidayData.name,
              type: holidayType,
              year: yearNum,
            },
            create: {
              name: holidayData.name,
              date: dateObj,
              year: yearNum,
              type: holidayType,
              branchId: null,
              isActive: true,
            },
          })
          importedCount++
        } else {
          const existing = await prisma.holiday.findUnique({
            where: {
              date_branchId: {
                date: dateObj,
                // @ts-expect-error - Prisma type mismatch with optional compound unique key
                branchId: null,
              },
            },
          })

          if (!existing) {
            await prisma.holiday.create({
              data: {
                name: holidayData.name,
                date: dateObj,
                year: yearNum,
                type: holidayType,
                branchId: null,
                isActive: true,
              },
            })
            importedCount++
          } else {
            skippedCount++
          }
        }
      }
    }

    return NextResponse.json({
      message: `Imported ${importedCount} holidays, skipped ${skippedCount} existing`,
      imported: importedCount,
      skipped: skippedCount,
    })
  } catch (error) {
    console.error('Error importing holidays:', error)
    return NextResponse.json(
      { error: 'Failed to import holidays' },
      { status: 500 }
    )
  }
}
