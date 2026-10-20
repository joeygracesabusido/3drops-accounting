/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { retryableTransaction } from '@/lib/prisma-transaction';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId, customerName, date, dueDate, items, totalAmount, arAccountId, revenueAccountId, branchId, isAcknowledgementReceipt } = body;

    const isAR = Boolean(isAcknowledgementReceipt);

    if (!customerId || !customerName || !items || items.length === 0 || !arAccountId || (!isAR && !revenueAccountId)) {
      return NextResponse.json({ error: isAR ? 'Missing required fields: customer, items, or AR account' : 'Missing required fields: customer, items, AR account, or Revenue account' }, { status: 400 });
    }

    const prefix = isAR ? 'AR' : 'INV';
    const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await retryableTransaction(async (tx) => {
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
          isAcknowledgementReceipt: isAR,
          branchId: branchId || undefined,
          items: {
            create: items.map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            }))
          }
        } as any
      });

      // 2. Create the corresponding Journal Entry (Double Entry)
      // For AR-only (Acknowledgement Receipt), we still create a journal but mark it as AR
      // and skip revenue recognition — both sides use AR account pattern if revenue not provided.
      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(date),
          description: isAR ? `Acknowledgement Receipt ${invoiceNumber} - ${customerName}` : `Sales Invoice ${invoiceNumber} - ${customerName}`,
          reference: invoiceNumber,
          branchId: branchId || undefined,
          lines: {
            create: isAR && !revenueAccountId
              ? [
                  {
                    accountId: arAccountId, // Debit AR (or Cash if mapped to AR)
                    debit: totalAmount,
                    credit: 0,
                    memo: `AR ${invoiceNumber} Acknowledgement Receipt`,
                  },
                  {
                    // For AR-only without revenue, credit same AR as offset and mark as AR-only
                    // This keeps books balanced while flagging as non-revenue; alternatively, use revenue if provided
                    accountId: arAccountId,
                    debit: 0,
                    credit: totalAmount,
                    memo: `AR ${invoiceNumber} Acknowledgement Receipt - pending revenue`,
                  }
                ]
              : [
                  {
                    accountId: arAccountId, // Debit Accounts Receivable
                    debit: totalAmount,
                    credit: 0,
                    memo: `Invoice ${invoiceNumber} AR${isAR ? ' (AR-only)' : ''}`,
                  },
                  {
                    accountId: revenueAccountId, // Credit Revenue (or AR-offset if AR-only)
                    debit: 0,
                    credit: totalAmount,
                    memo: `Invoice ${invoiceNumber} ${isAR ? 'AR-only' : 'Revenue'}`,
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const isAR = searchParams.get('isAcknowledgementReceipt');

    const where: any = {};
    if (branchId) {
      where.branchId = branchId;
    }
    if (isAR === 'true') where.isAcknowledgementReceipt = true;
    if (isAR === 'false') where.isAcknowledgementReceipt = false;

    const invoices = await prisma.salesInvoice.findMany({
      where,
      include: { items: true },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}
