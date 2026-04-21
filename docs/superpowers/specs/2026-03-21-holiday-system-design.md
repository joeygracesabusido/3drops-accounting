# Holiday System Design Specification

## Overview

This specification defines the implementation of a comprehensive holiday management system for the HRIS Philippines application, compliant with Philippine labor law (DOLE) requirements for holiday pay computation.

## Requirements

### Functional Requirements

1. **Holiday Management**
   - Admin/HR users can create, update, and delete holidays
   - Support three holiday types per Philippine labor law:
     - Regular Holiday (REGULAR)
     - Special Holiday (SPECIAL)
     - Special Non-Working Holiday (SPECIAL_NON_WORK)
   - Holidays can be company-wide or branch/department-specific
   - Prevent duplicate holidays on the same date per branch

2. **Auto-Import Feature**
   - Pre-load official Philippine holidays from 2024 to 2030
   - Admins can manually add company-specific holidays
   - Imported holidays can be edited or deactivated

3. **Payroll Integration**
   - Exclude holidays from expected work days calculation
   - Apply correct holiday pay multipliers:
     - Regular Holiday: 200% if works, 100% if no work
     - Special Holiday: 150% if works, 100% if no work
     - Special Non-Working: Normal pay if works, no pay if no work
   - Adjust overtime rates based on holiday type:
     - Regular Holiday OT: 130% (first 8hrs), 162.5% (excess)
     - Special Holiday OT: 105% (first 8hrs), 115% (excess)
     - Regular Day OT: 125% (unchanged)

4. **Time Log Integration**
   - Flag time logs recorded on holidays
   - Display holiday type in time log reports
   - Apply holiday overtime rates automatically

### Non-Functional Requirements

- Follow existing codebase patterns (cookie-based auth, Prisma ORM, Next.js App Router)
- Maintain TypeScript strict mode compliance
- Use existing UI components (shadcn/ui, Radix UI)
- Ensure backward compatibility with existing payroll calculations

## Architecture

### Database Schema

```prisma
// Add to prisma/schema.prisma

model Holiday {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  name      String
  date      DateTime @db.Date
  year      Int
  type      HolidayType
  branchId  String?  @db.ObjectId
  branch    Branch?  @relation(fields: [branchId], references: [id])
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([date, branchId])
  @@index([year])
  @@index([branchId])
}

enum HolidayType {
  REGULAR          // 200% pay if work, 100% if no work
  SPECIAL          // 150% pay if work, 100% if no work
  SPECIAL_NON_WORK // Normal pay if work, no pay if no work
}
```

**Note:** If `Branch` model doesn't exist, use `departmentId` reference to `Employee` model's department field, or keep `branchId` as nullable string for future extensibility.

### API Routes

#### `/api/holidays/route.ts`

**GET** - Fetch holidays
- Query params: `year`, `branchId`, `type`, `isActive`
- Returns: Array of Holiday objects
- Auth: All authenticated users (read-only)

**POST** - Create holiday
- Body: `{ name, date, year, type, branchId?, isActive? }`
- Returns: Created holiday object (201)
- Auth: Admin/HR only

**PATCH** - Update holiday
- Body: `{ id, name?, type?, isActive? }`
- Returns: Updated holiday object
- Auth: Admin/HR only

**DELETE** - Delete holiday
- Query: `?id=<holidayId>`
- Returns: Success message
- Auth: Admin/HR only

**POST /api/holidays/import** - Import PH holidays
- Body: `{ year? }` (optional, defaults to 2024-2030)
- Returns: Count of imported holidays
- Auth: Admin/HR only

### UI Components

#### `/holidays/page.tsx`

**Features:**
- Holiday table with columns: Date, Name, Type, Branch, Status, Actions
- Filter controls: Year dropdown, Type dropdown, Branch dropdown
- "Add Holiday" button → opens modal form
- "Import PH Holidays" button → pre-loads official holidays
- Row actions: Edit, Toggle Active, Delete

**Form Fields:**
- Holiday Name (text input)
- Date (date picker)
- Year (auto-calculated from date)
- Type (select: Regular/Special/Special Non-Working)
- Branch (select: Company-wide or specific branch)
- Active (toggle switch)

### Payroll Computation Updates

#### File: `lib/payroll.ts`

**New Function: `getHolidaysForPeriod()`**
```typescript
function getHolidaysForPeriod(
  startDate: Date,
  endDate: Date,
  branchId?: string
): Holiday[]
```

**Updated Function: `countWorkingDays()`**
```typescript
function countWorkingDays(
  start: Date,
  end: Date,
  branchId?: string
): number {
  // Exclude weekends (Sat=6, Sun=0)
  // Exclude holidays (REGULAR, SPECIAL, SPECIAL_NON_WORK)
  // Return count of expected work days
}
```

**New Function: `calculateHolidayPay()`**
```typescript
function calculateHolidayPay(
  baseDailyRate: number,
  holidayType: HolidayType,
  hoursWorked: number
): number {
  // REGULAR: 200% of daily rate
  // SPECIAL: 150% of daily rate
  // SPECIAL_NON_WORK: 100% of daily rate
}
```

**Updated Function: `calculateOvertimePay()`**
```typescript
function calculateOvertimePay(
  hourlyRate: number,
  overtimeHours: number,
  holidayType?: HolidayType
): number {
  // If holidayType is REGULAR: 130% (first 8hrs), 162.5% (excess)
  // If holidayType is SPECIAL: 105% (first 8hrs), 115% (excess)
  // Default (regular day): 125%
}
```

### Seed Data

#### File: `lib/holidays.ts` (new)

**Pre-defined Philippine Holidays (2024-2030):**
```typescript
export const PH_OFFICIAL_HOLIDAYS = {
  2024: [
    { date: '2024-01-01', name: "New Year's Day", type: 'REGULAR' },
    { date: '2024-01-07', name: 'Chinese New Year', type: 'SPECIAL' },
    { date: '2024-03-29', name: 'Maundy Thursday', type: 'SPECIAL' },
    { date: '2024-03-30', name: 'Good Friday', type: 'REGULAR' },
    { date: '2024-04-09', name: 'Araw ng Kagitingan', type: 'REGULAR' },
    { date: '2024-05-01', name: 'Labor Day', type: 'REGULAR' },
    { date: '2024-06-12', name: 'Independence Day', type: 'REGULAR' },
    { date: '2024-08-26', name: 'National Heroes Day', type: 'REGULAR' },
    { date: '2024-11-01', name: 'All Saints Day', type: 'REGULAR' },
    { date: '2024-11-30', name: 'Bonifacio Day', type: 'REGULAR' },
    { date: '2024-12-25', name: 'Christmas Day', type: 'REGULAR' },
    { date: '2024-12-30', name: 'Rizal Day', type: 'REGULAR' },
    // Eid'l Fitr and Eid'l Adha dates vary by proclamation
  ],
  // ... 2025-2030
}
```

## Data Flow

### Holiday Creation Flow

```
Admin/HR → POST /api/holidays
  ↓
Validate input (date, type, branch)
  ↓
Check for duplicate (date + branchId)
  ↓
Create in MongoDB via Prisma
  ↓
Return created holiday
```

### Payroll Computation Flow

```
GET /api/payroll?employeeId=xxx&month=yyyy-mm
  ↓
Fetch employee time logs for period
  ↓
Fetch holidays for period (by branch)
  ↓
Calculate expected work days (exclude weekends + holidays)
  ↓
For each time log:
  - Check if date is holiday
  - Apply holiday pay rate if works on holiday
  - Apply holiday OT rate if overtime on holiday
  ↓
Compute gross pay, deductions, net pay
  ↓
Return payroll object
```

## Error Handling

- **Duplicate Holiday**: Return 409 with message "Holiday already exists for this date"
- **Invalid Date Range**: Return 400 with message "Invalid holiday date"
- **Unauthorized**: Return 403 for non-Admin/HR users on write operations
- **Database Error**: Log error, return 500 with generic message

## Testing Considerations

1. **Unit Tests**
   - Holiday pay calculation for each type
   - Overtime rate calculation on holidays
   - Working days count with holidays excluded
   - Duplicate detection

2. **Integration Tests**
   - API CRUD operations
   - Import PH holidays endpoint
   - Payroll computation with holidays

3. **Edge Cases**
   - Holiday falls on weekend (no observed date handling per requirements)
   - Company-wide vs branch-specific holidays
   - Inactive holidays should be excluded from calculations

## Migration Plan

1. Add `Holiday` model to Prisma schema
2. Run `npm run db:push` to create collection
3. Create `/lib/holidays.ts` with PH official holidays data
4. Implement `/api/holidays/route.ts`
5. Update `lib/payroll.ts` with holiday-aware calculations
6. Create `/holidays/page.tsx` UI
7. Add "Holidays" link to navigation (Admin/HR only)
8. Update `/api/time-logs/route.ts` to flag holiday time logs
9. Seed database with initial holidays (optional import on first run)

## Future Enhancements (Out of Scope)

- Observed/moved holiday handling (requires DOLE proclamation tracking)
- Recurring holiday templates
- Holiday calendar view (visual calendar UI)
- Employee-specific holiday allowances
- Multi-branch holiday inheritance (company-wide cascades to branches)

## Compliance Notes

This implementation follows Philippine Labor Law (DOLE Department Order No. 174-02 and DOLE Advisory No. 03-2023):

- **Regular Holiday**: Employee receives 100% even if no work; 200% if works
- **Special Holiday**: Employee receives 100% even if no work; 150% if works
- **Special Non-Working**: No pay if no work; 100% if works
- **Overtime on Holiday**: Additional premium on top of holiday rate

---

**Version**: 1.0  
**Date**: 2026-03-21  
**Status**: Draft - Pending Review
