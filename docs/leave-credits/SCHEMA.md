# Leave Credits Database Schema

## Overview

The leave credits system uses three main components:
1. **EmployeeStatus enum** - Tracks employee employment status
2. **LeaveCredit model** - Stores current balance per employee/year/type
3. **LeaveCreditTransaction model** - Audit trail for all changes

## New Enums

### EmployeeStatus

```prisma
enum EmployeeStatus {
  PROBATIONARY   // 6 months trial period
  REGULAR        // Permanently employed
}
```

### LeaveCreditType

```prisma
enum LeaveCreditType {
  MONTHLY_ACCRUAL    // Monthly accrual
  ADJUSTMENT         // Manual adjustment by HR
  USED               // Deducted when leave approved
  CARRY_FORWARD      // Year-end carry over
  EXPIRED            // Unused credits that expired
}
```

## Employee Model Updates

Two new fields added to the Employee model:

```prisma
employeeStatus       EmployeeStatus @default(PROBATIONARY)
regularizationDate   DateTime?     // Date when probationary became regular
```

### Field Descriptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `employeeStatus` | EmployeeStatus | PROBATIONARY | Current employment status |
| `regularizationDate` | DateTime | null | Date employee was regularized |

## LeaveCredit Model

Tracks leave balance for each employee per year and leave type.

```prisma
model LeaveCredit {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  employeeId    String   @db.ObjectId
  employee      Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  leaveType     String   @default("VACATION") // VACATION, SICK
  totalDays     Float    @default(0)         // Total accrued days
  usedDays      Float    @default(0)         // Days already used
  availableDays Float    @default(0)         // Available for use
  year          Int      // For yearly tracking
  
  transactions  LeaveCreditTransaction[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([employeeId, leaveType, year])
  @@index([employeeId])
  @@map("leavecredits")
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | ObjectId | Primary key |
| `employeeId` | ObjectId | Reference to Employee |
| `leaveType` | String | VACATION or SICK |
| `totalDays` | Float | Total days ever accrued |
| `usedDays` | Float | Days used (deducted) |
| `availableDays` | Float | Current available balance |
| `year` | Int | Calendar year for the credit |

### Constraints

- **Unique constraint**: `(employeeId, leaveType, year)` - One record per employee per leave type per year
- **Index**: `employeeId` for fast lookups

## LeaveCreditTransaction Model

Audit trail for all leave credit changes.

```prisma
model LeaveCreditTransaction {
  id            String          @id @default(auto()) @map("_id") @db.ObjectId
  leaveCreditId String          @db.ObjectId
  leaveCredit   LeaveCredit     @relation(fields: [leaveCreditId], references: [id], onDelete: Cascade)
  type          LeaveCreditType
  days          Float           // Positive for credit, negative for debit
  balanceBefore Float
  balanceAfter  Float
  description   String          // e.g., "Monthly accrual for January 2026"
  referenceId   String?         // LeaveRequest ID if type is USED
  createdAt     DateTime        @default(now())
  
  @@index([leaveCreditId])
  @@map("leavecredittransactions")
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | ObjectId | Primary key |
| `leaveCreditId` | ObjectId | Reference to LeaveCredit |
| `type` | LeaveCreditType | Transaction type |
| `days` | Float | Amount (+ for credit, - for debit) |
| `balanceBefore` | Float | Balance before this transaction |
| `balanceAfter` | Float | Balance after this transaction |
| `description` | String | Human-readable description |
| `referenceId` | String? | Related LeaveRequest ID |
| `createdAt` | DateTime | When transaction occurred |

### Transaction Types

| Type | Description | Days Value |
|------|-------------|------------|
| `MONTHLY_ACCRUAL` | Automatic monthly credit | +1.25 |
| `ADJUSTMENT` | Manual HR adjustment | + or - |
| `USED` | Leave approved and used | - (days taken) |
| `CARRY_FORWARD` | Year-end rollover | + or - |
| `EXPIRED` | Unused days expired | - (days lost) |

## Example Data

### Leave Credit Record
```json
{
  "id": "65f1234567890abcdef12345",
  "employeeId": "65f1234567890abcdef12300",
  "leaveType": "VACATION",
  "totalDays": 12.5,
  "usedDays": 3.0,
  "availableDays": 9.5,
  "year": 2026
}
```

### Transaction Records
```json
[
  {
    "id": "65f1234567890abcdef12350",
    "leaveCreditId": "65f1234567890abcdef12345",
    "type": "MONTHLY_ACCRUAL",
    "days": 1.25,
    "balanceBefore": 11.25,
    "balanceAfter": 12.5,
    "description": "Monthly accrual for February 2026",
    "createdAt": "2026-02-28T23:59:59Z"
  },
  {
    "id": "65f1234567890abcdef12351",
    "leaveCreditId": "65f1234567890abcdef12345",
    "type": "USED",
    "days": -3.0,
    "balanceBefore": 12.5,
    "balanceAfter": 9.5,
    "description": "Leave used - Request ID: 65f1234567890abcdef12340",
    "referenceId": "65f1234567890abcdef12340",
    "createdAt": "2026-03-15T10:30:00Z"
  }
]
```
