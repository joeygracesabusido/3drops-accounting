/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payee, date, description, items, cashAccountId, isVatInclusive, noInputVat, ewtAccountId, ewtPercentage, branchId } = body;

    if (!payee || !items || items.length === 0 || !cashAccountId) {
      return NextResponse.json({ error: 'Missing required fields: payee, items, or cash account' }, { status: 400 });
    }

    const expenseNumber = `EXP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const itemTotal = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const computedNet = isVatInclusive ? itemTotal / 1.12 : itemTotal;
    const computedVat = isVatInclusive ? itemTotal - computedNet : itemTotal * 0.12;
    const ewtPercent = parseFloat(ewtPercentage) || 0;
    const computedEwt = computedNet * (ewtPercent / 100);
    const finalTotal = computedNet + computedVat;

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          date: new Date(date),
          payee,
          description,
          status: 'PENDING',
          totalAmount: finalTotal,
          branchId: branchId || undefined,
          items: {
            create: items.map((item: any) => ({
              description: item.description,
              amount: item.amount,
              accountId: item.accountId,
            }))
          }
        }
      });

      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(date),
          description: `Expense ${expenseNumber} - ${payee}`,
          reference: expenseNumber,
          branchId: branchId || undefined,
          lines: {
            create: [
              ...items.map((item: any) => ({
                accountId: item.accountId,
                debit: item.amount,
                credit: 0,
                memo: `Expense ${expenseNumber}: ${item.description}`,
              })),
            ]
          }
        }
      });

      if (computedVat > 0 && !noInputVat) {
        const inputVATAccount = await tx.account.findFirst({
          where: { code: '2320' },
        });
        if (inputVATAccount) {
          await tx.journalLine.create({
            data: {
              entryId: journalEntry.id,
              accountId: inputVATAccount.id,
              debit: computedVat,
              credit: 0,
              memo: `Expense ${expenseNumber} Input VAT`,
            },
          });
        }
      }

      if (ewtPercent > 0 && ewtAccountId) {
        await tx.journalLine.create({
          data: {
            entryId: journalEntry.id,
            accountId: ewtAccountId,
            debit: 0,
            credit: computedEwt,
            memo: `Expense ${expenseNumber} EWT`,
          },
        });
      }

      await tx.journalLine.create({
        data: {
          entryId: journalEntry.id,
          accountId: cashAccountId,
          debit: 0,
          credit: finalTotal - computedEwt,
          memo: `Payment for ${expenseNumber}`,
        },
      });

      await tx.expense.update({
        where: { id: expense.id },
        data: { journalEntryId: journalEntry.id }
      });

      return { expense, journalEntry };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const branchId = searchParams.get('branchId');

    const where: any = {};
    if (search) {
      where.OR = [
        { payee: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { expenseNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (branchId) {
      where.branchId = branchId;
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        items: true,
        journalEntry: {
          include: {
            lines: {
              include: { account: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, payee, date, description, items, totalAmount, cashAccountId, isVatInclusive, noInputVat, ewtAccountId, ewtPercentage, branchId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

    // Safeguard: treat empty string branchId as undefined (invalid ObjectId)
    const safeBranchId = (branchId && branchId !== '') ? branchId : undefined;

    // Only status update - simple case
    if (status && !payee && !date && !items && !cashAccountId) {
      const result = await prisma.$transaction(async (tx) => {
        const expense = await tx.expense.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!expense) {
          throw new Error('Expense not found');
        }

        if (status === 'VOID' && expense.journalEntryId) {
          await tx.journalEntry.update({
            where: { id: expense.journalEntryId },
            data: { status: 'VOID' },
          });
        }

        const updatedExpense = await tx.expense.update({
          where: { id },
          data: { status },
        });

        return updatedExpense;
      });

      return NextResponse.json(result);
    }

    // Full expense update - needs to cascade to Journal Entry
    const result = await prisma.$transaction(async (tx) => {
      const existingExpense = await tx.expense.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingExpense) {
        throw new Error('Expense not found');
      }

      if (!items || items.length === 0) {
        throw new Error('Expense must have at least one item');
      }

      if (!cashAccountId) {
        throw new Error('Cash/bank account is required');
      }

      const itemTotal = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
      const computedNet = isVatInclusive ? itemTotal / 1.12 : itemTotal;
      const computedVat = isVatInclusive ? itemTotal - computedNet : itemTotal * 0.12;
      const ewtPercent = parseFloat(ewtPercentage) || 0;
      const computedEwt = computedNet * (ewtPercent / 100);
      const finalTotal = computedNet + computedVat;

      if (totalAmount !== undefined && Math.abs(itemTotal - totalAmount) > 0.01) {
        throw new Error('Total amount does not match sum of items');
      }

      // Explicitly delete journal lines first, then journal entry
      // Cascade delete in MongoDB can be unreliable in serverless environments
      if (existingExpense.journalEntryId) {
        await tx.journalLine.deleteMany({
          where: { entryId: existingExpense.journalEntryId },
        });
        await tx.journalEntry.delete({
          where: { id: existingExpense.journalEntryId },
        });
      }

      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(date || existingExpense.date),
          description: `Expense ${existingExpense.expenseNumber} - ${payee || existingExpense.payee}`,
          reference: existingExpense.expenseNumber,
          branchId: safeBranchId,
          lines: {
            create: [
              ...items.map((item: any) => ({
                accountId: item.accountId,
                debit: item.amount,
                credit: 0,
                memo: `Expense ${existingExpense.expenseNumber}: ${item.description}`,
              })),
            ]
          }
        }
      });

      if (computedVat > 0 && !noInputVat) {
        const inputVATAccount = await tx.account.findFirst({
          where: { code: '2320' },
        });
        if (inputVATAccount) {
          await tx.journalLine.create({
            data: {
              entryId: journalEntry.id,
              accountId: inputVATAccount.id,
              debit: computedVat,
              credit: 0,
              memo: `Expense ${existingExpense.expenseNumber} Input VAT`,
            },
          });
        }
      }

      if (ewtPercent > 0 && ewtAccountId) {
        await tx.journalLine.create({
          data: {
            entryId: journalEntry.id,
            accountId: ewtAccountId,
            debit: 0,
            credit: computedEwt,
            memo: `Expense ${existingExpense.expenseNumber} EWT`,
          },
        });
      }

      await tx.journalLine.create({
        data: {
          entryId: journalEntry.id,
          accountId: cashAccountId,
          debit: 0,
          credit: finalTotal - computedEwt,
          memo: `Payment for ${existingExpense.expenseNumber}`,
        },
      });

      // Update the expense record with new data AND link the journal entry
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          ...(date && { date: new Date(date) }),
          ...(payee && { payee }),
          ...(description !== undefined && { description }),
          branchId: safeBranchId,
          totalAmount: finalTotal,
          journalEntryId: journalEntry.id,
          items: {
            deleteMany: {},
            create: items.map((item: any) => ({
              description: item.description,
              amount: item.amount,
              accountId: item.accountId,
            })),
          },
        },
        include: { items: true },
      });

      return updatedExpense;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Expenses PATCH] Error updating expense:', error);

    // Distinguish between client validation errors and server errors
    if (error instanceof Error && !('code' in error)) {
      const message = error.message || 'Failed to update expense';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Prisma / database errors are server-side (500)
    const message = error instanceof Error ? error.message : 'Failed to update expense';
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
