import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
          status: 'POSTED',
        },
        select: { id: true },
      });
      entryIds = entries.map(e => e.id);
    } else {
      // When no filters, only get POSTED entries
      const entries = await prisma.journalEntry.findMany({
        where: { status: 'POSTED' },
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

      return {
        code: account.code,
        name: account.name,
        type: account.type,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
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