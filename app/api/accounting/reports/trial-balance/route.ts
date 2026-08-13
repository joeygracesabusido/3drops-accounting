import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GAAP Trial Balance Report
 * Shows all accounts with their respective total debits and total credits.
 * In a balanced ledger, Total Debits MUST equal Total Credits.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const endDate = searchParams.get('endDate');

    const dateFilter: { lte?: Date } = {};
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    let entryIds: string[] | undefined;
    if (branchId || Object.keys(dateFilter).length > 0) {
      const entries = await prisma.journalEntry.findMany({
        where: {
          branchId: branchId || undefined,
          date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
        },
        select: { id: true },
      });
      entryIds = entries.map(e => e.id);
    }

    const accounts = await prisma.account.findMany({
      include: {
        lines: entryIds ? {
          where: { entryId: { in: entryIds } }
        } : true,
      },
      orderBy: { code: 'asc' },
    });

    const trialBalance = accounts.map(account => {
      const totalDebit = account.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.lines.reduce((sum, line) => sum + line.credit, 0);

      // The Trial Balance shows the net position of each account
      // Assets/Expenses usually have Debit balances
      // Liabilities/Equity/Revenue usually have Credit balances
      let debitBalance = 0;
      let creditBalance = 0;

      const net = totalDebit - totalCredit;

      if (account.type === 'ASSET' || account.type === 'EXPENSE') {
        if (net >= 0) debitBalance = net;
        else creditBalance = Math.abs(net);
      } else {
        const netCredit = totalCredit - totalDebit;
        if (netCredit >= 0) creditBalance = netCredit;
        else debitBalance = Math.abs(netCredit);
      }

      return {
        code: account.code,
        name: account.name,
        type: account.type,
        totalDebit: debitBalance,
        totalCredit: creditBalance,
      };
    }).filter(acc => acc.totalDebit !== 0 || acc.totalCredit !== 0);

    const grandTotalDebit = trialBalance.reduce((sum, acc) => sum + acc.totalDebit, 0);
    const grandTotalCredit = trialBalance.reduce((sum, acc) => sum + acc.totalCredit, 0);

    return NextResponse.json({
      data: trialBalance,
      grandTotalDebit,
      grandTotalCredit,
      isBalanced: Math.abs(grandTotalDebit - grandTotalCredit) < 0.01
    });
  } catch (error) {
    console.error('Error generating trial balance:', error);
    return NextResponse.json({ error: 'Failed to generate trial balance' }, { status: 500 });
  }
}