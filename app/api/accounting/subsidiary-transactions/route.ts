/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET transactions for a specific subsidiary ledger
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ledgerId = searchParams.get('ledgerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!ledgerId) {
      return NextResponse.json({ error: 'ledgerId is required' }, { status: 400 });
    }

    const where: any = { ledgerId };
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const transactions = await (prisma as any).subsidiaryTransaction.findMany({
      where,
      orderBy: { date: 'desc', createdAt: 'desc' },
      include: {
        ledger: true,
      },
    });

    // Calculate running balance
    let runningBalance = 0;
    const transactionsWithBalance = transactions.map((t: any) => {
      runningBalance = runningBalance + t.debit - t.credit;
      return {
        ...t,
        runningBalance: Math.round(runningBalance * 100) / 100,
      };
    });

    return NextResponse.json(transactionsWithBalance);
  } catch (error) {
    console.error('Error fetching subsidiary transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

// CREATE a new subsidiary transaction
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ledgerId, date, referenceNo, description, debit, credit } = body;

    if (!ledgerId || !date || !referenceNo || !description) {
      return NextResponse.json({ 
        error: 'ledgerId, date, referenceNo, and description are required' 
      }, { status: 400 });
    }

    if ((debit === undefined || debit === 0) && (credit === undefined || credit === 0)) {
      return NextResponse.json({ 
        error: 'Either debit or credit amount must be provided' 
      }, { status: 400 });
    }

    // Get ledger to check account type
    const ledger = await (prisma as any).subsidiaryLedger.findUnique({
      where: { id: ledgerId },
      include: { account: true },
    });

    if (!ledger) {
      return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });
    }

    const debitAmount = debit || 0;
    const creditAmount = credit || 0;

    // Create transaction
    const transaction = await (prisma as any).subsidiaryTransaction.create({
      data: {
        ledgerId,
        date: new Date(date),
        referenceNo,
        description,
        debit: debitAmount,
        credit: creditAmount,
      },
    });

    // Update subsidiary ledger running totals
    const updatedLedger = await (prisma as any).subsidiaryLedger.update({
      where: { id: ledgerId },
      data: {
        debitTotal: { increment: debitAmount },
        creditTotal: { increment: creditAmount },
        balance: {
          increment: ledger.account.normalBalance === 'DEBIT' 
            ? (debitAmount - creditAmount) 
            : (creditAmount - debitAmount),
        },
      },
    });

    return NextResponse.json({ transaction, ledger: updatedLedger });
  } catch (error: any) {
    console.error('Error creating subsidiary transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction', details: error.message }, { status: 500 });
  }
}

// GET all reconciliations for all control accounts
export async function GET() {
  try {
    // Get all control accounts with their ledgers and transactions
    const controlAccounts = await (prisma as any).account.findMany({
      where: { hasSubsidiaryLedger: true },
      include: {
        subsidiaryLedgers: {
          include: {
            transactions: true,
          },
        },
        lines: true,
      },
    });

    const reconciliations = [];

    for (const account of controlAccounts) {
      // Calculate SL total dynamically from transactions
      // For credit-normal accounts (liabilities, revenue), balance = credit - debit
      // For debit-normal accounts (assets, expenses), balance = debit - credit
      const isCreditNormal = account.normalBalance === 'CREDIT';
      let slTotal = 0;
      for (const ledger of account.subsidiaryLedgers) {
        const debitTotal = ledger.transactions.reduce((sum: number, t: any) => sum + (t.debit || 0), 0);
        const creditTotal = ledger.transactions.reduce((sum: number, t: any) => sum + (t.credit || 0), 0);
        const balance = isCreditNormal ? creditTotal - debitTotal : debitTotal - creditTotal;
        slTotal += balance;
      }
      
      // Calculate GL total
      const glDebit = account.lines.reduce((sum: number, l: any) => sum + (l.debit || 0), 0);
      const glCredit = account.lines.reduce((sum: number, l: any) => sum + (l.credit || 0), 0);
      const glTotal = account.normalBalance === 'DEBIT' ? glDebit - glCredit : glCredit - glDebit;

      reconciliations.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        glBalance: Math.round(glTotal * 100) / 100,
        slBalance: Math.round(slTotal * 100) / 100,
        difference: Math.round((glTotal - slTotal) * 100) / 100,
        isBalanced: Math.abs(glTotal - slTotal) < 0.01,
      });
    }

    return NextResponse.json({ reconciliations });
  } catch (error) {
    console.error('Error reconciling:', error);
    return NextResponse.json({ error: 'Failed to reconcile' }, { status: 500 });
  }
}
