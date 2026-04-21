# Leave Credits API Endpoints

## Base URL

```
/api/leave-credits
```

## Authentication

All endpoints require authentication via cookie (`userEmail`). Admin endpoints require `role: ADMIN`.

---

## GET /api/leave-credits

Fetch leave credits with transaction history.

### Request

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `employeeId` | string | No | Filter by employee (Admin only) |
| `year` | number | No | Filter by year (default: current year) |

### Response

```json
[
  {
    "id": "65f1234567890abcdef12345",
    "employeeId": "65f1234567890abcdef12300",
    "leaveType": "VACATION",
    "totalDays": 12.5,
    "usedDays": 3.0,
    "availableDays": 9.5,
    "year": 2026,
    "transactions": [
      {
        "id": "65f1234567890abcdef12350",
        "type": "MONTHLY_ACCRUAL",
        "days": 1.25,
        "balanceBefore": 0,
        "balanceAfter": 1.25,
        "description": "Monthly accrual for January 2026",
        "createdAt": "2026-01-31T23:59:59Z"
      }
    ],
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-02-28T23:59:59Z"
  }
]
```

### Access Control

- **Admin**: Can view any employee's credits
- **Others**: Can only view their own credits

---

## POST /api/leave-credits

Manually adjust leave credits (Admin only).

### Request

```json
{
  "employeeId": "65f1234567890abcdef12300",
  "leaveType": "VACATION",
  "days": 2.5,
  "description": "Additional credit for project completion"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employeeId` | string | Yes | Employee to adjust |
| `leaveType` | string | Yes | VACATION or SICK |
| `days` | number | Yes | Amount (+ to add, - to deduct) |
| `description` | string | No | Reason for adjustment |

### Response

```json
{
  "id": "65f1234567890abcdef12345",
  "employeeId": "65f1234567890abcdef12300",
  "leaveType": "VACATION",
  "totalDays": 15.0,
  "usedDays": 3.0,
  "availableDays": 12.0,
  "year": 2026
}
```

### Access Control

- **Admin only**: Returns 403 for non-admin users

---

## GET /api/leave-credits/balance

Get simplified leave balance for an employee.

### Request

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `employeeId` | string | No | Filter by employee (Admin only) |
| `year` | number | No | Filter by year (default: current year) |

### Response

```json
{
  "employeeId": "65f1234567890abcdef12300",
  "year": 2026,
  "vacation": 9.5,
  "sick": 5.0
}
```

### Access Control

- **Admin**: Can view any employee's balance
- **Others**: Can only view their own balance

---

## POST /api/leave-credits/accrue

Run monthly leave accrual for all regular employees (Admin only).

### Request

```json
{
  "year": 2026,
  "month": 3
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `year` | number | No | Year to accrue (default: current year) |
| `month` | number | No | Month to accrue (default: current month) |

### Response

```json
{
  "message": "Accrual completed",
  "summary": {
    "total": 50,
    "successful": 48,
    "failed": 2
  },
  "details": [
    {
      "employeeId": "65f1234567890abcdef12300",
      "employeeName": "Juan Dela Cruz",
      "success": true,
      "accrued": 1.25
    },
    {
      "employeeId": "65f1234567890abcdef12301",
      "employeeName": "Maria Santos",
      "success": false,
      "accrued": 0,
      "error": "Employee is not regular"
    }
  ]
}
```

### Access Control

- **Admin only**: Returns 403 for non-admin users

### Business Rules Applied

The accrual process:
1. Only processes employees with `employeeStatus: REGULAR`
2. Only processes active employees (`isActive: true`)
3. Skips employees hired mid-month
4. Skips employees already accrued for this month

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error message description"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Not logged in |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error |

---

## TypeScript Types

### LeaveCredit

```typescript
interface LeaveCredit {
  id: string
  employeeId: string
  leaveType: string
  totalDays: number
  usedDays: number
  availableDays: number
  year: number
  transactions: LeaveCreditTransaction[]
  createdAt: Date
  updatedAt: Date
}
```

### LeaveCreditTransaction

```typescript
interface LeaveCreditTransaction {
  id: string
  leaveCreditId: string
  type: 'MONTHLY_ACCRUAL' | 'ADJUSTMENT' | 'USED' | 'CARRY_FORWARD' | 'EXPIRED'
  days: number
  balanceBefore: number
  balanceAfter: number
  description: string
  referenceId?: string
  createdAt: Date
}
```

### LeaveCreditBalance

```typescript
interface LeaveCreditBalance {
  employeeId: string
  year: number
  vacation: number
  sick: number
}
```
