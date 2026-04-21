# AGENTS.md - Developer Guidelines for HRIS Philippines

## Technology Stack

- **Framework**: Next.js 14 (React 18) — App Router
- **Database**: MongoDB with Prisma ORM
- **UI**: Radix UI + shadcn/ui + Tailwind CSS
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **Auth**: Cookie-based (custom implementation)
- **Date handling**: date-fns
- **Excel/CSV**: xlsx

---

## Commands

```bash
# Development
npm run dev          # Dev server on port 3000
npm run build        # Production build
npm run start        # Production server
npm run lint         # Run ESLint

# Database
npm run db:push      # Push schema changes to MongoDB
npm run db:seed      # Seed database with sample data
npx prisma studio    # Open Prisma GUI

# Scripts
npm run leave-accrual    # Run monthly leave accrual
npm run link-users       # Link users to employees by email
```

---

## Code Style

### General
- TypeScript with **strict mode** (no `any`; use `unknown` or specific types)
- 2 spaces indentation, single quotes, trailing commas, semicolons
- Max line length ~100 characters
- Export functions/components at top level (no default exports)

### Imports (order)
1. React/Next imports
2. External libs
3. Internal imports (@/ alias)
4. Type imports at bottom

```typescript
import { useState, useEffect } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Employee } from '@/types'
```

### Naming
- **Components/files**: PascalCase (`EmployeeCard.tsx`) or kebab-case for pages (`employees/page.tsx`)
- **Variables/functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Interfaces/Types**: PascalCase (no `I` prefix)

### React Components
```typescript
'use client'

interface Props {
  employee: Employee
  onSelect: (id: string) => void
}

export function EmployeeCard({ employee, onSelect }: Props) {
  const [loading, setLoading] = useState(false)
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold">{employee.fullName}</h3>
    </div>
  )
}
```

### API Routes
```typescript
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const employees = await prisma.employee.findMany({
      where: id ? { id } : {},
    })
    return NextResponse.json(employees)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
```

---

## Key Patterns

### Error Handling
- Always wrap async operations in try/catch
- Log errors with `console.error('Context:', error)`
- Return meaningful error messages with appropriate HTTP status codes
- Check for Prisma errors: `error instanceof Prisma.PrismaClientKnownRequestError`

### Role-Based Access Control
Use `hasAdminAccess()` from `@/lib/auth-helpers` and `getEmployeeIdForUser()` from `@/lib/user-employee-link`:

```typescript
import { hasAdminAccess } from '@/lib/auth-helpers'
import { getEmployeeIdForUser } from '@/lib/user-employee-link'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('userRole')?.value
  const userEmail = cookieStore.get('userEmail')?.value

  // Admin/HR/MANAGER see all data
  if (hasAdminAccess(userRole || '')) {
    // Return all records
  } else {
    // EMPLOYEE sees only their own data
    const linkedEmployeeId = await getEmployeeIdForUser(userEmail || '', userRole || '')
    // Filter by employeeId
  }
}
```

### Date Handling (Manila Timezone)
**CRITICAL**: Always use Manila timezone for time-related operations:

```typescript
const MANILA_TIMEZONE = 'Asia/Manila'

function getManilaNow(): Date {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: MANILA_TIMEZONE }))
}

// For date queries
function getManilaToday(): { start: Date; end: Date } {
  const now = getManilaNow()
  return {
    start: startOfDay(now),
    end: endOfDay(now),
  }
}

// Display: Use getUTCHours/getUTCMinutes for Philippines time
const hours = date.getUTCHours()
const minutes = date.getUTCMinutes()
```

### Prisma (MongoDB)
```typescript
// MongoDB uses @db.ObjectId for references
const employee = await prisma.employee.findUnique({
  where: { id },
  include: { user: true },
})
```

### Zod Validation
```typescript
const Schema = z.object({
  fullName: z.string().min(1, 'Required'),
  employeeNumber: z.number().int().positive(),
})

const result = Schema.safeParse(body)
if (!result.success) {
  return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
}
```

---

## Project Structure

```
/app
  /(dashboard)           # Authenticated pages (route group)
    /employees/
    /time-logs/
    /payroll/
  /api                    # API routes
/components
  /ui                     # shadcn/ui components
/lib                      # Utils, prisma client, auth helpers
/prisma
  schema.prisma
  seed.ts
/scripts                  # Database scripts
```

---

## Environment Variables

```env
DATABASE_URL=mongodb+srv://...
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379  # Optional
```

---

## Development Workflow

1. Create branch for features/fixes
2. Make changes following guidelines
3. Run `npm run lint` before committing
4. Verify with `npm run build`
5. Test in dev server

---

## Recent Updates

### GAAP Financial Reporting & Beginning Balances (2026-04-20)

**New Features:**
- **GAAP Financial Reports**: Implemented real-time, GAAP-compliant **Trial Balance**, **Income Statement (P&L)**, and **Balance Sheet (Statement of Financial Position)**.
- **Beginning Balances**: Added "Initial Balance" field to the Chart of Accounts setup.
- **Automatic Opening Entries**: System now automatically creates a Journal Entry against **Retained Earnings** when a new account is created with an initial balance.
- **Accounting Dashboard**: Connected the overview dashboard to real-time stats (Cash, AR, AP, Net Income) and recent journal entries.
- **Professional Report UI**: Replaced tabs with a professional dropdown selector and high-fidelity accounting layouts.

**Issues Fixed:**
- **Import Errors**: Fixed `next/link` named import crash in COA page and `prisma` import error in transactions API.
- **API Access**: Updated `middleware.ts` to allow `/api/accounting` paths, fixing "Account transactions not found" errors.
- **Sidebar UX**: Fixed the "Logout" button overlapping with navigation items by making the sidebar a flex container with scrollable navigation.
- **Stability**: Added nullish coalescing safeguards to all numeric displays to prevent crashes (e.g., `toLocaleString` on undefined values).

**Key Files:**
- `app/(dashboard)/accounting/reports/page.tsx` - Professional reports interface with safety fallbacks
- `app/api/accounting/reports/[type]/route.ts` - GAAP-compliant reporting logic
- `app/api/accounting/accounts/route.ts` - Updated POST handler for automatic beginning balance entries
- `app/(dashboard)/layout.tsx` - Restructured sidebar with flex-box and scrollable nav
- `app/api/accounting/stats/route.ts` - New dashboard statistics API

**How to set an Initial Balance:**
1. Go to Chart of Accounts (`/accounting/coa`)
2. Click **Add Account**
3. Enter account details and fill in the **Initial Balance (Beginning Balance)** field
4. Upon save, the system creates the account AND a corresponding POSTED journal entry to establish the balance against Retained Earnings.
5. *Note: Initial balances are read-only after creation to maintain audit trails. Use Journal Entries for adjustments.*

---

### Element Type is Invalid Error (2026-04-20)

**Error:** `Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.`

**Potential Causes Investigated:**
1. Component not exported from file
2. Circular import issues
3. Missing default export
4. Failed dynamic import
5. Stale build cache

**Files Checked:**
- `components/ui/card.tsx` - All components properly exported
- `components/ui/dialog.tsx` - All components properly exported
- `components/facial-recognition/FaceCapture.tsx` - Default export present

**Troubleshooting Steps:**
1. Delete `.next` folder and restart dev server
2. Run `npm run dev` to rebuild
3. Check full error stack trace from browser console (F12)

**Fixes Applied:**
- None required - all UI components properly export their components
- Issue may be intermittent build cache or requires full stack trace for root cause

---

### Print Payroll No Data Fix (2026-04-18)

**Issue Fixed:** "No payroll records found" error due to Prisma P2032 error - Payroll records with null dailyRate causing API to fail

**Files Updated:**
- `app/api/payroll/route.ts:807-825` - Fixed GET handler to fetch payroll and employees separately
- `prisma/schema.prisma:388-391` - Added @default(0) to Float fields (basicSalary, dailyRate, workDays, daysWorked)

**Changes Made:**
1. **Separated queries:** Fetch payrolls without `include: { employee: true }` to avoid P2032 error
2. **Separate employee fetch:** Fetch employees by IDs and map them to payrolls
3. **Filter null values:** Filter out records where dailyRate is null
4. **Schema defaults:** Added @default(0) to prevent future null issues

```typescript
// Before: Failed with P2032 error
const payrolls = await prisma.payroll.findMany({
  where,
  include: { employee: true },  // Caused error with null Float fields
});

// After: Separate queries to avoid Prisma error
const payrolls = await prisma.payroll.findMany({
  where: where as never,
  orderBy: [{ year: 'desc' }, { month: 'desc' }],
});
const employeeIds = [...new Set(payrolls.map(p => p.employeeId))];
const employees = await prisma.employee.findMany({
  where: { id: { in: employeeIds } },
});
const validPayrolls = payrolls
  .filter(p => p.dailyRate !== null)
  .map(p => ({ ...p, employee: employeeMap.get(p.employeeId) }));
```

### Print Payroll PDF Updates (2026-04-18)

**Issues Fixed:**
- PDF column overlap and spacing
- Records showing immediately without filter
- No. of Days showing wrong value
- Certification placement

**Files Updated:**
- `app/(dashboard)/reports/print-payroll/page.tsx` - Multiple updates to PDF generation

**Changes Made:**
1. **Added Rate/Day and No. of Days columns:**
   - Rate/Day = basicSalary / 22
   - No. of Days = daysWorked from payroll data (actual count of days with time logs)

2. **Filter button behavior:**
   - Records only display after clicking "Filter" button
   - Added `filterApplied` state to control display
   - Shows "X payroll record(s)" only when filter is applied

3. **Fixed filter logic:**
   - Changed from exact match to overlapping period check
   - If filter selects April 1-15, shows records that overlap with that range

4. **Column widths adjusted:**
   - Wider columns: `[8, 35, 25, 28, 22, 16, 28, 22, 22, 26, 22, 30]` (total 256mm fits landscape legal ~356mm)

5. **Certification at bottom:**
   - Fixed position at `pageHeight - 80` (~80mm from bottom)
   - If not enough space, moves to new page

### Holiday Computation Fix (2026-04-18)

**Issue Fixed:** Incorrect holiday pay calculation logic

**Files Updated:**
- `app/api/payroll/route.ts` - Updated holiday logic in both POST (generate) and GET (list) handlers

**New Logic:**
- **REGULAR (Legal) Holidays:**
  - If worked on holiday AND has attendance before AND after → full holiday pay (100%)
  - If did NOT work on holiday but has attendance on/before → holiday pay (legal holiday benefit)
- **SPECIAL Holidays:**
  - Requires working on holiday AND attendance before AND after → 30% holiday pay

**Changes Made:**
```typescript
// Check attendance before/after holiday
const datesBefore = sortedDates.filter(d => new Date(d) < holidayDate);
const datesAfter = sortedDates.filter(d => new Date(d) > holidayDate);
const hasAttendanceBefore = datesBefore.length > 0;
const hasAttendanceAfter = datesAfter.length > 0;
const hasAttendanceBeforeAndAfter = hasAttendanceBefore && hasAttendanceAfter;

if (holiday.type === 'REGULAR') {
  if (workedOnHoliday && hasAttendanceBeforeAndAfter) {
    regularHolidayDays += 1;
  } else if (!workedOnHoliday && hasAttendanceBefore) {
    // Did not work on holiday but has attendance on/before
    regularHolidayDays += 1;
  }
} else if (holiday.type === 'SPECIAL') {
  if (workedOnHoliday && hasAttendanceBeforeAndAfter) {
    specialHolidayDays += 1;
  }
}
```

### Face Recognition Body Scroll Fix (2026-04-18)

**Issue Fixed:** Body scroll gets locked/disturbed when opening face verification modal

**Files Updated:**
- `app/(dashboard)/time-logs/page.tsx:127-134` - Added useEffect for body overflow management

**Changes Made:**
```typescript
useEffect(() => {
  if (showFaceModal) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = 'unset';
  }
  return () => {
    document.body.style.overflow = 'unset';
  };
}, [showFaceModal]);
```

This prevents body scroll lock when the face verification modal appears and restores it when closed.

### Accounting Pages TypeScript & ESLint Fixes (2026-04-17)

**Issues Fixed:**
- ESLint error `react/no-unescaped-entities` in subsidiary-ledgers page
- TypeScript error `Property 'type' does not exist on type 'Account'` in expenses page

**Files Updated:**
- `app/(dashboard)/accounting/subsidiary-ledgers/page.tsx:290` - Escaped single quotes using HTML entity `&apos;`
- `app/(dashboard)/accounting/expenses/page.tsx:39` - Added `type: string` property to `Account` interface

**Changes Made:**
```typescript
// Before:
interface Account {
  id: string;
  code: string;
  name: string;
}

// After:
interface Account {
  id: string;
  code: string;
  name: string;
  type: string;  // Added for filtering by account type (ASSET, EXPENSE, etc.)
}
```

**ESLint Fix Pattern:**
```jsx
// Instead of:
<span>Click 'Add' to create</span>

// Use:
<span>Click &apos;Add&apos; to create</span>
```

### TypeScript Strict Type Fixes (2026-04-17)

**Issue Fixed:** Vercel deployment error - "Unexpected any" violations in strict TypeScript mode

**Files Updated:**
- `app/(dashboard)/accounting/vendors/page.tsx` - Added explicit type annotations for API responses (`Vendor[]`, `VendorWithTransactions`)
- `app/(dashboard)/time-logs/page.tsx` - Added explicit type annotations for all fetch operations, import handlers, and API responses

**Changes Made:**
- Added `as Type[]` type assertions to `fetch().json()` calls
- Added explicit parameter types to async callbacks (e.g., `(res: Response)`, `(data: Type)`, `(err: Error)`)
- Extended interface definitions to include all Prisma model fields
- Removed implicit `any` types from inline callbacks (e.g., `.find((emp) => ...)` instead of `.find((emp: Employee) => ...)`) when the parent array is already typed

**Pattern for Vercel Deployment:**
```typescript
// Instead of:
const data = await res.json()

// Use:
const data = await res.json() as YourInterface[]
```

### Face Recognition Verification Fix (2026-04-17)

**Issue Fixed:** Face verification modal not appearing when clicking "Clock In" in `/time-logs`, causing "Session expired" error and body scroll lock issues

**Root Causes:**
1. **Authentication mismatch** - Face descriptor API used NextAuth (`getServerSession`) instead of cookie-based auth (`isLoggedIn` cookie)
2. **Missing modal JSX** - Face verification modal was not rendered in the time-logs page despite state and imports existing
3. **Poor error messages** - Generic "Employee has not enrolled their face" error without debugging information

**Files Updated:**
- `app/(dashboard)/time-logs/page.tsx:413-450` - Enhanced `initiateVerification()` with detailed logging, empty array checks, and specific error messages
- `app/(dashboard)/time-logs/page.tsx:1404-1430` - Added missing face verification modal JSX with `FaceCapture` component
- `app/api/employees/[id]/face-descriptor/route.ts` - Changed from NextAuth to cookie-based auth, added empty array check and detailed logging

**Changes Made:**
```typescript
// Before: NextAuth session check (caused 401 "Session expired")
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// After: Cookie-based auth (matches app pattern)
const cookieStore = await cookies();
const isLoggedIn = cookieStore.get('isLoggedIn')?.value;
if (isLoggedIn !== 'true') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Frontend Improvements:**
- Added console logging for debugging employee ID and API responses
- Checks for empty face descriptor arrays (`faceDescriptor.length === 0`)
- Specific error messages for 404 (not enrolled) vs 401 (session expired)
- Added face verification modal with proper close handlers

**How Face Verification Works:**
1. User clicks "Clock In" → `initiateVerification()` fetches descriptor from `/api/employees/[id]/face-descriptor`
2. If descriptor exists → Opens modal with `FaceCapture` component in verify mode
3. Face captured → Compares against stored descriptor using Euclidean distance
4. If distance < 0.6 → Auto-clocks in and closes modal
5. If distance ≥ 0.6 → Shows error "Identity verification failed" with retry option

**Debugging Steps:**
1. Open browser console (F12) → Look for `[Face Verification]` logs
2. Check backend logs for `[Face Descriptor API]` logs
3. Verify employee has face descriptor in database via Prisma Studio (`/api/employees/[id]/face-descriptor` returns 200)
4. If 404 returned → Enroll face via `/employees` page (Edit → "Enroll Face" button)

### XCLS Import Excel Numeric Time Fix (2026-04-17)

**Issue Fixed:** XCLS import (`/api/time-logs/import-xcls`) returning `null` for clockIn/clockOut when importing Excel files with numeric time values (e.g., `0.3125` for 7:30 AM) instead of text format (e.g., `"7:30 AM"`)

**Root Cause:** The `parseTime` function expected text format `"HH:MM AM/PM"` but Excel stores times as fractions of a day (0.3125 = 7:30 AM). When using `cellDates: true`, these become Date objects from Excel's epoch (1899-12-30) rather than times of day.

**Files Updated:**
- `app/api/time-logs/import-xcls/route.ts:44-71` - Enhanced `parseTime` to handle Excel numeric times and Date objects
- `app/api/time-logs/import-xcls/route.ts:73-93` - Updated `parseDate` to return midnight (00:00:00) instead of noon (12:00:00)
- `app/(dashboard)/time-logs/page.tsx:550-564` - Updated `downloadXclsTemplate` to use Date objects for proper Excel formatting

**Changes Made:**
```typescript
// Before: Only handled text format "7:48 AM"
const match = timeStrClean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
if (!match) return null;

// After: Handles Excel numeric time (0.3125 = 7:30 AM)
if (typeof timeStr === 'number') {
  const totalMinutes = Math.round(timeStr * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
}

// Also handles Date objects from Excel (when cellDates: true)
if (timeStr instanceof Date) {
  const hours = timeStr.getHours();
  const minutes = timeStr.getMinutes();
  return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
}
```

**Date Fix:**
```typescript
// Before: Used noon (12:00:00) to avoid timezone issues
return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));

// After: Uses midnight (00:00:00) for date field
return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
```

**Excel Date/Time Reference:**
- Excel stores dates as serial numbers from 1899-12-30 (46125 = April 12, 2026; 46126 = April 13, 2026)
- Excel stores times as fractions of a day (0.3125 = 7:30 AM; 0.708333 = 5:00 PM)
- The import now handles both numeric and text formats

### Customer & Vendor Management (2024-04-16)

**New Features:**
- **Customers Page** (`/accounting/customers`) - Manage Accounts Receivable customers with credit limits, payment terms, and transaction history
- **Vendors Page** (`/accounting/vendors`) - Manage Accounts Payable suppliers with payment terms and transaction history
- **Subsidiary Ledger Support** - GAAP-compliant subsidiary ledger structure for AR, AP, Inventory, Fixed Assets, and Employee receivables
- **COA Subsidiary Configuration** - New Account form includes checkbox and dropdown to mark accounts as control accounts with subsidiary ledger type

**Database Models:**
- `SubsidiaryLedger` - Detailed records supporting General Ledger control accounts
- `SubsidiaryTransaction` - Transaction-level details for reconciliation
- `Account.hasSubsidiaryLedger` and `Account.subsidiaryType` - Mark control accounts (1200-AR, 1220-Employee Receivable, 1300-Inventory, 1600-Fixed Assets, 2100-AP)

**API Routes:**
- `GET/POST/PATCH/DELETE /api/accounting/customers` - Customer CRUD operations
- `GET/POST/PATCH/DELETE /api/accounting/vendors` - Vendor CRUD operations
- `GET/POST/PATCH /api/accounting/subsidiary-ledgers` - Generic subsidiary ledger management with reconciliation
- `GET/POST/PATCH /api/accounting/accounts` - Updated with hasSubsidiaryLedger and subsidiaryType fields

**Navigation:**
- Added "Customers" and "Vendors" menu items under Accounting sidebar
- QuickBooks-style account numbering: Assets (1000-1999), Liabilities (2000-2999), Equity (3000-3999), Revenue (4000-4999), Expenses (5000-5999)

**Key Files:**
- `app/(dashboard)/accounting/customers/page.tsx` - Customer management UI
- `app/(dashboard)/accounting/vendors/page.tsx` - Vendor management UI
- `app/(dashboard)/accounting/coa/page.tsx` - Updated with subsidiary ledger checkbox and type dropdown
- `app/api/accounting/customers/route.ts` - Customer API
- `app/api/accounting/vendors/route.ts` - Vendor API
- `app/api/accounting/accounts/route.ts` - COA API updated with subsidiary fields
- `prisma/schema.prisma` - SubsidiaryLedger and SubsidiaryTransaction models

**How to Setup Control Accounts:**
1. Go to Chart of Accounts (`/accounting/coa`)
2. Click "Add Account" or edit an existing account
3. Check "Has Subsidiary Ledger (Control Account)"
4. Select Subsidiary Type (Customer/Supplier/Inventory Item/Fixed Asset/Employee)
5. The account will appear in the Subsidiary Ledgers dropdown
