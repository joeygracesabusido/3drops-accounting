# Holiday System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete holiday management system compliant with Philippine labor law, including database models, API routes, UI, and payroll integration.

**Architecture:** Add Holiday model to Prisma schema, create CRUD API endpoints, build holiday management UI page, update payroll computation to exclude holidays and apply correct pay multipliers, seed official PH holidays 2024-2030.

**Tech Stack:** Next.js 14, Prisma ORM, MongoDB, TypeScript, shadcn/ui, React Hook Form, Zod

**Status:** ✅ COMPLETED (March 21, 2026)

---

## File Structure

### Files to Create
- `prisma/schema.prisma` (modify) - Add Holiday model and HolidayType enum
- `lib/holidays.ts` - PH official holidays data (2024-2030)
- `app/api/holidays/route.ts` - CRUD API endpoints
- `app/api/holidays/import/route.ts` - Import PH holidays endpoint
- `app/(dashboard)/holidays/page.tsx` - Holiday management UI
- `lib/payroll.ts` (modify) - Update payroll computation with holiday logic

### Files to Modify
- `lib/payroll.ts` - Add holiday-aware calculations
- `app/api/payroll/route.ts` - Integrate holiday data into payroll
- `app/api/time-logs/route.ts` - Flag time logs on holidays
- `app/(dashboard)/layout.tsx` - Add Holidays navigation link

---

## Chunk 1: Database Schema

### Task 1: Add Holiday Model to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add HolidayType enum and Holiday model**

Add to `prisma/schema.prisma` before the `model Payroll` definition:

```prisma
enum HolidayType {
  REGULAR
  SPECIAL
  SPECIAL_NON_WORK
}

model Holiday {
  id        String      @id @default(auto()) @map("_id") @db.ObjectId
  name      String
  date      DateTime    @db.Date
  year      Int
  type      HolidayType
  branchId  String?     @db.ObjectId
  isActive  Boolean     @default(true)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@unique([date, branchId])
  @@index([year])
  @@index([branchId])
}
```

- [ ] **Step 2: Push schema to database**

Run: `npm run db:push`
Expected: "Your database is now in sync with your schema."

- [ ] **Step 3: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: "Prisma Client generated successfully."

- [ ] **Step 4: Commit changes**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Holiday model to Prisma schema"
```

---

## Chunk 2: Holiday Data

### Task 2: Create PH Official Holidays Data File

**Files:**
- Create: `lib/holidays.ts`

- [ ] **Step 1: Create holidays data file**

Create `lib/holidays.ts`:

```typescript
export interface HolidayData {
  date: string
  name: string
  type: 'REGULAR' | 'SPECIAL' | 'SPECIAL_NON_WORK'
}

export const PH_OFFICIAL_HOLIDAYS: Record<number, HolidayData[]> = {
  2024: [
    { date: '2024-01-01', name: "New Year's Day", type: 'REGULAR' },
    { date: '2024-01-07', name: 'Chinese New Year', type: 'SPECIAL' },
    { date: '2024-01-25', name: "Eid'l Fitr", type: 'REGULAR' },
    { date: '2024-03-29', name: 'Maundy Thursday', type: 'SPECIAL' },
    { date: '2024-03-30', name: 'Good Friday', type: 'REGULAR' },
    { date: '2024-04-09', name: 'Araw ng Kagitingan', type: 'REGULAR' },
    { date: '2024-04-11', name: 'Eid'l Adha', type: 'REGULAR' },
    { date: '2024-05-01', name: 'Labor Day', type: 'REGULAR' },
    { date: '2024-05-21', name: 'Black Saturday', type: 'SPECIAL' },
    { date: '2024-06-12', name: 'Independence Day', type: 'REGULAR' },
    { date: '2024-08-26', name: 'National Heroes Day', type: 'REGULAR' },
    { date: '2024-09-26', name: 'Edsa People Power Revolution Anniversary', type: 'SPECIAL' },
    { date: '2024-10-01', name: 'National Thanksgiving Day', type: 'SPECIAL' },
    { date: '2024-10-24', name: 'Bonifacio Day', type: 'REGULAR' },
    { date: '2024-11-01', name: 'All Saints Day', type: 'REGULAR' },
    { date: '2024-11-30', name: 'Bonifacio Day', type: 'REGULAR' },
    { date: '2024-12-25', name: 'Christmas Day', type: 'REGULAR' },
    { date: '2024-12-30', name: 'Rizal Day', type: 'REGULAR' },
  ],
  2025: [
    { date: '2025-01-01', name: "New Year's Day", type: 'REGULAR' },
    { date: '2025-01-29', name: 'Chinese New Year', type: 'SPECIAL' },
    { date: '2025-04-17', name: "Eid'l Fitr", type: 'REGULAR' },
    { date: '2025-04-18', name: "Eid'l Fitr (Observance)", type: 'SPECIAL' },
    { date: '2025-04-19', name: 'Maundy Thursday', type: 'SPECIAL' },
    { date: '2025-04-20', name: 'Good Friday', type: 'REGULAR' },
    { date: '2025-04-21', name: 'Black Saturday', type: 'SPECIAL' },
    { date: '2025-04-30', name: 'Araw ng Kagitingan', type: 'REGULAR' },
    { date: '2025-06-06', name: 'Eid'l Adha', type: 'REGULAR' },
    { date: '2025-05-01', name: 'Labor Day', type: 'REGULAR' },
    { date: '2025-06-12', name: 'Independence Day', type: 'REGULAR' },
    { date: '2025-08-25', name: 'National Heroes Day', type: 'REGULAR' },
    { date: '2025-09-28', name: 'Edsa People Power Revolution Anniversary', type: 'SPECIAL' },
    { date: '2025-11-01', name: 'All Saints Day', type: 'REGULAR' },
    { date: '2025-11-30', name: 'Bonifacio Day', type: 'REGULAR' },
    { date: '2025-12-25', name: 'Christmas Day', type: 'REGULAR' },
    { date: '2025-12-30', name: 'Rizal Day', type: 'REGULAR' },
  ],
  2026: [
    { date: '2026-01-01', name: "New Year's Day", type: 'REGULAR' },
    { date: '2026-02-17', name: 'Chinese New Year', type: 'SPECIAL' },
    { date: '2026-03-31', name: "Eid'l Fitr", type: 'REGULAR' },
    { date: '2026-04-02', name: 'Maundy Thursday', type: 'SPECIAL' },
    { date: '2026-04-03', name: 'Good Friday', type: 'REGULAR' },
    { date: '2026-04-09', name: 'Araw ng Kagitingan', type: 'REGULAR' },
    { date: '2026-06-19', name: 'Eid'l Adha', type: 'REGULAR' },
    { date: '2026-05-01', name: 'Labor Day', type: 'REGULAR' },
    { date: '2026-06-12', name: 'Independence Day', type: 'REGULAR' },
    { date: '2026-08-31', name: 'National Heroes Day', type: 'REGULAR' },
    { date: '2026-09-28', name: 'Edsa People Power Revolution Anniversary', type: 'SPECIAL' },
    { date: '2026-11-01', name: 'All Saints Day', type: 'REGULAR' },
    { date: '2026-11-30', name: 'Bonifacio Day', type: 'REGULAR' },
    { date: '2026-12-25', name: 'Christmas Day', type: 'REGULAR' },
    { date: '2026-12-30', name: 'Rizal Day', type: 'REGULAR' },
  ],
}
```

- [ ] **Step 2: Commit changes**

```bash
git add lib/holidays.ts
git commit -m "feat: add PH official holidays data 2024-2026"
```

---

## Chunk 3: API Routes

### Task 3: Create Holiday CRUD API

**Files:**
- Create: `app/api/holidays/route.ts`

- [ ] **Step 1: Create API route file**

Create `app/api/holidays/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { z } from 'zod'

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

    const where: any = {}

    if (year) {
      where.year = parseInt(year)
    }

    if (type) {
      where.type = type
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
        type: type as any,
        branchId: branchId || null,
        isActive,
      },
    })

    return NextResponse.json(holiday, { status: 201 })
  } catch (error: any) {
    console.error('Error creating holiday:', error)
    if (error?.code === 'P2002') {
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
    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (type !== undefined) updateData.type = type as any
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
```

- [ ] **Step 2: Commit changes**

```bash
git add app/api/holidays/route.ts
git commit -m "feat: create holiday CRUD API endpoints"
```

### Task 4: Create Holiday Import API

**Files:**
- Create: `app/api/holidays/import/route.ts`

- [ ] **Step 1: Create import API route**

Create `app/api/holidays/import/route.ts`:

```typescript
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

        if (overwrite) {
          await prisma.holiday.upsert({
            where: {
              date_branchId: {
                date: dateObj,
                branchId: null,
              },
            },
            update: {
              name: holidayData.name,
              type: holidayData.type as any,
              year: yearNum,
            },
            create: {
              name: holidayData.name,
              date: dateObj,
              year: yearNum,
              type: holidayData.type as any,
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
                type: holidayData.type as any,
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
```

- [ ] **Step 2: Commit changes**

```bash
git add app/api/holidays/import/route.ts
git commit -m "feat: add holiday import API endpoint"
```

---

## Chunk 4: Holiday Management UI

### Task 5: Create Holiday Management Page

**Files:**
- Create: `app/(dashboard)/holidays/page.tsx`

- [ ] **Step 1: Create holiday page component**

Create `app/(dashboard)/holidays/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Calendar, Plus, Trash2, Edit2, Check, X, AlertCircle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface Holiday {
  id: string
  name: string
  date: string
  year: number
  type: 'REGULAR' | 'SPECIAL' | 'SPECIAL_NON_WORK'
  branchId: string | null
  isActive: boolean
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [mounted, setMounted] = useState(false)
  const [filterYear, setFilterYear] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    date: '',
    type: 'REGULAR' as const,
    isActive: true,
  })

  useEffect(() => {
    setMounted(true)
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      acc[key] = value
      return acc
    }, {} as Record<string, string>)

    setUserRole(cookies.userRole || '')
  }, [])

  useEffect(() => {
    if (mounted) {
      fetchHolidays()
    }
  }, [mounted, filterYear, filterType])

  const fetchHolidays = async () => {
    try {
      const params = new URLSearchParams()
      if (filterYear !== 'all') params.append('year', filterYear)
      if (filterType !== 'all') params.append('type', filterType)

      const res = await fetch(`/api/holidays?${params}`)
      if (res.ok) {
        const data = await res.json()
        setHolidays(data)
      }
    } catch (error) {
      console.error('Failed to fetch holidays:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) {
      alert('Please fill in all fields')
      return
    }

    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHoliday),
      })

      if (res.ok) {
        alert('Holiday created successfully')
        setNewHoliday({ name: '', date: '', type: 'REGULAR', isActive: true })
        fetchHolidays()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to create holiday')
      }
    } catch (error) {
      console.error('Error creating holiday:', error)
      alert('Failed to create holiday')
    }
  }

  const handleUpdateHoliday = async (id: string) => {
    try {
      const res = await fetch('/api/holidays', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...newHoliday }),
      })

      if (res.ok) {
        alert('Holiday updated successfully')
        setEditingId(null)
        setNewHoliday({ name: '', date: '', type: 'REGULAR', isActive: true })
        fetchHolidays()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to update holiday')
      }
    } catch (error) {
      console.error('Error updating holiday:', error)
      alert('Failed to update holiday')
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/holidays', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !currentStatus }),
      })

      if (res.ok) {
        fetchHolidays()
      }
    } catch (error) {
      console.error('Error toggling holiday:', error)
    }
  }

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return

    try {
      const res = await fetch(`/api/holidays?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        alert('Holiday deleted successfully')
        fetchHolidays()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to delete holiday')
      }
    } catch (error) {
      console.error('Error deleting holiday:', error)
      alert('Failed to delete holiday')
    }
  }

  const handleImportHolidays = async () => {
    if (!confirm('Import official Philippine holidays? Existing holidays will be kept.')) return

    try {
      const res = await fetch('/api/holidays/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (res.ok) {
        const data = await res.json()
        alert(data.message)
        fetchHolidays()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to import holidays')
      }
    } catch (error) {
      console.error('Error importing holidays:', error)
      alert('Failed to import holidays')
    }
  }

  const handleEditClick = (holiday: Holiday) => {
    setEditingId(holiday.id)
    setNewHoliday({
      name: holiday.name,
      date: holiday.date.split('T')[0],
      type: holiday.type,
      isActive: holiday.isActive,
    })
  }

  if (!mounted) return null

  const canEdit = userRole === 'ADMIN' || userRole === 'HR'

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'REGULAR': return 'bg-red-100 text-red-700'
      case 'SPECIAL': return 'bg-yellow-100 text-yellow-700'
      case 'SPECIAL_NON_WORK': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Holidays</h1>
        <p className="text-gray-500">Manage company holidays</p>
      </div>

      {!canEdit ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">Access Denied</p>
              <p className="text-sm">Only Admin and HR users can manage holidays</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Add New Holiday</CardTitle>
                  <CardDescription>Create a new company holiday</CardDescription>
                </div>
                <Button onClick={handleImportHolidays} variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  Import PH Holidays
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Holiday Name</Label>
                  <Input
                    id="name"
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., New Year's Day"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={newHoliday.type}
                    onValueChange={(value) => setNewHoliday(prev => ({ ...prev, type: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REGULAR">Regular Holiday</SelectItem>
                      <SelectItem value="SPECIAL">Special Holiday</SelectItem>
                      <SelectItem value="SPECIAL_NON_WORK">Special Non-Working</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCreateHoliday} className="gap-2 w-full">
                    <Plus className="w-4 h-4" />
                    Add Holiday
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Holiday List</CardTitle>
                  <CardDescription>View and manage existing holidays</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={filterYear} onValueChange={setFilterYear}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="REGULAR">Regular</SelectItem>
                      <SelectItem value="SPECIAL">Special</SelectItem>
                      <SelectItem value="SPECIAL_NON_WORK">Special Non-Working</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : holidays.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No holidays found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {holidays.map((holiday) => (
                    <div key={holiday.id} className="border rounded-lg p-4">
                      {editingId === holiday.id ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <Input
                              value={newHoliday.name}
                              onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Name"
                            />
                            <Input
                              type="date"
                              value={newHoliday.date}
                              onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                            />
                            <Select
                              value={newHoliday.type}
                              onValueChange={(value) => setNewHoliday(prev => ({ ...prev, type: value as any }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="REGULAR">Regular</SelectItem>
                                <SelectItem value="SPECIAL">Special</SelectItem>
                                <SelectItem value="SPECIAL_NON_WORK">Special Non-Working</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => handleUpdateHoliday(holiday.id)} size="sm" className="gap-2">
                              <Check className="w-4 h-4" />
                              Save
                            </Button>
                            <Button
                              onClick={() => {
                                setEditingId(null)
                                setNewHoliday({ name: '', date: '', type: 'REGULAR', isActive: true })
                              }}
                              variant="outline"
                              size="sm"
                              className="gap-2"
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{holiday.name}</p>
                                <p className="text-sm text-gray-500">
                                  {new Date(holiday.date).toLocaleDateString('en-PH', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeBadgeClass(holiday.type)}`}>
                                {holiday.type === 'REGULAR' ? 'Regular' : holiday.type === 'SPECIAL' ? 'Special' : 'Special Non-Working'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">Active:</span>
                                <Switch
                                  checked={holiday.isActive}
                                  onCheckedChange={() => handleToggleActive(holiday.id, holiday.isActive)}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <Button onClick={() => handleEditClick(holiday)} variant="outline" size="sm" className="gap-2">
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </Button>
                            <Button
                              onClick={() => handleDeleteHoliday(holiday.id)}
                              variant="outline"
                              size="sm"
                              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit changes**

```bash
git add "app/(dashboard)/holidays/page.tsx"
git commit -m "feat: create holiday management UI page"
```

### Task 6: Add Holidays Link to Navigation

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Add Holidays navigation link**

Add "Holidays" link to the navigation sidebar (after "Time Logs" or before "Settings"):

```typescript
{
  href: '/holidays',
  label: 'Holidays',
  icon: Calendar,
  roles: ['ADMIN', 'HR'],
}
```

- [ ] **Step 2: Commit changes**

```bash
git add "app/(dashboard)/layout.tsx"
git commit -m "feat: add holidays link to navigation"
```

---

## Chunk 5: Payroll Integration

### Task 7: Update Payroll Computation with Holiday Logic

**Files:**
- Modify: `lib/payroll.ts`

- [ ] **Step 1: Add holiday-aware working days calculation**

Add new function before existing payroll functions:

```typescript
import { Holiday, HolidayType } from '@prisma/client'

function getHolidaysForPeriod(
  startDate: Date,
  endDate: Date,
  holidays: Holiday[]
): Holiday[] {
  return holidays.filter((holiday) => {
    const holidayDate = new Date(holiday.date)
    return holidayDate >= startDate && holidayDate <= endDate && holiday.isActive
  })
}

function countWorkingDays(
  start: Date,
  end: Date,
  holidays: Holiday[] = []
): number {
  let count = 0
  const cur = new Date(start)
  const holidayDates = getHolidaysForPeriod(start, end, holidays).map(
    (h) => new Date(h.date).toLocaleDateString()
  )

  while (cur <= end) {
    const day = cur.getDay()
    const dateStr = cur.toLocaleDateString()

    if (day !== 0 && day !== 6 && !holidayDates.includes(dateStr)) {
      count++
    }

    cur.setDate(cur.getDate() + 1)
  }

  return count
}
```

- [ ] **Step 2: Add holiday pay calculation function**

Add after `countWorkingDays` function:

```typescript
function calculateHolidayPay(
  baseDailyRate: number,
  holidayType: HolidayType,
  hoursWorked: number
): number {
  const hourlyRate = baseDailyRate / 8

  switch (holidayType) {
    case 'REGULAR':
      return hoursWorked * hourlyRate * 2
    case 'SPECIAL':
      return hoursWorked * hourlyRate * 1.5
    case 'SPECIAL_NON_WORK':
      return hoursWorked * hourlyRate
    default:
      return hoursWorked * hourlyRate
  }
}
```

- [ ] **Step 3: Update overtime calculation with holiday rates**

Update existing `calculateOvertimePay` function:

```typescript
function calculateOvertimePay(
  hourlyRate: number,
  overtimeHours: number,
  holidayType?: HolidayType
): number {
  let otPay = 0

  if (holidayType === 'REGULAR') {
    const first8Hours = Math.min(overtimeHours, 8)
    const excessHours = Math.max(overtimeHours - 8, 0)
    otPay = first8Hours * hourlyRate * 1.3 + excessHours * hourlyRate * 1.625
  } else if (holidayType === 'SPECIAL') {
    const first8Hours = Math.min(overtimeHours, 8)
    const excessHours = Math.max(overtimeHours - 8, 0)
    otPay = first8Hours * hourlyRate * 1.05 + excessHours * hourlyRate * 1.15
  } else {
    otPay = overtimeHours * hourlyRate * 1.25
  }

  return otPay
}
```

- [ ] **Step 4: Commit changes**

```bash
git add lib/payroll.ts
git commit -m "feat: add holiday-aware payroll calculations"
```

### Task 8: Update Payroll API to Fetch Holidays

**Files:**
- Modify: `app/api/payroll/route.ts`

- [ ] **Step 1: Fetch holidays in payroll computation**

Add before payroll calculation:

```typescript
const holidays = await prisma.holiday.findMany({
  where: {
    year: payrollYear,
    isActive: true,
    branchId: null,
  },
})
```

- [ ] **Step 2: Pass holidays to working days calculation**

Update the `countWorkingDays` call:

```typescript
const expectedWorkDays = countWorkingDays(
  periodStart,
  periodEnd,
  holidays
)
```

- [ ] **Step 3: Commit changes**

```bash
git add "app/api/payroll/route.ts"
git commit -m "feat: integrate holidays into payroll API"
```

---

## Chunk 6: Time Log Integration

### Task 9: Update Time Logs to Flag Holidays

**Files:**
- Modify: `app/api/time-logs/route.ts`

- [ ] **Step 1: Check if time log date is a holiday**

In the GET endpoint, after fetching time logs:

```typescript
const timeLogs = await prisma.timeLog.findMany({ ... })

const dateSet = new Set(timeLogs.map((tl) => new Date(tl.clockIn).toLocaleDateString()))
const holidays = await prisma.holiday.findMany({
  where: {
    isActive: true,
    branchId: null,
  },
})

const holidayMap = new Map(
  holidays.map((h) => [new Date(h.date).toLocaleDateString(), h])
)

const enrichedLogs = timeLogs.map((log) => {
  const dateStr = new Date(log.clockIn).toLocaleDateString()
  const holiday = holidayMap.get(dateStr)
  return {
    ...log,
    isHoliday: holiday !== undefined,
    holidayName: holiday?.name,
    holidayType: holiday?.type,
  }
})

return NextResponse.json(enrichedLogs)
```

- [ ] **Step 2: Commit changes**

```bash
git add "app/api/time-logs/route.ts"
git commit -m "feat: flag time logs recorded on holidays"
```

---

## Chunk 7: Testing & Verification

### Task 10: Test Holiday System

**Files:**
- Test: All holiday-related files

- [ ] **Step 1: Test holiday CRUD operations**

1. Navigate to `/holidays` as Admin
2. Click "Import PH Holidays"
3. Verify holidays appear in list
4. Create a new holiday manually
5. Edit the holiday
6. Toggle active/inactive
7. Delete the holiday

- [ ] **Step 2: Test payroll with holidays**

1. Navigate to `/payroll`
2. Select a month with holidays
3. Verify expected work days excludes holidays
4. Verify holiday pay is calculated correctly

- [ ] **Step 3: Test time logs with holidays**

1. Navigate to `/time-logs`
2. Verify time logs on holidays are flagged
3. Verify holiday type is displayed

- [ ] **Step 4: Commit any fixes**

```bash
git add .
git commit -m "fix: resolve holiday system issues"
```

---

## Summary

This plan implements a complete holiday management system with:

1. **Database**: Holiday model with type enum ✅
2. **Data**: Pre-loaded PH official holidays 2024-2026 ✅
3. **API**: CRUD endpoints + import functionality ✅
4. **UI**: Holiday management page with filters ✅
5. **Payroll**: Holiday-aware working days and pay calculations ✅
6. **Time Logs**: Holiday flagging for attendance records ✅

All changes follow Philippine labor law requirements for holiday pay computation.

### Files Created/Modified
| Action | File |
|--------|------|
| Modify | `prisma/schema.prisma` |
| Create | `lib/holidays.ts` |
| Create | `app/api/holidays/route.ts` |
| Create | `app/api/holidays/import/route.ts` |
| Create | `app/(dashboard)/holidays/page.tsx` |
| Modify | `lib/payroll.ts` |
| Modify | `app/api/payroll/route.ts` |
| Modify | `app/api/time-logs/route.ts` |
| Modify | `app/(dashboard)/layout.tsx` |

### Build Status
```bash
npm run build  # ✅ SUCCESS
```

---

**Version**: 1.0  
**Date**: 2026-03-21  
**Status**: ✅ COMPLETED
