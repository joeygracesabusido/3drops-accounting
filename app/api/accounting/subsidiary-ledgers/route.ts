/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET subsidiary ledgers for a specific control account
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const entityCode = searchParams.get('entityCode');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Get the control account info
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (!account.hasSubsidiaryLedger) {
      return NextResponse.json({ error: 'This account does not have a subsidiary ledger' }, { status: 400 });
    }

    // Get subsidiary ledgers with their transactions
    const ledgers = await prisma.subsidiaryLedger.findMany({
      where: {
        accountId,
        ...(entityCode ? { entityCode } : {}),
      },
      include: {
        _count: {
          select: { transactions: true },
        },
        transactions: {
          orderBy: { date: 'asc' },
          select: {
            id: true,
            date: true,
            referenceNo: true,
            description: true,
            debit: true,
            credit: true,
          },
        },
      },
      orderBy: { entityCode: 'asc' },
    });

    // Recalculate balances from transactions dynamically
    const recalculatedLedgers = ledgers.map(ledger => {
      const debitTotal = ledger.transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
      const creditTotal = ledger.transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
      const balance = debitTotal - creditTotal;
      
      return {
        ...ledger,
        debitTotal,
        creditTotal,
        balance,
      };
    });

    // Calculate reconciliation
    const totalBalance = recalculatedLedgers.reduce((sum, ledger) => sum + ledger.balance, 0);
    
    // Get GL balance from journal lines
    let glTotal = 0;
    try {
      const glBalance = await prisma.journalLine.aggregate({
        where: { accountId },
        _sum: { debit: true, credit: true },
      });
      glTotal = account.normalBalance === 'DEBIT' 
        ? (glBalance._sum.debit || 0) - (glBalance._sum.credit || 0)
        : (glBalance._sum.credit || 0) - (glBalance._sum.debit || 0);
    } catch (aggError) {
      console.error('Error calculating GL balance:', aggError);
      glTotal = 0;
    }

    return NextResponse.json({
      account,
      ledgers: recalculatedLedgers,
      reconciliation: {
        glBalance: Math.round(glTotal * 100) / 100,
        slBalance: Math.round(totalBalance * 100) / 100,
        difference: Math.round((glTotal - totalBalance) * 100) / 100,
        isBalanced: Math.abs(glTotal - totalBalance) < 0.01,
      },
    });
  } catch (error) {
    console.error('Error fetching subsidiary ledgers:', error);
    return NextResponse.json({ error: 'Failed to fetch subsidiary ledgers' }, { status: 500 });
  }
}

// CREATE a new subsidiary ledger entry (e.g., new customer, supplier)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId, entityCode, entityName, entityType, description } = body;

    if (!accountId || !entityCode || !entityName || !entityType) {
      return NextResponse.json({ error: 'accountId, entityCode, entityName, and entityType are required' }, { status: 400 });
    }

    // Verify account exists and has subsidiary ledger
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account || !account.hasSubsidiaryLedger) {
      return NextResponse.json({ error: 'Invalid account or account does not have subsidiary ledger' }, { status: 400 });
    }

    // Verify subsidiary type matches
    if (account.subsidiaryType && account.subsidiaryType !== entityType) {
      return NextResponse.json({ 
        error: `Entity type must be ${account.subsidiaryType}` 
      }, { status: 400 });
    }

    const ledger = await prisma.subsidiaryLedger.create({
      data: {
        accountId,
        entityCode,
        entityName,
        entityType: entityType as any,
        description,
      },
    });

    return NextResponse.json(ledger);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Entity code already exists for this account' }, { status: 400 });
    }
    console.error('Error creating subsidiary ledger:', error);
    return NextResponse.json({ error: 'Failed to create subsidiary ledger' }, { status: 500 });
  }
}

// UPDATE subsidiary ledger
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, entityName, description, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Ledger ID is required' }, { status: 400 });
    }

    const ledger = await prisma.subsidiaryLedger.update({
      where: { id },
      data: {
        entityName,
        description,
        isActive,
      },
    });

    return NextResponse.json(ledger);
  } catch (error) {
    console.error('Error updating subsidiary ledger:', error);
    return NextResponse.json({ error: 'Failed to update subsidiary ledger' }, { status: 500 });
  }
}

// DELETE subsidiary ledger
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Ledger ID is required' }, { status: 400 });
    }

    await prisma.subsidiaryLedger.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Subsidiary ledger not found' }, { status: 404 });
    }
    console.error('Error deleting subsidiary ledger:', error);
    return NextResponse.json({ error: 'Failed to delete subsidiary ledger' }, { status: 500 });
  }
}
