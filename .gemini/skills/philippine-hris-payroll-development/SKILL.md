---
name: philippine-hris-payroll-development
description: Expert guidance for developing and maintaining a Philippine HRIS payroll system. Use when implementing payroll calculations (SSS, PhilHealth, Pag-IBIG), overtime rules, or holiday pay logic.
---

# Philippine HRIS Payroll Development

This skill provides specialized knowledge and workflows for developing the payroll component of the HRIS Philippines application.

## Core Responsibilities

1. **Statutory Calculations**: Implement and update rates for SSS, PhilHealth, Pag-IBIG, and Withholding Tax.
2. **Overtime & Holiday Pay**: Apply the correct multipliers based on the Philippine Labor Code.
3. **Payroll Workflow**: Manage the transition from time logs and overtime requests to final payslips.

## References

- **[Statutory Rates](references/statutory-rates.md)**: SSS, PhilHealth, and Pag-IBIG contribution tables for 2026.
- **[Overtime & Holiday Rules](references/overtime-rules.md)**: Standard multipliers for overtime, rest days, and holidays.
- **[Payroll Workflow](references/payroll-workflow.md)**: The end-to-end process within this specific application.

## Key Instructions

### 1. Modifying Payroll Logic
- Always consult `lib/payroll.ts` first.
- Ensure any changes to calculations are reflected in the TypeScript interfaces in `types/index.ts`.
- When updating statutory rates, check if the change should apply only to the next payroll period or retroactively.

### 2. Handling Overtime
- **Wait for Approval**: Payroll should only include overtime hours from `OvertimeRequest` records with `status: 'APPROVED'`.
- **Ordinary OT**: Default rate is 1.25x.
- **Special Cases**: Use the [Overtime Rules](references/overtime-rules.md) reference for rest days and holidays.

### 3. Database Integrity
- Ensure `Payroll` records are linked correctly to `Employee` and the specific month/year.
- Use `npx prisma db push` if you add new fields to the `Payroll` or `TimeLog` models.

## Example Workflows

### "How do I calculate SSS for 2026?"
1. Refer to `references/statutory-rates.md` for the MSC brackets.
2. Implement the logic using the 15% total rate (5% employee, 10% employer).
3. Update the `calculateSSS` function in `lib/payroll.ts`.

### "Fix the holiday pay multiplier"
1. Identify the holiday type (Regular vs. Special).
2. Consult `references/overtime-rules.md`.
3. Locate the `OVERTIME_RATES` constant in `lib/payroll.ts` and apply the fix.
