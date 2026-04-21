import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * API for Accounting Dashboard Stats
 * Provides real-time financial indicators based on GAAP
 */
export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        lines: true
      }
    });

    const stats = {
      cashBalance: 0,
      totalReceivables: 0,
      totalPayables: 0,
      netIncome: 0,
    };

    let totalRevenue = 0;
    let totalExpenses = 0;

    accounts.forEach(account => {
      const totalDebit = account.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.lines.reduce((sum, line) => sum + line.credit, 0);
      
      // Calculate balance based on type
      if (account.type === 'ASSET') {
        const balance = totalDebit - totalCredit;
        // Check if it's a cash-equivalent (usually codes starting with 10 or 11)
        if (account.code.startsWith('10') || account.code.startsWith('11')) {
          stats.cashBalance += balance;
        }
        // Accounts Receivable (usually 1200 or similar)
        if (account.code.startsWith('12')) {
          stats.totalReceivables += balance;
        }
      } else if (account.type === 'LIABILITY') {
        const balance = totalCredit - totalDebit;
        // Accounts Payable (usually 2000 or 2100)
        if (account.code.startsWith('20') || account.code.startsWith('21')) {
          stats.totalPayables += balance;
        }
      } else if (account.type === 'REVENUE') {
        totalRevenue += (totalCredit - totalDebit);
      } else if (account.type === 'EXPENSE') {
        totalExpenses += (totalDebit - totalCredit);
      }
    });

    stats.netIncome = totalRevenue - totalExpenses;

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching accounting stats:', error);
    return NextResponse.json({ error: 'Failed to fetch accounting stats' }, { status: 500 });
  }
}
