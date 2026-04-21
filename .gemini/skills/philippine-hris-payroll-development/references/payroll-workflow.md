# Payroll Generation Workflow

In this HRIS application, payroll follows these steps:

1. **Time Tracking**: Employees log their clock-in and clock-out via `TimeLog`.
2. **Overtime Application**: Employees file `OvertimeRequest` for extra hours.
3. **Overtime Approval**: **Admin** reviews and approves/rejects `OvertimeRequest`.
4. **Payroll Calculation**: `lib/payroll.ts` computes the payslip based on:
   - Monthly Basic Salary
   - Total Work Hours (from `TimeLog`)
   - Approved Overtime Hours (from `OvertimeRequest`)
   - Statutory Deductions (SSS, PhilHealth, Pag-IBIG)
5. **Payroll Review**: Admin reviews the drafted payroll and marks it as **APPROVED** or **PROCESSED**.

## Key Models

- `Employee`: Basic salary, frequency, and mandatory numbers.
- `TimeLog`: Daily attendance and basic hours.
- `OvertimeRequest`: Extra hours needing approval.
- `Payroll`: The final record for a specific month/year.
