# Leave Credits System

## Overview

The Leave Credits system automatically accrues vacation leave for regular employees in compliance with Philippine Labor Law (Article 95 - Service Incentive Leave).

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Complete | EmployeeStatus, regularizationDate, LeaveCredit, LeaveCreditTransaction |
| TypeScript Types | ✅ Complete | All leave credit types defined in `types/index.ts` |
| Core Utilities | ✅ Complete | `lib/leave-credits.ts` with accrual, balance, deduct functions |
| API Routes | ✅ Complete | `/api/leave-credits`, `/api/leave-credits/balance`, `/api/leave-credits/accrue` |
| UI Dashboard | ✅ Complete | Leave credits page at `/leave-credits` |
| Leave Integration | ✅ Complete | Balance shown when filing leaves |
| Cron Script | ✅ Complete | `scripts/run-leave-accrual.ts` |
| Employee Form | ✅ Complete | Employment Status & Regularization Date fields |
| Sidebar Navigation | ✅ Complete | Leave Credits added before Leaves |
| Documentation | ✅ Complete | 4 .md files in `docs/leave-credits/` |
| Automated Cron Job | ⏳ Pending | Vercel cron or system cron setup needed |
| Historical Accrual | ⏳ Pending | Run backfill for existing regular employees |

---

## Business Rules

### Entitlement
- Only **REGULAR** employees earn leave credits
- Probationary employees do NOT earn credits until they become regular

### Accrual Rate
- **1.25 days per month** (15 days per year)
- Accrual happens automatically at the end of each month

### Mid-Month Hire Policy
- Employees hired mid-month do NOT receive partial credit for that month
- Credits begin accruing after completing the first full month

### Regularization
- When an employee is regularized, their `regularizationDate` should be set
- Credits accrue from the regularization date forward

---

## Philippine Labor Law Compliance

This system implements Service Incentive Leave (SIL) per Article 95 of the Labor Code:
- Minimum 5 days per year (we provide 15 days - exceeds requirement)
- Applicable to employees with more than 6 months of service
- Supports both vacation and sick leave tracking

---

## Project Structure

```
├── app/
│   ├── (dashboard)/
│   │   ├── leave-credits/
│   │   │   └── page.tsx          # Leave credits dashboard UI
│   │   ├── leaves/
│   │   │   └── page.tsx          # Leave filing with balance display
│   │   └── employees/
│   │       └── page.tsx          # Employee form with status fields
│   └── api/
│       └── leave-credits/
│           ├── route.ts          # GET/POST leave credits
│           ├── balance/
│           │   └── route.ts      # GET balance
│           └── accrue/
│               └── route.ts      # POST monthly accrual
├── lib/
│   ├── leave-credits.ts          # Core accrual/balance/deduct functions
│   └── prisma.ts                 # Prisma client singleton
├── scripts/
│   └── run-leave-accrual.ts      # Standalone cron script
├── prisma/
│   └── schema.prisma             # Database schema with new models
└── docs/
    └── leave-credits/            # This documentation
```

---

## Quick Start

### 1. Regenerate Prisma Client

```bash
# Stop dev server first (Windows)
taskkill /F /PID <node_process_id>

# Regenerate types
npx prisma generate
```

### 2. Set Employee Status

Update existing employees to mark them as REGULAR:

**Via MongoDB:**
```javascript
db.employees.updateMany(
  { isActive: true },
  { $set: { employeeStatus: "REGULAR", regularizationDate: new Date() } }
)
```

**Via Employee Form:**
1. Go to `/employees`
2. Edit each employee
3. Set Employment Status to "Regular"
4. Set Regularization Date
5. Save

### 3. Run Initial Accrual

For employees who should have accrued credits:

```bash
npm run leave-accrual -- --year=2026 --month=1
npm run leave-accrual -- --year=2026 --month=2
npm run leave-accrual -- --year=2026 --month=3
```

### 4. Start Development Server

```bash
npm run dev
```

---

## Table of Contents

1. [Database Schema](./SCHEMA.md)
2. [API Endpoints](./API.md)
3. [Usage Guide](./USAGE.md)
4. [Setup & Deployment](./SETUP.md)

---

## Configuration

Located in `lib/leave-credits.ts`:

```typescript
const MONTHLY_ACCRUAL_DAYS = 1.25 // 15 days / 12 months
```

To change accrual rate:
```typescript
// For 10 days/year:
const MONTHLY_ACCRUAL_DAYS = 10 / 12 // ~0.83

// For 20 days/year:
const MONTHLY_ACCRUAL_DAYS = 20 / 12 // ~1.67
```

---

## Changelog

### 2026-03-22
- Initial implementation complete
- Added EmployeeStatus and regularizationDate to Employee model
- Created LeaveCredit and LeaveCreditTransaction models
- Implemented monthly accrual with race condition protection
- Built leave credits dashboard UI
- Integrated balance display in leave filing form
- Added employment status fields to employee form
- Created standalone accrual script for cron jobs
