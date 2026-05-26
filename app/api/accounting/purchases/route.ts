/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supplierId, supplierName, date, dueDate, items, totalAmount, expenseAccountId, apAccountId, isVatInclusive, noInputVat, ewtAccountId, ewtPercentage, branchId } = body;

    if (!supplierId || !supplierName || !items || items.length === 0 || !expenseAccountId || !apAccountId) {
      return NextResponse.json({ error: 'Missing required fields: supplier, items, expense account, or AP account' }, { status: 400 });
    }

    const billNumber = `BILL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const netAmount = isVatInclusive ? totalAmount / 1.12 : totalAmount;
    const vatAmount = totalAmount - netAmount;
    const ewtPercent = parseFloat(ewtPercentage) || 0;
    const ewtAmount = netAmount * (ewtPercent / 100);

    const result = await prisma.$transaction(async (tx) => {
      // Find EWT account if not provided but percentage exists
      let effectiveEwtAccountId = ewtAccountId;
      if (ewtPercent > 0 && !effectiveEwtAccountId) {
        const ewtAccount = await tx.account.findFirst({
          where: { code: '2340' },
        });
        effectiveEwtAccountId = ewtAccount?.id;
      }

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
          branchId: branchId || undefined,
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
      const lines = [
        {
          accountId: expenseAccountId,
          debit: netAmount,
          credit: 0,
          memo: `Bill ${billNumber} Expense`,
        },
      ];

      if (vatAmount > 0 && !noInputVat) {
        const inputVATAccount = await tx.account.findFirst({
          where: { code: '2320' },
        });

        if (inputVATAccount) {
          lines.push({
            accountId: inputVATAccount.id,
            debit: vatAmount,
            credit: 0,
            memo: `Bill ${billNumber} Input VAT`,
          });
        }
      }

      if (ewtPercent > 0 && effectiveEwtAccountId) {
        lines.push({
          accountId: effectiveEwtAccountId,
          debit: 0,
          credit: ewtAmount,
          memo: `Bill ${billNumber} EWT (${ewtPercent}%)`,
        });
      }

      // AP is net of EWT
      lines.push({
        accountId: apAccountId,
        debit: 0,
        credit: totalAmount - ewtAmount,
        memo: `Bill ${billNumber} AP`,
      });

      // Sanity Check: Ensure balanced
      const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);
      const diff = Math.abs(totalDebits - totalCredits);

      if (diff > 0.01) {
        throw new Error(`Journal entry not balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`);
      }

      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(date),
          description: `Purchase Bill ${billNumber} - ${supplierName}`,
          reference: billNumber,
          branchId: branchId || undefined,
          lines: {
            create: lines,
          },
        },
      });

      // 3. Link journal entry to bill
      await tx.purchaseBill.update({
        where: { id: bill.id },
        data: { journalEntryId: journalEntry.id }
      });

      // 4. Create or find SubsidiaryTransaction for the supplier's ledger
      let supplierLedger = await tx.subsidiaryLedger.findFirst({
        where: {
          entityType: 'SUPPLIER',
          entityName: supplierName,
          accountId: apAccountId,
        },
      });

      // Auto-create vendor if not found to ensure GL and subsidiary are in sync
      if (!supplierLedger) {
        supplierLedger = await tx.subsidiaryLedger.create({
          data: {
            accountId: apAccountId,
            entityCode: `SUP-${Date.now()}`,
            entityName: supplierName,
            entityType: 'SUPPLIER',
            description: `Auto-created from Purchase Bill ${billNumber}`,
          },
        });
      }

      await tx.subsidiaryTransaction.create({
        data: {
          ledgerId: supplierLedger.id,
          date: new Date(date),
          referenceNo: billNumber,
          description: `Purchase Bill ${billNumber} - ${supplierName}`,
          debit: 0,
          credit: totalAmount - ewtAmount,
          journalEntryId: journalEntry.id,
        },
      });

      // Update supplier ledger totals
      const ledgerTransactions = await tx.subsidiaryTransaction.findMany({
        where: { ledgerId: supplierLedger.id },
      });
      const debitTotal = ledgerTransactions.reduce((sum, t) => sum + t.debit, 0);
      const creditTotal = ledgerTransactions.reduce((sum, t) => sum + t.credit, 0);
      await tx.subsidiaryLedger.update({
        where: { id: supplierLedger.id },
        data: {
          debitTotal,
          creditTotal,
          balance: debitTotal - creditTotal,
        },
      });

      return { bill, journalEntry, netAmount, vatAmount, ewtAmount };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating purchase bill:', error);
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
    const { supplierId, supplierName, date, dueDate, items, totalAmount, expenseAccountId, apAccountId, isVatInclusive, noInputVat, ewtAccountId, ewtPercentage, branchId } = body;

    if (!supplierId || !supplierName || !items || items.length === 0 || !expenseAccountId || !apAccountId) {
      return NextResponse.json({ error: 'Missing required fields: supplier, items, expense account, or AP account' }, { status: 400 });
    }

    // Fetch existing bill with items
    const existingBill = await prisma.purchaseBill.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingBill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Only allow editing unpaid bills
    if (existingBill.status !== 'UNPAID') {
      return NextResponse.json({ error: 'Only unpaid bills can be edited' }, { status: 400 });
    }

    const netAmount = isVatInclusive ? totalAmount / 1.12 : totalAmount;
    const vatAmount = totalAmount - netAmount;
    const ewtPercent = parseFloat(ewtPercentage) || 0;
    const ewtAmount = netAmount * (ewtPercent / 100);

    const result = await prisma.$transaction(async (tx) => {
      // Find EWT account if not provided but percentage exists
      let effectiveEwtAccountId = ewtAccountId;
      if (ewtPercent > 0 && !effectiveEwtAccountId) {
        const ewtAccount = await tx.account.findFirst({
          where: { code: '2340' },
        });
        effectiveEwtAccountId = ewtAccount?.id;
      }

      // 1. Update the Purchase Bill
      const updatedBill = await tx.purchaseBill.update({
        where: { id },
        data: {
          date: new Date(date),
          dueDate: new Date(dueDate),
          supplierId,
          supplierName,
          totalAmount,
          branchId: branchId || undefined,
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

      // 3. Delete old journal entry - explicitly delete lines first for serverless reliability
      if (existingBill.journalEntryId) {
        await tx.journalLine.deleteMany({
          where: { entryId: existingBill.journalEntryId },
        });
        await tx.journalEntry.delete({
          where: { id: existingBill.journalEntryId },
        });
      }

      // 4. Create new journal entry with updated amounts
      const lines = [
        {
          accountId: expenseAccountId,
          debit: netAmount,
          credit: 0,
          memo: `Bill ${existingBill.billNumber} Expense`,
        },
      ];

      if (vatAmount > 0 && !noInputVat) {
        const inputVATAccount = await tx.account.findFirst({
          where: { code: '2320' },
        });

        if (inputVATAccount) {
          lines.push({
            accountId: inputVATAccount.id,
            debit: vatAmount,
            credit: 0,
            memo: `Bill ${existingBill.billNumber} Input VAT`,
          });
        }
      }

      if (ewtPercent > 0 && effectiveEwtAccountId) {
        lines.push({
          accountId: effectiveEwtAccountId,
          debit: 0,
          credit: ewtAmount,
          memo: `Bill ${existingBill.billNumber} EWT (${ewtPercent}%)`,
        });
      }

      // AP is net of EWT
      lines.push({
        accountId: apAccountId,
        debit: 0,
        credit: totalAmount - ewtAmount,
        memo: `Bill ${existingBill.billNumber} AP`,
      });

      // Sanity Check: Ensure balanced
      const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);
      const diff = Math.abs(totalDebits - totalCredits);

      if (diff > 0.01) {
        throw new Error(`Journal entry not balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`);
      }

      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(date),
          description: `Purchase Bill ${existingBill.billNumber} - ${supplierName}`,
          reference: existingBill.billNumber,
          branchId: branchId || undefined,
          lines: {
            create: lines,
          },
        },
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
              credit: totalAmount - ewtAmount,
              journalEntryId: journalEntry.id,
            },
          });

          // Update supplier ledger totals
          const ledgerTransactions = await tx.subsidiaryTransaction.findMany({
            where: { ledgerId: supplierLedger.id },
          });
          const debitTotal = ledgerTransactions.reduce((sum, t) => sum + t.debit, 0);
          const creditTotal = ledgerTransactions.reduce((sum, t) => sum + t.credit, 0);
          await tx.subsidiaryLedger.update({
            where: { id: supplierLedger.id },
            data: {
              debitTotal,
              creditTotal,
              balance: debitTotal - creditTotal,
            },
          });
        }

      return { bill: updatedBill, journalEntry, netAmount, vatAmount, ewtAmount };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating purchase bill:', error);
    return NextResponse.json({ error: `Failed to update purchase bill: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
}

// Reset bill to UNPAID (for fixing erroneous payments)
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    if (!id) {
      return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 });
    }

    // Reset bill status to UNPAID
    if (action === 'reset') {
      const bill = await prisma.purchaseBill.findUnique({ where: { id } });
      if (!bill) {
        return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
      }

      // Delete associated payments first
      await prisma.payment.deleteMany({ where: { billId: id } });

      // Reset bill status and amount
      const updatedBill = await prisma.purchaseBill.update({
        where: { id },
        data: { status: 'UNPAID', amountPaid: 0 },
      });

      return NextResponse.json({ success: true, bill: updatedBill });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error resetting bill:', error);
    return NextResponse.json({ error: `Failed to reset bill: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    const where: any = {};
    if (branchId) {
      where.branchId = branchId;
    }

    const bills = await prisma.purchaseBill.findMany({
      where,
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
