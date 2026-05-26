import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface AccountEntry {
  name: string;
  code: string;
  balance: number;
}

interface IncomeStatementReport {
  revenue: AccountEntry[];
  expenses: AccountEntry[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

/**
 * GAAP Income Statement
 * Formula: Revenue - Expenses = Net Income
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    let entryIds: string[] | undefined;
    if (branchId) {
      const entries = await prisma.journalEntry.findMany({
        where: { branchId },
        select: { id: true },
      });
      entryIds = entries.map(e => e.id);
    }

    const accounts = await prisma.account.findMany({
      where: {
        OR: [
          { type: 'REVENUE' },
          { type: 'EXPENSE' }
        ]
      },
      include: { lines: entryIds ? {
        where: { entryId: { in: entryIds } }
      } : true },
      orderBy: { code: 'asc' },
    });

    const report: IncomeStatementReport = {
      revenue: [],
      expenses: [],
      totalRevenue: 0,
      totalExpenses: 0,
      netIncome: 0,
    };

    accounts.forEach(account => {
      const totalDebit = account.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.lines.reduce((sum, line) => sum + line.credit, 0);
      
      let balance = 0;
      if (account.type === 'REVENUE') {
        balance = totalCredit - totalDebit; // Revenue increases with credit
        if (balance !== 0) {
          report.revenue.push({ name: account.name, code: account.code, balance });
          report.totalRevenue += balance;
        }
      } else if (account.type === 'EXPENSE') {
        balance = totalDebit - totalCredit; // Expense increases with debit
        if (balance !== 0) {
          report.expenses.push({ name: account.name, code: account.code, balance });
          report.totalExpenses += balance;
        }
      }
    });

    report.netIncome = report.totalRevenue - report.totalExpenses;

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating income statement:', error);
    return NextResponse.json({ error: 'Failed to generate income statement' }, { status: 500 });
  }
}
