import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payrollId, branchId } = body;

    if (!payrollId) {
      return NextResponse.json({ error: 'Payroll ID is required' }, { status: 400 });
    }

    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
    });

    if (!payroll) {
      return NextResponse.json({ error: 'Payroll not found' }, { status: 404 });
    }

    // Find necessary accounts for payroll posting
    // In a real system, these would be configurable in a 'Settings' table
    const salaryExpenseAcc = await prisma.account.findFirst({
      where: { name: { contains: 'Salary' }, type: 'EXPENSE' },
    });
    const cashAcc = await prisma.account.findFirst({
      where: { name: { contains: 'Cash' }, type: 'ASSET' },
    });
    const sssLiabilityAcc = await prisma.account.findFirst({
      where: { name: { contains: 'SSS' }, type: 'LIABILITY' },
    });
    const taxLiabilityAcc = await prisma.account.findFirst({
      where: { name: { contains: 'Tax' }, type: 'LIABILITY' },
    });

    if (!salaryExpenseAcc || !cashAcc) {
      return NextResponse.json({ error: 'Required accounting accounts (Salary Expense, Cash) not found in COA' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Journal Entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          date: payroll.processedAt || new Date(),
          description: `Payroll Posting - ${payroll.month}/${payroll.year} - ${payroll.employeeId}`,
          reference: `PAY-${payroll.id.slice(-6)}`,
          branchId: branchId || undefined,
          lines: {
            create: [
              // Debit Salary Expense (Gross Pay)
              {
                accountId: salaryExpenseAcc.id,
                debit: payroll.grossPay,
                credit: 0,
                memo: 'Gross Salary Expense',
              },
              // Credit Cash (Net Pay)
              {
                accountId: cashAcc.id,
                debit: 0,
                credit: payroll.netPay,
                memo: 'Net Pay Disbursement',
              },
              // Credit SSS Liability
              {
                accountId: sssLiabilityAcc?.id || cashAcc.id, // Fallback to cash if not found
                debit: 0,
                credit: payroll.sssEmployee,
                memo: 'SSS Employee Contribution',
              },
              // Credit Tax Liability
              {
                accountId: taxLiabilityAcc?.id || cashAcc.id,
                debit: 0,
                credit: payroll.withholdingTax,
                memo: 'Withholding Tax Payable',
              },
              // Credit other deductions
              {
                accountId: sssLiabilityAcc?.id || cashAcc.id,
                debit: 0,
                credit: payroll.totalDeductions - (payroll.sssEmployee + payroll.withholdingTax),
                memo: 'Other Statutory Deductions',
              },
            ].filter(line => (line.debit !== 0 || line.credit !== 0))
          }
        }
      });

      return journalEntry;
    });

    return NextResponse.json({ message: 'Payroll posted to general ledger', journalEntryId: result.id });
  } catch (error) {
    console.error('Error posting payroll to ledger:', error);
    return NextResponse.json({ error: 'Failed to post payroll to ledger' }, { status: 500 });
  }
}
