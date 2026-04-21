import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const account = await prisma.account.findUnique({
      where: { id },
      select: {
        normalBalance: true,
        name: true,
        code: true,
        type: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const lines = await prisma.journalLine.findMany({
      where: { accountId: id },
      include: {
        entry: {
          select: {
            date: true,
            description: true,
          },
        },
      },
      orderBy: {
        entry: {
          date: 'asc',
        },
      },
    });

    let runningBalance = 0;
    const transactions = lines.map(line => {
      if (account.normalBalance === 'DEBIT') {
        runningBalance += line.debit - line.credit;
      } else {
        runningBalance += line.credit - line.debit;
      }

      return {
        id: line.id,
        date: line.entry.date,
        description: line.entry.description,
        debit: line.debit,
        credit: line.credit,
        balance: runningBalance,
      };
    });

    return NextResponse.json({
      account,
      transactions,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error fetching account transactions:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
