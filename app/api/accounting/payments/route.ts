/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { billId, amount, paymentDate, referenceNumber, notes, cashAccountId } = body;

    if (!billId || !amount || !paymentDate || !cashAccountId) {
      return NextResponse.json({ error: 'Missing required fields: billId, amount, paymentDate, or cashAccountId' }, { status: 400 });
    }

    const bill = await prisma.purchaseBill.findUnique({
      where: { id: billId },
      include: { items: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    if (bill.status === 'PAID' || bill.status === 'VOID') {
      return NextResponse.json({ error: 'Cannot pay a settled bill' }, { status: 400 });
    }

    const remainingBalance = bill.totalAmount - bill.amountPaid;
    if (amount > remainingBalance + 0.01) {
      return NextResponse.json({ error: `Payment amount exceeds remaining balance of ${remainingBalance.toFixed(2)}` }, { status: 400 });
    }

    // Fetch the AP account ID from the original journal entry
    let apAccountId = '';
    if (bill.journalEntryId) {
      const je = await prisma.journalEntry.findUnique({
        where: { id: bill.journalEntryId },
        include: { lines: { include: { account: true } } },
      });
      if (je) {
        // Find the AP account (2100) specifically - avoid EWT or other credit accounts
        const apLine = je.lines.find((l: any) => l.credit > 0 && l.account?.code === '2100');
        apAccountId = apLine?.accountId || '';
        
        // Fallback: if no 2100 found, try any credit line that's NOT EWT (2340)
        if (!apAccountId) {
          const fallbackLine = je.lines.find((l: any) => l.credit > 0 && l.account?.code !== '2340');
          apAccountId = fallbackLine?.accountId || '';
        }
      }
    }

    if (!apAccountId) {
      return NextResponse.json({ error: 'Could not find AP account for this bill' }, { status: 400 });
    }

    const newAmountPaid = bill.amountPaid + amount;
    const newStatus = newAmountPaid >= bill.totalAmount - 0.01 ? 'PAID' : 'PARTIALLY_PAID';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the payment record
      const payment = await tx.payment.create({
        data: {
          billId,
          amount,
          paymentDate: new Date(paymentDate),
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          cashAccountId,
        },
      });

      // 2. Create journal entry: debit AP, credit cash/bank
      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(paymentDate),
          description: `Payment for Purchase Bill ${bill.billNumber}`,
          reference: referenceNumber || `PAY-${bill.billNumber}`,
          lines: {
            create: [
              {
                accountId: apAccountId,
                debit: amount,
                credit: 0,
                memo: `Payment for Bill ${bill.billNumber}`,
              },
              {
                accountId: cashAccountId,
                debit: 0,
                credit: amount,
                memo: `Payment for Bill ${bill.billNumber}`,
              },
            ],
          },
        },
      });

      // 3. Update payment with journal entry reference
      await tx.payment.update({
        where: { id: payment.id },
        data: { journalEntryId: journalEntry.id },
      });

      // 4. Update bill amount paid and status
      const updatedBill = await tx.purchaseBill.update({
        where: { id: billId },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
        },
      });

      // 5. Create SubsidiaryTransaction for the supplier's ledger
      const supplierLedger = await tx.subsidiaryLedger.findFirst({
        where: {
          entityType: 'SUPPLIER',
          entityName: bill.supplierName,
          accountId: apAccountId,
        },
      });

      if (supplierLedger) {
        await tx.subsidiaryTransaction.create({
          data: {
            ledgerId: supplierLedger.id,
            date: new Date(paymentDate),
            referenceNo: referenceNumber || `PAY-${bill.billNumber}`,
            description: `Payment for Bill ${bill.billNumber}`,
            debit: amount,
            credit: 0,
            journalEntryId: journalEntry.id,
          },
        });
      }

      return { payment, journalEntry, bill: updatedBill, remainingBalance: bill.totalAmount - newAmountPaid };  
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: `Failed to create payment: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { amount, paymentDate, referenceNumber, notes, cashAccountId } = body;

    if (!amount || !paymentDate || !cashAccountId) {
      return NextResponse.json({ error: 'Missing required fields: amount, paymentDate, or cashAccountId' }, { status: 400 });
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { id },
      include: { bill: true, journalEntry: { include: { lines: true } } },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (existingPayment.bill.status === 'PAID' || existingPayment.bill.status === 'VOID') {
      return NextResponse.json({ error: 'Cannot modify payment for a settled bill' }, { status: 400 });
    }

    const oldAmount = existingPayment.amount;

    const billRemainingBefore = existingPayment.bill.totalAmount - existingPayment.bill.amountPaid;
    if (amount > billRemainingBefore + oldAmount + 0.01) {
      return NextResponse.json({ error: `Payment amount exceeds available balance` }, { status: 400 });
    }

    let apAccountId = '';
    if (existingPayment.bill.journalEntryId) {
      const je = await prisma.journalEntry.findUnique({
        where: { id: existingPayment.bill.journalEntryId },
        include: { lines: { include: { account: true } } },
      });
      if (je) {
        // Find the AP account (2100) specifically - avoid EWT or other credit accounts
        const apLine = je.lines.find((l: any) => l.credit > 0 && l.account?.code === '2100');
        apAccountId = apLine?.accountId || '';
        
        // Fallback: if no 2100 found, try any credit line that's NOT EWT (2340)
        if (!apAccountId) {
          const fallbackLine = je.lines.find((l: any) => l.credit > 0 && l.account?.code !== '2340');
          apAccountId = fallbackLine?.accountId || '';
        }
      }
    }

    if (!apAccountId) {
      return NextResponse.json({ error: 'Could not find AP account for this bill' }, { status: 400 });
    }

    const newAmountPaid = existingPayment.bill.amountPaid - oldAmount + amount;
    const newStatus = newAmountPaid >= existingPayment.bill.totalAmount - 0.01 ? 'PAID' : newAmountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete old subsidiary transaction
      await tx.subsidiaryTransaction.deleteMany({
        where: { journalEntryId: existingPayment.journalEntryId || undefined },
      });

      // 2. Delete old journal entry
      if (existingPayment.journalEntryId) {
        await tx.journalEntry.delete({
          where: { id: existingPayment.journalEntryId },
        });
      }

      // 3. Delete old payment
      await tx.payment.delete({
        where: { id },
      });

      // 4. Create new payment record
      const payment = await tx.payment.create({
        data: {
          billId: existingPayment.billId,
          amount,
          paymentDate: new Date(paymentDate),
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          cashAccountId,
        },
      });

      // 5. Create new journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(paymentDate),
          description: `Payment for Purchase Bill ${existingPayment.bill.billNumber}`,
          reference: referenceNumber || `PAY-${existingPayment.bill.billNumber}`,
          lines: {
            create: [
              {
                accountId: apAccountId,
                debit: amount,
                credit: 0,
                memo: `Payment for Bill ${existingPayment.bill.billNumber}`,
              },
              {
                accountId: cashAccountId,
                debit: 0,
                credit: amount,
                memo: `Payment for Bill ${existingPayment.bill.billNumber}`,
              },
            ],
          },
        },
      });

      // 6. Update payment with journal entry reference
      await tx.payment.update({
        where: { id: payment.id },
        data: { journalEntryId: journalEntry.id },
      });

      // 7. Update bill amount paid and status
      const updatedBill = await tx.purchaseBill.update({
        where: { id: existingPayment.billId },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
        },
      });

      // 8. Create or find new SubsidiaryTransaction
      let supplierLedger = await tx.subsidiaryLedger.findFirst({
        where: {
          entityType: 'SUPPLIER',
          entityName: existingPayment.bill.supplierName,
          accountId: apAccountId,
        },
      });

      // Auto-create vendor if not found to ensure GL and subsidiary are in sync
      if (!supplierLedger) {
        supplierLedger = await tx.subsidiaryLedger.create({
          data: {
            accountId: apAccountId,
            entityCode: `SUP-${Date.now()}`,
            entityName: existingPayment.bill.supplierName,
            entityType: 'SUPPLIER',
            description: `Auto-created from Payment`,
          },
        });
      }

      await tx.subsidiaryTransaction.create({
        data: {
          ledgerId: supplierLedger.id,
          date: new Date(paymentDate),
          referenceNo: referenceNumber || `PAY-${existingPayment.bill.billNumber}`,
          description: `Payment for Bill ${existingPayment.bill.billNumber}`,
          debit: amount,
          credit: 0,
          journalEntryId: journalEntry.id,
        },
      });

      return { payment, journalEntry, bill: updatedBill };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: `Failed to update payment: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { id },
      include: { bill: true, journalEntry: { include: { lines: true } } },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (existingPayment.bill.status === 'PAID' || existingPayment.bill.status === 'VOID') {
      return NextResponse.json({ error: 'Cannot delete payment for a settled bill' }, { status: 400 });
    }

    let apAccountId = '';
    if (existingPayment.bill.journalEntryId) {
      const je = await prisma.journalEntry.findUnique({
        where: { id: existingPayment.bill.journalEntryId },
        include: { lines: true },
      });
      if (je) {
        const creditLine = je.lines.find((l: any) => l.credit > 0);
        apAccountId = creditLine?.accountId || '';
      }
    }

    if (!apAccountId) {
      return NextResponse.json({ error: 'Could not find AP account for this bill' }, { status: 400 });
    }

    const oldAmount = existingPayment.amount;
    const newAmountPaid = existingPayment.bill.amountPaid - oldAmount;
    const newStatus = newAmountPaid >= existingPayment.bill.totalAmount - 0.01 ? 'PAID' : newAmountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete old subsidiary transaction
      await tx.subsidiaryTransaction.deleteMany({
        where: { journalEntryId: existingPayment.journalEntryId || undefined },
      });

      // 2. Delete old journal entry
      if (existingPayment.journalEntryId) {
        await tx.journalEntry.delete({
          where: { id: existingPayment.journalEntryId },
        });
      }

      // 3. Delete old payment
      await tx.payment.delete({
        where: { id },
      });

      // 4. Update bill amount paid and status
      const updatedBill = await tx.purchaseBill.update({
        where: { id: existingPayment.billId },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
        },
      });

      return { bill: updatedBill };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: `Failed to delete payment: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const billId = searchParams.get('billId');
    const reference = searchParams.get('reference');

    const where: any = {};
    if (billId) {
      where.billId = billId;
    }
    if (reference) {
      where.referenceNumber = { contains: reference, mode: 'insensitive' };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        bill: true,
        cashAccount: true,
        journalEntry: {
          include: {
            lines: {
              include: {
                account: true,
              }
            }
          }
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { supplierName, paymentDate, referenceNumber, notes, cashAccountId } = body;

    if (!supplierName || !paymentDate || !cashAccountId) {
      return NextResponse.json({ error: 'Missing required fields: supplierName, paymentDate, or cashAccountId' }, { status: 400 });
    }

    const unpaidBills = await prisma.purchaseBill.findMany({
      where: {
        supplierName,
        status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      },
      include: { items: true, journalEntry: { include: { lines: { include: { account: true } } } },
      },
    });

    if (unpaidBills.length === 0) {
      return NextResponse.json({ error: 'No unpaid bills found for this supplier' }, { status: 404 });
    }

    const results = [];
    const errors = [];

    for (const bill of unpaidBills) {
      try {
        const remainingBalance = bill.totalAmount - bill.amountPaid;
        if (remainingBalance <= 0) continue;

        let apAccountId = '';
        if (bill.journalEntryId) {
          const je = bill.journalEntry;
          if (je) {
            const apLine = je.lines.find((l: any) => l.credit > 0 && l.account?.code === '2100');
            apAccountId = apLine?.accountId || '';
            if (!apAccountId) {
              const fallbackLine = je.lines.find((l: any) => l.credit > 0 && l.account?.code !== '2340');
              apAccountId = fallbackLine?.accountId || '';
            }
          }
        }

        if (!apAccountId) {
          errors.push({ bill: bill.billNumber, error: 'Could not find AP account' });
          continue;
        }

        const result = await prisma.$transaction(async (tx) => {
          const payRef = referenceNumber ? `${referenceNumber}-${bill.billNumber}` : `PAYALL-${bill.billNumber}`;

          const payment = await tx.payment.create({
            data: {
              billId: bill.id,
              amount: remainingBalance,
              paymentDate: new Date(paymentDate),
              referenceNumber: payRef,
              notes: notes || `Full payment for ${bill.billNumber}`,
              cashAccountId,
            },
          });

          const journalEntry = await tx.journalEntry.create({
            data: {
              date: new Date(paymentDate),
              description: `Payment for Purchase Bill ${bill.billNumber}`,
              reference: payRef,
              lines: {
                create: [
                  { accountId: apAccountId, debit: remainingBalance, credit: 0, memo: `Payment for Bill ${bill.billNumber}` },
                  { accountId: cashAccountId, debit: 0, credit: remainingBalance, memo: `Payment for Bill ${bill.billNumber}` },
                ],
              },
            },
          });

          await tx.payment.update({
            where: { id: payment.id },
            data: { journalEntryId: journalEntry.id },
          });

          const updatedBill = await tx.purchaseBill.update({
            where: { id: bill.id },
            data: { amountPaid: bill.totalAmount, status: 'PAID' },
          });

          const supplierLedger = await tx.subsidiaryLedger.findFirst({
            where: { entityType: 'SUPPLIER', entityName: bill.supplierName, accountId: apAccountId },
          });

          if (supplierLedger) {
            await tx.subsidiaryTransaction.create({
              data: {
                ledgerId: supplierLedger.id,
                date: new Date(paymentDate),
                referenceNo: payRef,
                description: `Payment for Bill ${bill.billNumber}`,
                debit: remainingBalance,
                credit: 0,
                journalEntryId: journalEntry.id,
              },
            });
          }

          return { payment, journalEntry, bill: updatedBill };
        });

        results.push({ ...result, billNumber: bill.billNumber });
      } catch (err) {
        errors.push({ bill: bill.billNumber, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return NextResponse.json({ success: results.length, errors, results });
  } catch (error) {
    console.error('Error paying all payables:', error);
    return NextResponse.json({ error: `Failed to pay all: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
}
