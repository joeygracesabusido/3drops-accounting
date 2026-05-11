/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payee, date, description, items, totalAmount, cashAccountId, isVatInclusive, noInputVat, ewtAccountId, ewtPercentage, netAmount, vatAmount, ewtAmount } = body;

    if (!payee || !items || items.length === 0 || !cashAccountId) {
      return NextResponse.json({ error: 'Missing required fields: payee, items, or cash account' }, { status: 400 });
    }

    const expenseNumber = `EXP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const itemTotal = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const computedNet = isVatInclusive ? itemTotal / 1.12 : itemTotal;
    const computedVat = itemTotal - computedNet;
    const ewtPercent = parseFloat(ewtPercentage) || 0;
    const computedEwt = computedNet * (ewtPercent / 100);
    const finalTotal = isVatInclusive ? itemTotal : itemTotal * 1.12;

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          date: new Date(date),
          payee,
          description,
          status: 'PENDING',
          totalAmount: finalTotal,
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

    const expenses = await prisma.expense.findMany({
      where,
      include: { items: true },
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
    const { id, status, payee, date, description, items, totalAmount, cashAccountId, isVatInclusive, noInputVat, ewtAccountId, ewtPercentage, netAmount, vatAmount, ewtAmount } = body;

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

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
      const computedVat = itemTotal - computedNet;
      const ewtPercent = parseFloat(ewtPercentage) || 0;
      const computedEwt = computedNet * (ewtPercent / 100);
      const finalTotal = isVatInclusive ? itemTotal : itemTotal * 1.12;

      if (totalAmount !== undefined && Math.abs(itemTotal - totalAmount) > 0.01) {
        throw new Error('Total amount does not match sum of items');
      }

      // Delete old journal entry and create new one
      if (existingExpense.journalEntryId) {
        await tx.journalEntry.delete({
          where: { id: existingExpense.journalEntryId },
        });
      }

      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(date || existingExpense.date),
          description: `Expense ${existingExpense.expenseNumber} - ${payee || existingExpense.payee}`,
          reference: existingExpense.expenseNumber,
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

      // Update the expense record
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          ...(date && { date: new Date(date) }),
          ...(payee && { payee }),
          ...(description !== undefined && { description }),
          totalAmount: finalTotal,
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

      // Link journal entry
      await tx.expense.update({
        where: { id },
        data: { journalEntryId: journalEntry.id },
      });

      return updatedExpense;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating expense:', error);
    const message = error instanceof Error ? error.message : 'Failed to update expense';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
