import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface ExpenseReportItem {
  date: string;
  reference: string;
  description: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface ExpenseAccountSummary {
  code: string;
  name: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  entries: ExpenseReportItem[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
    }
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const where: Record<string, unknown> = {
      type: 'EXPENSE',
    };

    const accounts = await prisma.account.findMany({
      where,
      include: {
        lines: {
          where: {
            entry: {
              branchId: branchId || undefined,
              ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
            },
          },
          include: {
            entry: {
              select: {
                id: true,
                date: true,
                reference: true,
                description: true,
              },
            },
          },
          orderBy: {
            entry: { date: 'desc' },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const report: ExpenseAccountSummary[] = [];
    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    for (const account of accounts) {
      const totalDebit = account.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.lines.reduce((sum, line) => sum + line.credit, 0);

      if (account.lines.length === 0) continue;

      const entries: ExpenseReportItem[] = account.lines.map((line) => ({
        date: line.entry.date.toISOString(),
        reference: line.entry.reference,
        description: line.entry.description,
        accountCode: account.code,
        accountName: account.name,
        debit: line.debit,
        credit: line.credit,
      }));

      report.push({
        code: account.code,
        name: account.name,
        totalDebit,
        totalCredit,
        balance: totalDebit - totalCredit,
        entries,
      });

      grandTotalDebit += totalDebit;
      grandTotalCredit += totalCredit;
    }

    return NextResponse.json({
      accounts: report,
      grandTotalDebit,
      grandTotalCredit,
      grandTotalBalance: grandTotalDebit - grandTotalCredit,
    });
  } catch (error) {
    console.error('Error generating expenses report:', error);
    return NextResponse.json({ error: 'Failed to generate expenses report' }, { status: 500 });
  }
}
