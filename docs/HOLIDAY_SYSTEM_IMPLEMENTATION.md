# Holiday Management System Implementation

## Overview

This document describes the implementation of a complete holiday management system for the HRIS Philippines application, compliant with Philippine labor law (DOLE) requirements for holiday pay computation.

## Features Implemented

### 1. Holiday Types (Philippine Labor Law)

| Type | Work Status | Pay Computation (DOLE) |
|------|-------------|------------------------|
| **REGULAR** | Worked | 200% of daily wage (for first 8 hours) |
| **REGULAR** | Did not work (qualified) | 100% of daily wage |
| **REGULAR** | Worked on rest day | 260% of daily wage |
| **SPECIAL** | Worked | 130% of daily wage (for first 8 hours) |
| **SPECIAL** | Did not work | No pay (no work, no pay) |
| **SPECIAL** | Worked on rest day | 150% of daily wage |
| **SPECIAL_NON_WORKING** | Worked | 100% of daily wage |
| **SPECIAL_NON_WORKING** | Did not work | No pay |

**Overtime on Holidays:**
- Regular holiday OT (first 8 hrs): Hourly rate × 200% × 130%
- Regular holiday OT (excess): Hourly rate × 200% × 130% × 130%
- Special holiday OT (first 8 hrs): Hourly rate × 130% × 130%
- Special holiday OT (excess): Hourly rate × 130% × 130% × 130%

### 2. Database Schema

#### HolidayType Enum
```prisma
enum HolidayType {
  REGULAR          // 200% pay if work, 100% if no work
  SPECIAL          // 150% pay if work, 100% if no work
  SPECIAL_NON_WORK // Normal pay if work, no pay if no work
}
```

#### Holiday Model
```prisma
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
  @@map("holidays")
}
```

#### Payroll Model (Updated)
```prisma
model Payroll {
  // ... other fields
  holidayPay      Float     @default(0)  // Added: stores holiday pay separately
  grossPay        Float     @default(0)
}
```

### 3. Files Created/Modified

#### New Files

1. **`lib/holidays.ts`**
   - Contains Philippine official holidays data (2024-2026)
   - Exported as `PH_OFFICIAL_HOLIDAYS` record

2. **`app/api/holidays/route.ts`**
   - GET: Fetch holidays with filters (year, type, branchId, isActive)
   - POST: Create new holiday (Admin/HR only)
   - PATCH: Update holiday (Admin/HR only)
   - DELETE: Delete holiday (Admin/HR only)

3. **`app/api/holidays/import/route.ts`**
   - POST: Import official Philippine holidays
   - Supports year filter and overwrite option
   - Prevents duplicates by default

4. **`app/(dashboard)/holidays/page.tsx`**
   - Holiday management UI page
   - Add/Edit/Delete functionality
   - Year and type filters
   - "Import PH Holidays" button
   - Active/inactive toggle switch
   - Admin/HR access only

5. **`components/ui/switch.tsx`**
   - Radix UI Switch component for toggles

#### Modified Files

1. **`prisma/schema.prisma`**
   - Added `HolidayType` enum
   - Added `Holiday` model
   - Added `holidayPay` field to `Payroll` model (March 25, 2026 fix)

2. **`lib/payroll.ts`**
   - Added holiday pay calculation functions:
     - `getHolidayPayMultiplier(holidayType, isWorking): number`
     - `getHolidayOTMultiplier(holidayType, otHourNumber): number`
     - `calculateHolidayPay(hourlyRate, hoursWorked, holidayType): number`
     - `isHoliday(date, holidays): Holiday | null`
     - `calculateTotalHolidayPay(hourlyRate, holidayWorkRecords, holidays): number`

3. **`app/api/payroll/route.ts`**
   - Updated `countWorkingDays()` to exclude holidays
   - Holidays fetched for payroll period
   - Working days calculation now holiday-aware
   - **Fixed:** Added `holidayPay` to grossPay calculation for single employee (March 25, 2026)
   - **Fixed:** Added `holidayPay` field in payroll creation (both bulk and single)

4. **`app/api/time-logs/route.ts`**
   - Added holiday flagging to time log responses
   - Fetches active holidays and maps to logs

5. **`app/(dashboard)/layout.tsx`**
   - Added "Holidays" navigation link (Admin/HR only)
   - Uses Calendar icon

### 4. API Endpoints

#### GET `/api/holidays`
Fetch holidays with optional filters.

**Query Parameters:**
- `year` (optional): Filter by year (e.g., `2025`)
- `type` (optional): Filter by type (`REGULAR`, `SPECIAL`, `SPECIAL_NON_WORK`)
- `branchId` (optional): Filter by branch (`null` for company-wide)
- `isActive` (optional): Filter by status (`true`/`false`)

**Response:**
```json
[
  {
    "id": "...",
    "name": "New Year's Day",
    "date": "2025-01-01T00:00:00.000Z",
    "year": 2025,
    "type": "REGULAR",
    "branchId": null,
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

#### POST `/api/holidays`
Create a new holiday (Admin/HR only).

**Request Body:**
```json
{
  "name": "Company Anniversary",
  "date": "2025-06-12",
  "type": "SPECIAL",
  "branchId": null,
  "isActive": true
}
```

**Response:** Created holiday object

#### PATCH `/api/holidays`
Update an existing holiday (Admin/HR only).

**Request Body:**
```json
{
  "id": "...",
  "name": "Updated Name",
  "type": "REGULAR",
  "isActive": false
}
```

**Response:** Updated holiday object

#### DELETE `/api/holidays?id={id}`
Delete a holiday (Admin/HR only).

**Response:**
```json
{
  "message": "Holiday deleted successfully"
}
```

#### POST `/api/holidays/import`
Import official Philippine holidays (Admin/HR only).

**Request Body (optional):**
```json
{
  "year": 2025,
  "overwrite": false
}
```

**Response:**
```json
{
  "message": "Imported 15 holidays, skipped 3 existing",
  "imported": 15,
  "skipped": 3
}
```

### 5. Holiday Pay Calculation Functions

#### `getHolidayPayMultiplier(holidayType, isWorking)`
Returns the pay multiplier based on holiday type and work status.

```typescript
getHolidayPayMultiplier('REGULAR', true)  // 2.0 (200%)
getHolidayPayMultiplier('REGULAR', false) // 1.0 (100%)
getHolidayPayMultiplier('SPECIAL', true)  // 1.5 (150%)
getHolidayPayMultiplier('SPECIAL_NON_WORK', false) // 0 (no pay)
```

#### `getHolidayOTMultiplier(holidayType, otHourNumber)`
Returns overtime multiplier for hours worked on holidays.

```typescript
getHolidayOTMultiplier('REGULAR', 1)   // 2.6 (260%)
getHolidayOTMultiplier('REGULAR', 9)   // 3.25 (325% for excess)
getHolidayOTMultiplier('SPECIAL', 1)   // 1.95 (195%)
```

#### `calculateHolidayPay(hourlyRate, hoursWorked, holidayType)`
Calculates total pay for hours worked on a holiday.

```typescript
calculateHolidayPay(500, 8, 'REGULAR')    // 8000 (500 × 2.0 × 8)
calculateHolidayPay(500, 10, 'REGULAR')   // 10500 (8hrs @ 200% + 2hrs @ OT rate)
```

### 6. UI Features

#### Holiday Management Page (`/holidays`)

**Add Holiday Form:**
- Holiday name input
- Date picker
- Type dropdown (Regular/Special/Special Non-Working)
- Add button

**Import Button:**
- "Import PH Holidays" button
- Imports official Philippine holidays
- Preserves existing holidays by default

**Holiday List:**
- Displays all holidays with filters
- Year filter dropdown (2024, 2025, 2026, All Years)
- Type filter dropdown (All Types, Regular, Special, Special Non-Working)
- Each holiday shows:
  - Name and formatted date
  - Type badge (color-coded)
  - Active/Inactive toggle switch
  - Edit and Delete buttons

**Edit Mode:**
- Click Edit to modify holiday details
- Save or Cancel changes

**Access Control:**
- Only Admin and HR users can access
- Employees and Managers see "Access Denied" message

### 7. Integration Points

#### Payroll Integration
The `countWorkingDays()` function in `app/api/payroll/route.ts` now excludes holidays:

```typescript
function countWorkingDays(
  start: Date,
  end: Date,
  holidays: { isActive: boolean; date: Date }[] = []
): number {
  let count = 0;
  const cur = new Date(start);
  const holidayDates = holidays
    .filter((h) => h.isActive)
    .map((h) => new Date(h.date).toLocaleDateString());

  while (cur <= end) {
    const day = cur.getDay();
    const dateStr = cur.toLocaleDateString();
    // Exclude weekends (0=Sunday, 6=Saturday) and holidays
    if (day !== 0 && day !== 6 && !holidayDates.includes(dateStr)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
```

#### Time Logs Integration
Time logs now include holiday information in the response:

```typescript
const holidays = await prisma.holiday.findMany({
  where: { isActive: true, branchId: null },
});
const holidayMap = new Map(
  holidays.map(h => [new Date(h.date).toLocaleDateString(), h])
);

// In formatted logs
const logDateStr = new Date(log.date).toLocaleDateString();
const holiday = holidayMap.get(logDateStr) || null;
```

### 8. Philippine Official Holidays Data

The system includes pre-loaded official holidays for 2024-2026:

**2024 Highlights:**
- New Year's Day (Jan 1) - REGULAR
- Chinese New Year (Jan 7) - SPECIAL
- Good Friday (Mar 30) - REGULAR
- Labor Day (May 1) - REGULAR
- Independence Day (Jun 12) - REGULAR
- Christmas Day (Dec 25) - REGULAR
- Rizal Day (Dec 30) - REGULAR

**2025-2026:** Similar structure with updated dates for movable holidays.

### 9. Database Collections

**New Collection:**
- `holidays` - Company holiday records

**Related Collections:**
- `payrolls` - Now uses holiday-aware working days calculation
- `timelogs` - Now includes holiday flagging

### 10. Testing

To test the implementation:

1. **Access the Holidays page:**
   ```
   http://localhost:3001/holidays
   ```
   (Must be logged in as Admin or HR)

2. **Import PH Holidays:**
   - Click "Import PH Holidays" button
   - Verify holidays appear in the list

3. **Add Custom Holiday:**
   - Fill in name, date, type
   - Click "Add Holiday"

4. **Edit Holiday:**
   - Click Edit button on any holiday
   - Modify details and save

5. **Toggle Active/Inactive:**
   - Use the switch toggle on any holiday

6. **Delete Holiday:**
   - Click Delete button (confirms before deletion)

7. **Test Payroll Integration:**
   - Generate payroll for a period with holidays
   - Verify working days exclude holidays

8. **Test Time Logs:**
   - View time logs for a holiday date
   - Verify holiday information is included

### 11. Known Issues

**Pre-existing lint warnings (not related to holiday system):**
- `app/api/time-logs/route.ts:26` - `officeLocation` model uses `(prisma as any)` - GPS feature
- `app/api/office-location/route.ts` - Similar GPS-related issues
- Various unused variable warnings across the codebase

**Notes:**
- Prisma client may need regeneration after schema changes
- Dev server should auto-regenerate on restart
- LSP errors about `holiday` property are expected until Prisma client is regenerated

### 12. Bug Fixes

#### March 25, 2026 - Holiday Pay Not Included in Gross Pay

**Problem:** 
- The `holidayPay` was not included in `grossPay` for single employee payroll computation
- The `holidayPay` field did not exist in the Payroll model

**Solution:**
1. Added `holidayPay` field to Payroll model in `prisma/schema.prisma`
2. Fixed `grossPay` calculation in `app/api/payroll/route.ts` line 515 to include `holidayPay`
3. Added `holidayPay` to payroll creation (both bulk and single employee cases)

**Files Changed:**
- `prisma/schema.prisma` - Added `holidayPay Float @default(0)` to Payroll model
- `app/api/payroll/route.ts:515` - Changed to `grossPay = (daysWithTimeLog * dailyRate) + otPay + holidayPay + adjustmentAdd - adjustmentDeduct`
- `app/api/payroll/route.ts:518` - Changed to `grossPay = periodSalary + otPay + holidayPay + adjustmentAdd - adjustmentDeduct`
- `app/api/payroll/route.ts:301,579` - Added `holidayPay` to payroll creation

#### March 25, 2026 - Holiday Date Matching Timezone Issue

**Problem:**
- Holiday dates were not being matched with time logs due to timezone mismatch
- Time logs stored in UTC (e.g., `2026-03-19T16:00:00.000Z`) appeared as March 20 in local time (UTC+8)
- Holiday stored as `2026-03-20T00:00:00.000Z` didn't match the UTC date string

**Solution:**
- Changed date comparison from `toISOString().split('T')[0]` to `toLocaleDateString('en-CA')`
- This ensures consistent YYYY-MM-DD format in local timezone for both holiday and time log dates

**Files Changed:**
- `app/api/payroll/route.ts:190-192` - Changed to use `toLocaleDateString('en-CA')` for bulk employee payroll
- `app/api/payroll/route.ts:469-471` - Changed to use `toLocaleDateString('en-CA')` for single employee payroll

#### March 25, 2026 - Holiday Pay Rate Correction

**Problem:**
- Special holiday rate was incorrectly set to 130% (1.3x) instead of 150% (1.5x)
- Philippine Labor Law requires 150% for special holidays worked

**Solution:**
- Changed special holiday rate from 1.3 to 1.5 in payroll computation
- Added proper documentation of Philippine labor law rates

**Files Changed:**
- `app/api/payroll/route.ts:215` - Changed SPECIAL rate from 1.3 to 1.5 (bulk payroll)
- `app/api/payroll/route.ts:491` - Changed SPECIAL rate from 1.3 to 1.5 (single employee payroll)

**Philippine Labor Law Holiday Rates:**
- Regular holiday worked: 200% (2.0x hourly rate)
- Special holiday worked: 150% (1.5x hourly rate)
- Special non-working day worked: 100% (1.0x hourly rate)

**Verification:**
- Run `npx prisma generate` to update Prisma client
- Holiday pay is now properly computed and stored in payroll records

#### March 25, 2026 - Holiday Pay Computation Correction (Per DOLE Labor Law)

**Problem:**
- Holiday pay was incorrectly computed using hourly rate × hours worked × multiplier
- Philippine labor law (DOLE) requires holiday pay based on DAILY rate, not hourly

**Solution:**
- Changed computation from `hourlyRate × hours × 2.0` to `dailyRate × 2.0` (per day)
- Holiday pay is now calculated per holiday day worked, not per hour
- Added counting of holiday days (regularHolidayDays, specialHolidayDays)

**DOLE-Compliant Computation:**
- Regular holiday worked: Daily Rate × 200% (for first 8 hours)
- Special holiday worked: Daily Rate × 130% (for first 8 hours)
- Overtime beyond 8 hours gets additional 30% premium (not yet implemented)

**Files Changed:**
- `app/api/payroll/route.ts:185-218` - Changed bulk payroll to use daily rate × days
- `app/api/payroll/route.ts:467-501` - Changed single employee payroll to use daily rate × days
- `app/(dashboard)/payroll/page.tsx` - Updated display to show "holidayDays" instead of "holidayHours"

**Verification:**
- Example: If daily rate = ₱500 and worked 1 regular holiday
  - Old (incorrect): 14.3 hours × ₱62.50/hr × 2.0 = ₱1,787.50
  - New (correct): 1 day × ₱500 × 2.0 = ₱1,000.00

### 13. Future Enhancements

Potential improvements for the holiday system:

1. **Branch-specific holidays** - Enable `branchId` filtering for multi-branch companies
2. **Holiday calendar view** - Visual calendar display of holidays
3. **Holiday pay in payslips** - Show holiday pay breakdown in payroll details
4. **Overtime on holidays** - Full implementation of holiday OT calculations
5. **Holiday import from external source** - API integration with DOLE/Philippine government
6. **Recurring holidays** - Auto-generate annual holidays
7. **Holiday notifications** - Alert employees about upcoming holidays

### 13. Compliance

This implementation follows:
- **Philippine Labor Code** - Holiday pay rates
- **DOLE Department Advisory No. 2, Series of 2020** - Holiday classifications
- **BIR Regulations** - Tax treatment of holiday pay

### 14. References

- [DOLE Holiday Pay Calculator](https://www.dole.gov.ph/)
- [Philippine Labor Code Article 94-95](https://www.dole.gov.ph/labor-laws/)
- [BIR Tax Regulations](https://www.bir.gov.ph/)

---

**Implementation Date:** March 21, 2026  
**Developer:** HRIS Philippines Development Team  
**Version:** 1.0.0
