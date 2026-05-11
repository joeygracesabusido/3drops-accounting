'use strict';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

async function getUserRole() {
  const cookieStore = await cookies();
  return cookieStore.get('userRole')?.value || '';
}

async function getUserEmail() {
  const cookieStore = await cookies();
  return cookieStore.get('userEmail')?.value || '';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (id) where.id = id;
    if (status) where.status = status;

    const pettyCash = await prisma.pettyCash.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(pettyCash);
  } catch (error) {
    console.error('Error fetching petty cash:', error);
    return NextResponse.json({ error: 'Failed to fetch petty cash' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userRole = await getUserRole();
    if (userRole !== 'ADMIN' && userRole !== 'HR' && userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, fundAmount, custodianId, cashAccountId, expenseAccountId, description } = body;

    if (!name || !fundAmount || !cashAccountId) {
      return NextResponse.json(
        { error: 'Name, fund amount, and cash account are required' },
        { status: 400 }
      );
    }

    const userEmail = await getUserEmail();

    const user = await prisma.user.findFirst({
      where: { email: userEmail },
      select: { id: true },
    });

    // Use default expense account if not provided (5270 - Office Expenses or find any expense account)
    let finalExpenseAccountId = expenseAccountId;
    if (!finalExpenseAccountId) {
      const defaultExpense = await prisma.account.findFirst({
        where: { code: { startsWith: '5' } },
        orderBy: { code: 'asc' },
      });
      finalExpenseAccountId = defaultExpense?.id;
    }

    const pettyCash = await prisma.pettyCash.create({
      data: {
        name,
        fundAmount,
        currentBalance: fundAmount,
        cashAccountId,
        expenseAccountId: finalExpenseAccountId || null,
        custodianId: custodianId || null,
        description,
        createdById: user?.id,
        status: 'ACTIVE',
      },
    });

    if (finalExpenseAccountId) {
      try {
        await prisma.journalEntry.create({
          data: {
            date: new Date(),
            reference: `PCF-${Date.now()}`,
            description: `Petty Cash Fund - ${name}`,
            status: 'POSTED',
            lines: {
              create: [
                {
                  accountId: cashAccountId,
                  debit: fundAmount,
                  credit: 0,
                  memo: `Petty Cash Fund - ${name}`,
                },
                {
                  accountId: finalExpenseAccountId,
                  debit: 0,
                  credit: fundAmount,
                  memo: `Establish petty cash fund`,
                },
              ],
            },
          },
        });
      } catch (jeError) {
        console.error('Error creating journal entry for petty cash:', jeError);
      }
    }

    return NextResponse.json(pettyCash);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating petty cash fund:', error);
    return NextResponse.json({ 
      error: 'Failed to create petty cash fund', 
      details: errorMessage,
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userRole = await getUserRole();
    if (userRole !== 'ADMIN' && userRole !== 'HR' && userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, fundAmount, custodianId, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (fundAmount) {
      updateData.fundAmount = fundAmount;
      updateData.currentBalance = fundAmount;
    }
    if (custodianId) updateData.custodianId = custodianId;
    if (status) updateData.status = status;

    const pettyCash = await prisma.pettyCash.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(pettyCash);
  } catch (error) {
    console.error('Error updating petty cash:', error);
    return NextResponse.json({ error: 'Failed to update petty cash' }, { status: 500 });
  }
}