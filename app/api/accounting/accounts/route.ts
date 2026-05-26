/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

async function calculateAccountBalance(accountId: string, normalBalance: string, branchId?: string | null) {
  const where: { accountId: string; entry?: { branchId: string } } = {
    accountId,
  };
  if (branchId) {
    where.entry = { branchId };
  }

  const lines = await prisma.journalLine.findMany({
    where,
    select: { debit: true, credit: true },
  });

  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  // For debit-normal accounts (Assets, Expenses): Balance = Debits - Credits
  // For credit-normal accounts (Liabilities, Equity, Revenue): Balance = Credits - Debits
  const balance = normalBalance === 'DEBIT' ? totalDebit - totalCredit : totalCredit - totalDebit;
  return Math.round(balance * 100) / 100; // Round to 2 decimals
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const branchId = searchParams.get('branchId');

    if (id) {
      // Get single account with balance
      const account = await prisma.account.findUnique({
        where: { id },
      });

      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      const balance = await calculateAccountBalance(account.id, account.normalBalance, branchId);
      return NextResponse.json({ ...account, balance });
    }

    // Get all accounts
    const accounts = await prisma.account.findMany({
      orderBy: { code: 'asc' },
    });

    // Calculate balances for all accounts
    const accountsWithBalances = await Promise.all(
      accounts.map(async (account) => ({
        ...account,
        balance: await calculateAccountBalance(account.id, account.normalBalance, branchId),
      }))
    );

    return NextResponse.json(accountsWithBalances);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, name, type, parentCode, description, normalBalance, hasSubsidiaryLedger, subsidiaryType, beginningBalance } = body;

    if (!code || !name || !type) {
      return NextResponse.json({ error: 'Code, name, and type are required' }, { status: 400 });
    }

    // Use a transaction to ensure both account and beginning balance entry are created
    const account = await prisma.$transaction(async (tx) => {
      const newAccount = await tx.account.create({
        data: {
          code,
          name,
          type,
          parentCode,
          description,
          normalBalance: normalBalance || 'DEBIT',
          hasSubsidiaryLedger: hasSubsidiaryLedger || false,
          subsidiaryType: hasSubsidiaryLedger && subsidiaryType ? subsidiaryType : undefined,
        },
      });

      // Create beginning balance entry if balance is non-zero
      if (beginningBalance && beginningBalance !== 0) {
        const amount = Math.abs(beginningBalance);
        const isDebit = beginningBalance > 0;
        
        // Find Retained Earnings for balancing entry
        const retainedEarnings = await tx.account.findFirst({
          where: { name: 'Retained Earnings' }
        });

        if (retainedEarnings) {
          await tx.journalEntry.create({
            data: {
              date: new Date(),
              description: `Opening Balance for ${name}`,
              status: 'POSTED',
              lines: {
                create: [
                  {
                    accountId: newAccount.id,
                    debit: isDebit ? amount : 0,
                    credit: isDebit ? 0 : amount,
                    memo: 'Initial balance'
                  },
                  {
                    accountId: retainedEarnings.id,
                    debit: isDebit ? 0 : amount,
                    credit: isDebit ? amount : 0,
                    memo: `Offsetting entry for ${name} opening balance`
                  }
                ]
              }
            }
          });
        }
      }

      return newAccount;
    });

    return NextResponse.json(account);
  } catch (error) {
    if (error instanceof Error && (error as any).code === 'P2002') {
      return NextResponse.json({ error: 'Account code already exists' }, { status: 400 });
    }
    console.error('Error creating account:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, code, name, type, parentCode, description, isActive, normalBalance, hasSubsidiaryLedger, subsidiaryType } = body;

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        code,
        name,
        type,
        parentCode,
        description,
        isActive,
        normalBalance,
        hasSubsidiaryLedger,
        subsidiaryType: hasSubsidiaryLedger && subsidiaryType ? subsidiaryType : undefined,
      },
    });

    const balance = await calculateAccountBalance(account.id, account.normalBalance, null);
    return NextResponse.json({ ...account, balance });
  } catch (error) {
    if (error instanceof Error && (error as any).code === 'P2002') {
      return NextResponse.json({ error: 'Account code already exists' }, { status: 400 });
    }
    if (error instanceof Error && (error as any).code === 'P2025') {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    console.error('Error updating account:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}
