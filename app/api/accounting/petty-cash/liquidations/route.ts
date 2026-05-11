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
    const pettyCashId = searchParams.get('pettyCashId');

    const where: Record<string, unknown> = {};
    if (id) where.id = id;
    if (pettyCashId) where.pettyCashId = pettyCashId;

    const liquidations = await prisma.pettyCashLiquidation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const pettyCashIds = [...new Set(liquidations.map(l => l.pettyCashId))];
    const pettyCashes = await prisma.pettyCash.findMany({
      where: { id: { in: pettyCashIds } }
    });
    const pcMap = new Map(pettyCashes.map(pc => [pc.id, pc]));

    const result = liquidations.map(liq => ({
      ...liq,
      pettyCash: pcMap.get(liq.pettyCashId) || null
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching liquidations:', error);
    return NextResponse.json({ error: 'Failed to fetch liquidations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pettyCashId, disbursementId, amount, receipts, notes, expenseAccountId, date } = body;

    if (!pettyCashId || !disbursementId || !amount) {
      return NextResponse.json(
        { error: 'Petty cash, disbursement, and amount are required' },
        { status: 400 }
      );
    }

    const disbursement = await prisma.pettyCashDisbursement.findUnique({
      where: { id: disbursementId },
    });

    if (!disbursement) {
      return NextResponse.json(
        { error: 'Disbursement not found' },
        { status: 404 }
      );
    }

    if (disbursement.status === 'LIQUIDATED') {
      return NextResponse.json(
        { error: 'Disbursement already liquidated' },
        { status: 400 }
      );
    }

    const userEmail = await getUserEmail();
    const user = await prisma.user.findFirst({
      where: { email: userEmail },
      select: { id: true },
    });

    const liquidation = await prisma.pettyCashLiquidation.create({
      data: {
        pettyCashId,
        disbursementId,
        amount,
        date: date ? new Date(date) : new Date(),
        receipts: receipts || [],
        notes,
        expenseAccountId: expenseAccountId || disbursement.expenseAccountId,
        status: 'PENDING',
        submittedById: user?.id,
      },
    });

    await prisma.pettyCashDisbursement.update({
      where: { id: disbursementId },
      data: { status: 'LIQUIDATING' },
    });

    return NextResponse.json(liquidation);
  } catch (error) {
    console.error('Error creating liquidation:', error);
    return NextResponse.json({ error: 'Failed to create liquidation' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userRole = await getUserRole();
    if (userRole !== 'ADMIN' && userRole !== 'HR' && userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status: newStatus, approvedAmount, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const liquidation = await prisma.pettyCashLiquidation.findUnique({
      where: { id },
    });

    if (!liquidation) {
      return NextResponse.json(
        { error: 'Liquidation not found' },
        { status: 404 }
      );
    }

    const userEmail = await getUserEmail();

    if (newStatus === 'APPROVED') {
      const actualAmount = approvedAmount ?? liquidation.amount;
      const variance = liquidation.amount - actualAmount;

      await prisma.$transaction([
        prisma.pettyCashLiquidation.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedAmount: actualAmount,
            variance,
            approvedBy: userEmail,
            approvedAt: new Date(),
          },
        }),
        prisma.pettyCashDisbursement.update({
          where: { id: liquidation.disbursementId },
          data: { status: 'LIQUIDATED' },
        }),
      ]);

      if (variance > 0) {
        await prisma.pettyCash.update({
          where: { id: liquidation.pettyCashId },
          data: { currentBalance: { increment: variance } },
        });
      }

      const pettyCash = await prisma.pettyCash.findUnique({
        where: { id: liquidation.pettyCashId }
      });
      const disbursement = await prisma.pettyCashDisbursement.findUnique({
        where: { id: liquidation.disbursementId }
      });

      const expenseAccountId = liquidation.expenseAccountId;
      const cashAccountId = pettyCash?.cashAccountId;

      if (expenseAccountId && cashAccountId) {
        await prisma.journalEntry.create({
          data: {
            date: new Date(),
            reference: `LIQ-${Date.now()}`,
            description: `Petty Cash Liquidation - ${disbursement?.description || 'Disbursement'}`,
            status: 'POSTED',
            lines: {
              create: [
                {
                  accountId: expenseAccountId,
                  debit: actualAmount,
                  credit: 0,
                  memo: `Liquidation of disbursement`,
                },
                {
                  accountId: cashAccountId,
                  debit: 0,
                  credit: actualAmount,
                  memo: `Petty cash expenditure`,
                },
              ],
            },
          },
        });
      }
    } else if (newStatus === 'REJECTED') {
      await prisma.pettyCashLiquidation.update({
        where: { id },
        data: {
          status: 'REJECTED',
          notes,
        },
      });

      await prisma.pettyCashDisbursement.update({
        where: { id: liquidation.disbursementId },
        data: { status: 'PENDING' },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing liquidation:', error);
    return NextResponse.json({ error: 'Failed to process liquidation' }, { status: 500 });
  }
}