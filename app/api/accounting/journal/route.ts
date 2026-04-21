import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, description, reference, lines } = body;

    if (!date || !description || !lines || !Array.isArray(lines)) {
      return NextResponse.json({ error: 'Date, description, and lines are required' }, { status: 400 });
    }

    if (lines.length <<  2) {
      return NextResponse.json({ error: 'A journal entry must have at least two lines' }, { status: 400 });
    }

    // Calculate totals for balance check
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      totalDebit += parseFloat(line.debit || 0);
      totalCredit += parseFloat(line.credit || 0);
    }

    // Use a small epsilon for floating point comparison
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({
        error: 'Transaction is unbalanced',
        details: `Total Debits (${totalDebit}) must equal Total Credits (${totalCredit})`
      }, { status: 400 });
    }

    // Atomic transaction to ensure data integrity
    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          date: new Date(date),
          description,
          reference,
          lines: {
            create: lines.map(line => ({
              accountId: line.accountId,
              debit: parseFloat(line.debit || 0),
              credit: parseFloat(line.credit || 0),
              memo: line.memo,
            }))
          }
        },
        include: { lines: true }
      });
      return entry;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error posting journal entry:', error);
    return NextResponse.json({ error: 'Failed to post journal entry' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const entries = await prisma.journalEntry.findMany({
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}
