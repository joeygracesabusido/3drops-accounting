/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId, customerName, date, dueDate, items, totalAmount, arAccountId, revenueAccountId } = body;

    if (!customerId || !customerName || !items || items.length === 0 || !arAccountId || !revenueAccountId) {
      return NextResponse.json({ error: 'Missing required fields: customer, items, AR account, or Revenue account' }, { status: 400 });
    }

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Sales Invoice
      const invoice = await tx.salesInvoice.create({
        data: {
          invoiceNumber,
          date: new Date(date),
          dueDate: new Date(dueDate),
          customerId,
          customerName,
          status: 'SENT',
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
          description: `Sales Invoice ${invoiceNumber} - ${customerName}`,
          reference: invoiceNumber,
          lines: {
            create: [
              {
                accountId: arAccountId, // Debit Accounts Receivable
                debit: totalAmount,
                credit: 0,
                memo: `Invoice ${invoiceNumber} AR`,
              },
              {
                accountId: revenueAccountId, // Credit Revenue
                debit: 0,
                credit: totalAmount,
                memo: `Invoice ${invoiceNumber} Revenue`,
              }
            ]
          }
        }
      });

      // 3. Link journal entry to invoice
      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: { journalEntryId: journalEntry.id }
      });

      return { invoice, journalEntry };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating sales invoice:', error);
    return NextResponse.json({ error: 'Failed to create sales invoice' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const invoices = await prisma.salesInvoice.findMany({
      include: { items: true },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}
