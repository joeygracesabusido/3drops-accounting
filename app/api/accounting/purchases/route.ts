/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supplierId, supplierName, date, dueDate, items, totalAmount, expenseAccountId, apAccountId } = body;

    if (!supplierId || !supplierName || !items || items.length === 0 || !expenseAccountId || !apAccountId) {
      return NextResponse.json({ error: 'Missing required fields: supplier, items, expense account, or AP account' }, { status: 400 });
    }

    const billNumber = `BILL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Purchase Bill
      const bill = await tx.purchaseBill.create({
        data: {
          billNumber,
          date: new Date(date),
          dueDate: new Date(dueDate),
          supplierId,
          supplierName,
          status: 'UNPAID',
          totalAmount,
          items: {
            create: items.map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            }))
          }
        }
      });

      // 2. Create the corresponding Journal Entry (Double Entry)
      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(date),
          description: `Purchase Bill ${billNumber} - ${supplierName}`,
          reference: billNumber,
          lines: {
            create: [
              {
                accountId: expenseAccountId, // Debit Expense
                debit: totalAmount,
                credit: 0,
                memo: `Bill ${billNumber} Expense`,
              },
              {
                accountId: apAccountId, // Credit Accounts Payable
                debit: 0,
                credit: totalAmount,
                memo: `Bill ${billNumber} AP`,
              }
            ]
          }
        }
      });

      // 3. Link journal entry to bill
      await tx.purchaseBill.update({
        where: { id: bill.id },
        data: { journalEntryId: journalEntry.id }
      });

      return { bill, journalEntry };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating purchase bill:', error);
    return NextResponse.json({ error: 'Failed to create purchase bill' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const bills = await prisma.purchaseBill.findMany({
      include: { items: true },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(bills);
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }
}
