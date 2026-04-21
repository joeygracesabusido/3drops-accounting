# Leave Credits Setup & Deployment

## Prerequisites

- Node.js 18+
- MongoDB 5+
- npm or yarn
- Access to run Prisma commands

---

## Initial Setup

### Step 1: Regenerate Prisma Client

After stopping the development server:

```bash
# Stop any running Next.js processes
npm run db:push

# Regenerate Prisma Client
npx prisma generate
```

### Step 2: Update Existing Employees

Set the employee status for all existing regular employees:

**Option A: Via MongoDB Compass or CLI**

```javascript
// Set all active employees as REGULAR (assuming they're past probation)
db.employees.updateMany(
  { isActive: true },
  { $set: { employeeStatus: "REGULAR", regularizationDate: new Date() } }
)
```

**Option B: Create an admin interface**

Add a status update field to the employee edit form.

### Step 3: Run Initial Accrual (Optional)

For employees who are already regular and should have accrued credits:

```bash
# Run accrual for previous months
npm run leave-accrual -- --year=2026 --month=1
npm run leave-accrual -- --year=2026 --month=2
npm run leave-accrual -- --year=2026 --month=3
```

Or manually adjust balances via API.

---

## Setting Up Cron Job

### Option 1: System Cron (Linux)

```bash
# Edit crontab
crontab -e
```

Add the following line to run on the last day of each month at 11 PM:

```cron
# Leave Accrual - Run on last day of month at 23:00
0 23 28-31 * * [ $(date -d +1day +\%d) -eq 1 ] && cd /path/to/app && npm run leave-accrual >> /var/log/leave-accrual.log 2>&1
```

### Option 2: Vercel Cron (Recommended for Vercel)

Create `vercel.json` in the root:

```json
{
  "crons": [
    {
      "path": "/api/leave-credits/accrue",
      "schedule": "0 23 28-31 * *"
    }
  ]
}
```

Then update the `/api/leave-credits/accrue` endpoint to auto-trigger:

```typescript
// Add query param check for cron
const { searchParams } = new URL(request.url)
const isCron = searchParams.get('cron') === 'true'

if (user?.role !== 'ADMIN' && !isCron) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
}
```

### Option 3: Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Monthly, on day 28-31, at 11:00 PM
4. Set action: Start a program
5. Program: `npm`
6. Arguments: `run leave-accrual`
7. Start in: `C:\path\to\hris-nextjs`

---

## Environment Variables

No new environment variables required. The system uses:
- `DATABASE_URL` (existing)
- Cookie-based authentication (existing)

---

## Verification Checklist

After setup, verify:

- [ ] `npx prisma generate` succeeds
- [ ] Employee records have `employeeStatus` field
- [ ] Admin can access Leave Credits page
- [ ] Leave Credits page shows balance cards
- [ ] Transaction history displays
- [ ] "Run Monthly Accrual" button works
- [ ] Leave balance shows on File Leave modal

---

## Troubleshooting

### "Property does not exist" LSP/TypeScript errors

Prisma Client types are stale. This is a common issue in Next.js dev mode:

1. Stop the development server
2. Run `npx prisma generate`
3. Restart the dev server

The application will work correctly even if LSP shows errors (verify with `npm run build`).

### "Property does not exist" errors

Prisma Client is out of date. Run:

```bash
npx prisma generate
```

### Employees not showing in accrual

Check employee status:

```javascript
db.employees.find({}, { fullName: 1, employeeStatus: 1, isActive: 1 })
```

Only employees with `employeeStatus: "REGULAR"` and `isActive: true` are processed.

### Accrual says "Employee hired mid-month"

This is by design. If an employee was hired on the 15th, they don't get credit for that month.

To backfill credits after hiring mid-month:

1. Update `regularizationDate` to first of hire month:
   ```javascript
   db.employees.updateOne(
     { _id: ObjectId("xxx") },
     { $set: { regularizationDate: ISODate("2026-01-01") } }
   )
   ```
2. Manually adjust credits via API

---

## Configuration Constants

Located in `lib/leave-credits.ts`:

```typescript
const MONTHLY_ACCRUAL_DAYS = 1.25 // 15 days / 12 months
```

### Adjusting Accrual Rate

To change from 15 days/year to a different amount:

```typescript
// For 10 days/year:
const MONTHLY_ACCRUAL_DAYS = 10 / 12 // ~0.83

// For 20 days/year:
const MONTHLY_ACCRUAL_DAYS = 20 / 12 // ~1.67
```

---

## Backup & Recovery

### Export Leave Credits

```bash
mongodump --collection=leavecredits --db=hris
mongodump --collection=leavecredittransactions --db=hris
```

### Restore Leave Credits

```bash
mongorestore --collection=leavecredits --db=hris path/to/leavecredits.bson
mongorestore --collection=leavecredittransactions --db=hris path/to/leavecredittransactions.bson
```

---

## Security Considerations

- Admin-only access to accrual endpoint
- Transaction audit trail for all changes
- Employee can only view own balance
- No sensitive data exposed in API responses

---

## Support

For issues, check:
1. Server logs for error messages
2. MongoDB connection status
3. Prisma Client regeneration
4. Employee status settings
