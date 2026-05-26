import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface AccountEntry {
  name: string;
  code: string;
  balance: number;
}

interface BalanceSheetReport {
  assets: AccountEntry[];
  liabilities: AccountEntry[];
  equity: AccountEntry[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netIncome: number;
  totalLiabilitiesEquity: number;
}

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
      include: { lines: entryIds ? {
        where: { entryId: { in: entryIds } }
      } : true },
      orderBy: { code: 'asc' },
    });

    const report: BalanceSheetReport = {
      assets: [],
      liabilities: [],
      equity: [],
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      netIncome: 0,
      totalLiabilitiesEquity: 0,
    };

    let totalRevenue = 0;
    let totalExpenses = 0;

    accounts.forEach(account => {
      const totalDebit = account.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.lines.reduce((sum, line) => sum + line.credit, 0);

      if (account.type === 'REVENUE') {
        totalRevenue += (totalCredit - totalDebit);
      } else if (account.type === 'EXPENSE') {
        totalExpenses += (totalDebit - totalCredit);
      } else {
        let balance = 0;
        if (account.type === 'ASSET') {
          balance = totalDebit - totalCredit;
          if (balance !== 0) {
            report.assets.push({ name: account.name, code: account.code, balance });
            report.totalAssets += balance;
          }
        } else if (account.type === 'LIABILITY') {
          balance = totalCredit - totalDebit;
          if (balance !== 0) {
            report.liabilities.push({ name: account.name, code: account.code, balance });
            report.totalLiabilities += balance;
          }
        } else if (account.type === 'EQUITY') {
          balance = totalCredit - totalDebit;
          if (balance !== 0) {
            report.equity.push({ name: account.name, code: account.code, balance });
            report.totalEquity += balance;
          }
        }
      }
    });

    report.netIncome = totalRevenue - totalExpenses;
    if (report.netIncome !== 0) {
      report.equity.push({ 
        name: 'Retained Earnings (Current Period)', 
        code: 'NET-INC', 
        balance: report.netIncome 
      });
      report.totalEquity += report.netIncome;
    }

    report.totalLiabilitiesEquity = report.totalLiabilities + report.totalEquity;

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    return NextResponse.json({ error: 'Failed to generate balance sheet' }, { status: 500 });
  }
}
