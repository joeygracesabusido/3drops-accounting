# Philippine HRIS & Payroll Standards Reference

This document serves as the official reference for payroll calculations and HR logic within this system to ensure compliance with Philippine Labor Laws.

## 1. Holiday Pay Calculation
Calculations based on the Department of Labor and Employment (DOLE) standards.

| Holiday Type | Worked | Not Worked | Calculation (if worked) |
| :--- | :---: | :---: | :--- |
| **Regular Holiday** | Yes | Yes | 200% of daily rate |
| **Special Non-Working Day** | Yes | No | 130% of daily rate |
| **Special Working Day** | Yes | N/A | 130% of daily rate |

- **Regular Holiday (Not Worked):** Employee is paid 100% of their daily rate, provided they worked or were on leave with pay on the working day immediately preceding the holiday.
- **Special Holiday (Not Worked):** "No work, no pay" applies unless company policy states otherwise.

## 2. Mandatory Contributions (Statutory)
All calculations must follow the current contribution tables for:
- **SSS (Social Security System):** Based on the monthly salary credit.
- **PhilHealth:** Percentage-based contribution shared between employee and employer.
- **Pag-IBIG (HDMF):** Fixed monthly contribution (usually ₱100-₱200 employee share).

## 3. Taxation (TRAIN Law)
- Withholding tax must follow the current **TRAIN Law** graduated tax tables.
- Non-taxable income includes mandatory contributions (SSS, PhilHealth, Pag-IBIG) and 13th-month pay/bonuses up to ₱90,000.

## 4. Overtime and Premiums
- **Ordinary Overtime:** 125% of the hourly rate.
- **Night Differential:** Additional 10% of the hourly rate for work performed between 10:00 PM and 6:00 AM.
- **Holiday Overtime:** Combined multipliers (e.g., Regular Holiday + Overtime = 200% * 1.3).

## 5. 13th Month Pay
- **Mandatory:** Must be paid to all rank-and-file employees who have worked for at least one month during the calendar year.
- **Formula:** Total basic salary earned during the year / 12.
- **Deadline:** Must be paid no later than December 24.

## 6. Leave Credits (Standard Practice)
- **Service Incentive Leave (SIL):** 5 days of leave with pay for employees with at least one year of service.
- **Sick/Vacation Leave:** Based on company policy, typically accrued monthly.

---
*Note: This document is a technical reference for the codebase. For official legal advice, refer to DOLE guidelines.*
