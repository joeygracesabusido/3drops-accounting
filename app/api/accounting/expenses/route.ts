/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payee, date, description, items, totalAmount, cashAccountId } = body;

    if (!payee || !items || items.length === 0 || !cashAccountId) {
      return NextResponse.json({ error: 'Missing required fields: payee, items, or cash account' }, { status: 400 });
    }

    const expenseNumber = `EXP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Expense record
      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          date: new Date(date),
          payee,
          description,
          status: 'PENDING',
          totalAmount,
          items: {
            create: items.map((item: any) => ({
              description: item.description,
              amount: item.amount,
              accountId: item.accountId,
            }))
          }
        }
      });

      // 2. Create the corresponding Journal Entry (Double Entry)
      // Debit each expense item account, Credit the cash/bank account
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
              {
                accountId: cashAccountId, // Credit Cash/Bank
                debit: 0,
                credit: totalAmount,
                memo: `Payment for ${expenseNumber}`,
              }
            ]
          }
        }
      });

      // 3. Link journal entry to expense
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
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}
