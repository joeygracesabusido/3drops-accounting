import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GAAP Trial Balance Report
 * Shows all accounts with their respective total debits and total credits.
 * In a balanced ledger, Total Debits MUST equal Total Credits.
 */
export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        lines: true,
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
