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
    const branchId = searchParams.get('branchId');

    const where: Record<string, unknown> = {};
    if (id) where.id = id;
    if (pettyCashId) where.pettyCashId = pettyCashId;
    if (branchId) where.branchId = branchId;

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
    const { pettyCashId, disbursementId, amount, receipts, notes, expenseAccountId, date, branchId } = body;

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
        branchId: branchId || undefined,
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
    const { id, status: newStatus, approvedAmount, notes, branchId, amount, date, expenseAccountId: expenseAccountIdEdit } = body;

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

    const isEdit = amount !== undefined || date !== undefined || notes !== undefined || expenseAccountIdEdit !== undefined;

    if (liquidation.status === 'APPROVED') {
      // Retrying an approval must not duplicate the linked expense.
      if (!isEdit) {
        return NextResponse.json({ success: true, alreadyApproved: true });
      }

      const oldActual = liquidation.approvedAmount ?? liquidation.amount;
      const newActual = amount !== undefined ? Number(amount) : oldActual;
      const amountChanged = newActual !== oldActual;
      const balanceDelta = oldActual - newActual;

      if (balanceDelta < 0) {
        const fund = await prisma.pettyCash.findUnique({
          where: { id: liquidation.pettyCashId },
          select: { currentBalance: true },
        });
        if ((fund?.currentBalance ?? 0) + balanceDelta < 0) {
          return NextResponse.json({ error: 'Insufficient petty cash balance' }, { status: 400 });
        }
      }

      const editData: Record<string, unknown> = {};
      if (amountChanged) {
        editData.amount = newActual;
        editData.approvedAmount = newActual;
        editData.variance = 0;
      }
      if (date !== undefined) editData.date = date ? new Date(date) : null;
      if (notes !== undefined) editData.notes = notes;
      if (expenseAccountIdEdit !== undefined) editData.expenseAccountId = expenseAccountIdEdit || null;
      if (branchId !== undefined) editData.branchId = branchId;

      await prisma.$transaction(async (tx) => {
        await tx.pettyCashLiquidation.update({ where: { id }, data: editData });

        if (balanceDelta !== 0) {
          await tx.pettyCash.update({
            where: { id: liquidation.pettyCashId },
            data: { currentBalance: { increment: balanceDelta } },
          });
        }

        if (liquidation.journalEntryId) {
          if (amountChanged) {
            await tx.journalLine.updateMany({
              where: { entryId: liquidation.journalEntryId, debit: { gt: 0 } },
              data: { debit: newActual },
            });
            await tx.journalLine.updateMany({
              where: { entryId: liquidation.journalEntryId, credit: { gt: 0 } },
              data: { credit: newActual },
            });
            const linkedExpense = await tx.expense.findFirst({
              where: { journalEntryId: liquidation.journalEntryId },
            });
            if (linkedExpense) {
              await tx.expense.update({
                where: { id: linkedExpense.id },
                data: { totalAmount: newActual },
              });
              await tx.expenseItem.updateMany({
                where: { expenseId: linkedExpense.id },
                data: { amount: newActual },
              });
            }
          }
          if (date !== undefined) {
            await tx.expense.updateMany({
              where: { journalEntryId: liquidation.journalEntryId },
              data: { date: date ? new Date(date) : new Date() },
            });
          }
        }
      });

      return NextResponse.json({ success: true });
    }

    if (isEdit) {
      const editData: Record<string, unknown> = {};
      if (amount !== undefined) editData.amount = Number(amount);
      if (date !== undefined) editData.date = date ? new Date(date) : null;
      if (notes !== undefined) editData.notes = notes;
      if (expenseAccountIdEdit !== undefined) editData.expenseAccountId = expenseAccountIdEdit || null;
      if (branchId !== undefined) editData.branchId = branchId;

      await prisma.pettyCashLiquidation.update({ where: { id }, data: editData });
      return NextResponse.json({ success: true });
    }

    const userEmail = await getUserEmail();

    if (newStatus === 'APPROVED') {
      const actualAmount = approvedAmount ?? liquidation.amount;
      const variance = liquidation.amount - actualAmount;

      const liquidationUpdateData: Record<string, unknown> = {
        status: 'APPROVED',
        approvedAmount: actualAmount,
        variance,
        approvedBy: userEmail,
        approvedAt: new Date(),
      };
      if (branchId !== undefined) liquidationUpdateData.branchId = branchId;

      await prisma.$transaction([
        prisma.pettyCashLiquidation.update({
          where: { id },
          data: liquidationUpdateData,
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

      // Approved liquidations are expenses: write them to the expenses ledger the
      // /accounting/expenses page reads, linked to the same journal entry.
      const expenseNumber = `EXP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const expenseDescription = disbursement?.description || 'Petty cash liquidation';

      await prisma.$transaction(async (tx) => {
        let journalEntryId: string | undefined;

        if (expenseAccountId && cashAccountId) {
          const journalEntry = await tx.journalEntry.create({
            data: {
              date: new Date(),
              reference: `LIQ-${Date.now()}`,
              description: `Petty Cash Liquidation - ${expenseDescription}`,
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
          journalEntryId = journalEntry.id;
          await tx.pettyCashLiquidation.update({
            where: { id },
            data: { journalEntryId },
          });
        }

        await tx.expense.create({
          data: {
            expenseNumber,
            date: liquidation.date || new Date(),
            payee: disbursement?.payeeName || 'Petty Cash',
            description: expenseDescription,
            status: 'APPROVED',
            totalAmount: actualAmount,
            branchId: liquidation.branchId || undefined,
            journalEntryId,
            ...(expenseAccountId
              ? {
                  items: {
                    create: [
                      {
                        description: expenseDescription,
                        amount: actualAmount,
                        accountId: expenseAccountId,
                      },
                    ],
                  },
                }
              : {}),
          },
        });
      });
    } else if (newStatus === 'REJECTED') {
      const rejectedData: Record<string, unknown> = {
        status: 'REJECTED',
        notes,
      };
      if (branchId !== undefined) rejectedData.branchId = branchId;

      await prisma.pettyCashLiquidation.update({
        where: { id },
        data: rejectedData,
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