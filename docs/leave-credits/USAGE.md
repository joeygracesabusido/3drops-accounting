# Leave Credits Usage Guide

## For Employees

### Viewing Your Leave Balance

1. Navigate to **Leave Credits** in the sidebar (before "Leaves")
2. Your available vacation and sick leave balances are displayed at the top
3. When filing a leave request, your current balance is shown in the form

### Filing a Leave Request

1. Click **File Leave** button
2. Your available balance is displayed at the top of the form
3. Select leave type (Vacation, Sick, Emergency, etc.)
4. Fill in dates and reason
5. Submit request

**Note:** The system does not automatically block leave requests exceeding your balance. HR will verify during approval.

---

## For HR/Administrators

### Accessing Leave Credits Dashboard

1. Navigate to **Leave Credits** in the sidebar
2. View employee balances and transaction history
3. Filter by year using the dropdown

### Running Monthly Accrual

1. Go to **Leave Credits** page
2. Click **Run Monthly Accrual** button
3. Review the warning about affected employees
4. Confirm to process accrual

The system will:
- Accrue 1.25 days for all regular employees
- Skip probationary employees
- Skip employees hired mid-month
- Skip employees already accrued this month

### Manual Adjustment

To manually adjust an employee's leave balance:

1. Go to **Leave Credits** page
2. Filter to the specific employee
3. Use the API endpoint directly or update via database

```bash
# Example: Add 2 days to employee
curl -X POST /api/leave-credits \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "65f1234567890abcdef12300",
    "leaveType": "VACATION",
    "days": 2,
    "description": "Adjustment for project work"
  }'
```

### Setting Employee Status

When an employee is regularized:

1. Go to **Employees** page
2. Find the employee
3. Update their status to **REGULAR**
4. Set the **Regularization Date**

This ensures proper accrual calculation from the correct date.

---

## Leave Credit Calculations

### Monthly Accrual

```
Monthly Accrual = 15 days / 12 months = 1.25 days
```

### Available Balance

```
Available = Total Accrued - Days Used
```

### Example Calculation

| Month | Total Accrued | Days Used | Available |
|-------|---------------|-----------|-----------|
| Jan   | 1.25          | 0         | 1.25      |
| Feb   | 2.50          | 0         | 2.50      |
| Mar   | 3.75          | 1.0       | 2.75      |
| Apr   | 5.00          | 0         | 5.00      |
| ...   | ...           | ...       | ...       |
| Dec   | 15.00         | 3.0       | 12.00     |

---

## Transaction Types

| Type | Description | Who Can Create |
|------|-------------|----------------|
| `MONTHLY_ACCRUAL` | Auto-added monthly | System only |
| `ADJUSTMENT` | Manual HR change | Admin only |
| `USED` | Leave taken | System on approval |
| `CARRY_FORWARD` | Year-end rollover | System or Admin |
| `EXPIRED` | Unused days lost | System only |

---

## Common Scenarios

### Scenario 1: New Regular Employee

Employee hired January 15, regularized May 1:

| Month | Accrued? | Reason |
|-------|----------|--------|
| Jan   | No       | Probationary |
| Feb   | No       | Probationary |
| Mar   | No       | Probationary |
| Apr   | No       | Probationary |
| May   | Yes      | Regular, first full month |
| Jun   | Yes      | Regular |

### Scenario 2: Mid-Month Hire

Employee hired January 20:

| Month | Accrued? | Reason |
|-------|----------|--------|
| Jan   | No       | Hired mid-month |
| Feb   | Yes      | First full month |
| Mar   | Yes      | Regular accrual |

### Scenario 3: Employee Goes On Leave

Employee with 10 available days takes 5 days:

Before:
- Total: 12.5
- Used: 2.5
- Available: 10.0

After approval:
- Total: 12.5
- Used: 7.5
- Available: 5.0

Transaction recorded:
```
- Type: USED
- Days: -5.0
- Balance Before: 10.0
- Balance After: 5.0
```

---

## Viewing Transaction History

The transaction history shows a complete audit trail:

| Date | Type | Days | Balance | Description |
|------|------|------|---------|-------------|
| Jan 31 | MONTHLY_ACCRUAL | +1.25 | 1.25 | Monthly accrual for January 2026 |
| Feb 28 | MONTHLY_ACCRUAL | +1.25 | 2.50 | Monthly accrual for February 2026 |
| Mar 15 | USED | -1.00 | 1.50 | Leave used - Request ID: xxx |
| Mar 31 | MONTHLY_ACCRUAL | +1.25 | 2.75 | Monthly accrual for March 2026 |
