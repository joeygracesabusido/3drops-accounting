/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supplierId, supplierName, date, dueDate, items, totalAmount, expenseAccountId, apAccountId, isVatInclusive, noInputVat } = body;

    if (!supplierId || !supplierName || !items || items.length === 0 || !expenseAccountId || !apAccountId) {
      return NextResponse.json({ error: 'Missing required fields: supplier, items, expense account, or AP account' }, { status: 400 });
    }

    const billNumber = `BILL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const netAmount = isVatInclusive ? totalAmount / 1.12 : totalAmount;
    const vatAmount = totalAmount - netAmount;

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
              quantity: parseFloat(item.quantity) || 0,
              unitPrice: parseFloat(item.unitPrice) || 0,
              total: parseFloat(item.total) || 0,
            }))
          }
        }
      });

      // 2. Create the corresponding Journal Entry (Double Entry)
      const journalEntryData: any = {
        date: new Date(date),
        description: `Purchase Bill ${billNumber} - ${supplierName}`,
        reference: billNumber,
        lines: {
          create: [
            {
              accountId: expenseAccountId,
              debit: netAmount,
              credit: 0,
              memo: `Bill ${billNumber} Expense`,
            },
          ],
        },
      };

      if (vatAmount > 0 && !noInputVat) {
        const inputVatAccount = await tx.account.findFirst({
          where: { code: '2320' },
        });

        if (inputVatAccount) {
          journalEntryData.lines.create.push({
            accountId: inputVatAccount.id,
            debit: vatAmount,
            credit: 0,
            memo: `Bill ${billNumber} Input VAT`,
          });
        }
      }

      journalEntryData.lines.create.push({
        accountId: apAccountId,
        debit: 0,
        credit: totalAmount,
        memo: `Bill ${billNumber} AP`,
      });

      const journalEntry = await tx.journalEntry.create({
        data: journalEntryData,
      });

      // 3. Link journal entry to bill
      await tx.purchaseBill.update({
        where: { id: bill.id },
        data: { journalEntryId: journalEntry.id }
      });

      // 4. Create SubsidiaryTransaction for the supplier's ledger
      const supplierLedger = await tx.subsidiaryLedger.findFirst({
        where: {
          entityType: 'SUPPLIER',
          entityName: supplierName,
          accountId: apAccountId,
        },
      });

      if (supplierLedger) {
        await tx.subsidiaryTransaction.create({
          data: {
            ledgerId: supplierLedger.id,
            date: new Date(date),
            referenceNo: billNumber,
            description: `Purchase Bill ${billNumber} - ${supplierName}`,
            debit: 0,
            credit: totalAmount,
            journalEntryId: journalEntry.id,
          },
        });
      }

      return { bill, journalEntry, netAmount, vatAmount };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating purchase bill:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    return NextResponse.json({ error: `Failed to create purchase bill: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { supplierId, supplierName, date, dueDate, items, totalAmount, expenseAccountId, apAccountId, isVatInclusive, noInputVat } = body;

    if (!supplierId || !supplierName || !items || items.length === 0 || !expenseAccountId || !apAccountId) {
      return NextResponse.json({ error: 'Missing required fields: supplier, items, expense account, or AP account' }, { status: 400 });
    }

    // Fetch existing bill with items, then fetch journal entry separately
    const existingBill = await prisma.purchaseBill.findUnique({
      where: { id },
      include: { items: true },
    });

    let existingJE = null;
    if (existingBill?.journalEntryId) {
      existingJE = await prisma.journalEntry.findUnique({
        where: { id: existingBill.journalEntryId },
        include: { lines: true },
      });
    }

    if (!existingBill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Only allow editing unpaid bills
    if (existingBill.status !== 'UNPAID') {
      return NextResponse.json({ error: 'Only unpaid bills can be edited' }, { status: 400 });
    }

    const netAmount = isVatInclusive ? totalAmount / 1.12 : totalAmount;
    const vatAmount = totalAmount - netAmount;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update the Purchase Bill
      const updatedBill = await tx.purchaseBill.update({
        where: { id },
        data: {
          date: new Date(date),
          dueDate: new Date(dueDate),
          supplierId,
          supplierName,
          totalAmount,
        },
      });

      // 2. Delete old items and create new ones
      await tx.purchaseBillItem.deleteMany({
        where: { billId: id },
      });

      if (items.length > 0) {
        await tx.purchaseBillItem.createMany({
          data: items.map((item: any) => ({
            billId: id,
            description: item.description,
            quantity: parseFloat(item.quantity) || 0,
            unitPrice: parseFloat(item.unitPrice) || 0,
            total: parseFloat(item.total) || 0,
          })),
        });
      }

      // 3. Delete old journal entry (cascade will handle lines)
      if (existingBill.journalEntryId) {
        await tx.journalEntry.delete({
          where: { id: existingBill.journalEntryId },
        });
      }

      // 4. Create new journal entry with updated amounts
      const journalEntryData: any = {
        date: new Date(date),
        description: `Purchase Bill ${existingBill.billNumber} - ${supplierName}`,
        reference: existingBill.billNumber,
        lines: {
          create: [
            {
              accountId: expenseAccountId,
              debit: netAmount,
              credit: 0,
              memo: `Bill ${existingBill.billNumber} Expense`,
            },
          ],
        },
      };

      if (vatAmount > 0 && !noInputVat) {
        const inputVatAccount = await tx.account.findFirst({
          where: { code: '2320' },
        });

        if (inputVatAccount) {
          journalEntryData.lines.create.push({
            accountId: inputVatAccount.id,
            debit: vatAmount,
            credit: 0,
            memo: `Bill ${existingBill.billNumber} Input VAT`,
          });
        }
      }

      journalEntryData.lines.create.push({
        accountId: apAccountId,
        debit: 0,
        credit: totalAmount,
        memo: `Bill ${existingBill.billNumber} AP`,
      });

      const journalEntry = await tx.journalEntry.create({
        data: journalEntryData,
      });

      // 5. Link journal entry to bill
      await tx.purchaseBill.update({
        where: { id },
        data: { journalEntryId: journalEntry.id },
      });

      // 6. Delete old subsidiary transactions for this bill
      await tx.subsidiaryTransaction.deleteMany({
        where: {
          referenceNo: existingBill.billNumber,
        },
      });

      // 7. Create new subsidiary transaction for the supplier's ledger
      const supplierLedger = await tx.subsidiaryLedger.findFirst({
        where: {
          entityType: 'SUPPLIER',
          entityName: supplierName,
          accountId: apAccountId,
        },
      });

      if (supplierLedger) {
        await tx.subsidiaryTransaction.create({
          data: {
            ledgerId: supplierLedger.id,
            date: new Date(date),
            referenceNo: existingBill.billNumber,
            description: `Purchase Bill ${existingBill.billNumber} - ${supplierName}`,
            debit: 0,
            credit: totalAmount,
            journalEntryId: journalEntry.id,
          },
        });
      }

      return { bill: updatedBill, journalEntry, netAmount, vatAmount };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating purchase bill:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    return NextResponse.json({ error: `Failed to update purchase bill: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
}

export async function GET() {
  try {
    const bills = await prisma.purchaseBill.findMany({
      include: { items: true },
      orderBy: { date: 'desc' },
    });

    // Fetch journal entries and their lines for each bill
    const billsWithJE = await Promise.all(
      bills.map(async (bill) => {
        if (!bill.journalEntryId) {
          return { ...bill, journalEntry: null };
        }
        const je = await prisma.journalEntry.findUnique({
          where: { id: bill.journalEntryId },
          include: { lines: { include: { account: true } } },
        });
        return { ...bill, journalEntry: je || null };
      })
    );

    return NextResponse.json(billsWithJE);
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }
}
