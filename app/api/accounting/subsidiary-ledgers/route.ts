/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET subsidiary ledgers
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const entityCode = searchParams.get('entityCode');
    const branchId = searchParams.get('branchId');

    if (accountId) {
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

      // Get subsidiary ledgers with transactions
      const ledgers = await prisma.subsidiaryLedger.findMany({
        where: {
          accountId,
          ...(entityCode ? { entityCode } : {}),
          ...(branchId ? { branchId } : {}),
        },
        include: {
          transactions: true,
          _count: {
            select: { transactions: true },
          },
        },
        orderBy: { entityCode: 'asc' },
      });

      // Calculate reconciliation from transactions (not stored balance)
      const isCreditNormal = account.normalBalance === 'CREDIT';
      const ledgersWithBalance = ledgers.map(ledger => {
        const debitTotal = ledger.transactions.reduce((sum, t) => sum + t.debit, 0);
        const creditTotal = ledger.transactions.reduce((sum, t) => sum + t.credit, 0);
        const balance = isCreditNormal
          ? creditTotal - debitTotal
          : debitTotal - creditTotal;
        return {
          ...ledger,
          debitTotal,
          creditTotal,
          balance,
        };
      });

      const totalBalance = ledgersWithBalance.reduce((sum, ledger) => sum + ledger.balance, 0);

      // Get GL balance from journal lines
      const glBalance = await prisma.journalLine.aggregate({
        where: { accountId },
        _sum: { debit: true, credit: true },
      });

      const glTotal = isCreditNormal
        ? (glBalance._sum.credit || 0) - (glBalance._sum.debit || 0)
        : (glBalance._sum.debit || 0) - (glBalance._sum.credit || 0);

      return NextResponse.json({
        account,
        ledgers: ledgersWithBalance,
        reconciliation: {
          glBalance: Math.round(glTotal * 100) / 100,
          slBalance: Math.round(totalBalance * 100) / 100,
          difference: Math.round((glTotal - totalBalance) * 100) / 100,
          isBalanced: Math.abs(glTotal - totalBalance) < 0.01,
        },
      });
    } else {
      // Fetch all subsidiary ledgers if no accountId provided
      const ledgers = await prisma.subsidiaryLedger.findMany({
        where: { isActive: true, ...(branchId ? { branchId } : {}) },
        include: { account: true },
        orderBy: { entityName: 'asc' },
      });
      return NextResponse.json(ledgers);
    }
  } catch (error) {
    console.error('Error fetching subsidiary ledgers:', error);
    return NextResponse.json({ error: 'Failed to fetch subsidiary ledgers' }, { status: 500 });
  }
}

// CREATE a new subsidiary ledger entry (e.g., new customer, supplier)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId, entityCode, entityName, entityType, description, branchId } = body;

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
        branchId: branchId || undefined,
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
    const { id, entityName, description, isActive, branchId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Ledger ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      entityName,
      description,
      isActive,
    };
    if (branchId !== undefined) updateData.branchId = branchId;

    const ledger = await prisma.subsidiaryLedger.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(ledger);
  } catch (error) {
    console.error('Error updating subsidiary ledger:', error);
    return NextResponse.json({ error: 'Failed to update subsidiary ledger' }, { status: 500 });
  }
}
