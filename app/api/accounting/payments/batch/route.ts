/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body));

    const { vendorName, amount, paymentDate, referenceNumber, notes, cashAccountId, billIds, journalEntryIds, branchId } = body;

    if (!vendorName) return NextResponse.json({ error: 'vendorName required' }, { status: 400 });
    if (!amount) return NextResponse.json({ error: 'amount required' }, { status: 400 });
    if (!paymentDate) return NextResponse.json({ error: 'paymentDate required' }, { status: 400 });
    if (!cashAccountId) return NextResponse.json({ error: 'cashAccountId required' }, { status: 400 });

    if ((!billIds || billIds.length === 0) && (!journalEntryIds || journalEntryIds.length === 0)) {
      return NextResponse.json({ error: 'Please select at least one bill or journal entry' }, { status: 400 });
    }

    // Get AP account (2100)
    const accounts = await prisma.account.findMany({ where: { code: '2100' } });
    const apAccount = accounts[0];
    if (!apAccount) return NextResponse.json({ error: 'AP account 2100 not found' }, { status: 400 });

    console.log('AP account:', apAccount.code, apAccount.name);
    console.log('Cash account ID:', cashAccountId);
    console.log('Bill IDs provided:', billIds);
    console.log('JE IDs provided:', journalEntryIds);

    // Find bills - either specific bills or all unpaid bills
    let bills: any[] = [];
    if (billIds && Array.isArray(billIds) && billIds.length > 0) {
      bills = await prisma.purchaseBill.findMany({
        where: { 
          supplierName: vendorName, 
          id: { in: billIds },
          status: { in: ['UNPAID', 'PARTIALLY_PAID'] }
        },
      });
    }

    // Find journal entries if provided
    let journalEntries: any[] = [];
    if (journalEntryIds && Array.isArray(journalEntryIds) && journalEntryIds.length > 0) {
      journalEntries = await prisma.journalEntry.findMany({
        where: { id: { in: journalEntryIds } },
        include: { lines: true },
      });
    }

    console.log('Bills found:', bills.length, 'JEs found:', journalEntries.length);
    // It's OK to have no bills as long as we have JEs, or vice versa
    if (bills.length === 0 && journalEntries.length === 0) {
      return NextResponse.json({ error: 'No bills or journal entries found for ' + vendorName }, { status: 404 });
    }

    // Filter bills with remaining balance and sort by date (oldest first)
    const unpaidBills = bills
      .filter((b: any) => (b.totalAmount - b.amountPaid) > 0)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate JE totals for payable accounts
    const jePayables = journalEntries.map((je: any) => {
      const apCredit = je.lines?.reduce((sum: number, line: any) => {
        if (line.credit > 0 && (line.account?.code === '2100' || line.account?.code?.startsWith('21'))) {
          return sum + line.credit;
        }
        return sum;
      }, 0) || 0;
      return { ...je, apCredit };
    });

    // We need at least one unpaid bill OR one JE with payable
    if (unpaidBills.length === 0 && jePayables.length === 0) {
      return NextResponse.json({ error: 'All selected items are already paid' }, { status: 400 });
    }

    // If only bills selected but no unpaid bills, that's OK - we can still pay JEs
    // If only JEs selected, that's also OK
    const hasBillsToPay = unpaidBills.length > 0;
    const hasJEsToPay = jePayables.length > 0;

    if (!hasBillsToPay && !hasJEsToPay) {
      return NextResponse.json({ error: 'No items available to pay' }, { status: 400 });
    }

    let remainingAmount = amount;
    const paymentsMade: { billNumber: string; amount: number; status: string }[] = [];
    const jePaymentsMade: { jeNumber: string; amount: number }[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    // Pay each bill until amount is exhausted
    for (const bill of unpaidBills) {
      if (remainingAmount <= 0) break;

      const balance = bill.totalAmount - bill.amountPaid;
      const payAmount = Math.min(remainingAmount, balance);

      console.log('Paying bill:', bill.billNumber, 'amount:', payAmount);

      // Create payment for each bill
      await prisma.payment.create({
        data: {
          billId: bill.id,
          amount: payAmount,
          paymentDate: new Date(paymentDate),
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          cashAccountId,
          branchId: branchId || undefined,
        },
      });

      // Update bill status
      const newPaid = bill.amountPaid + payAmount;
      const newStatus = newPaid >= bill.totalAmount ? 'PAID' : 'PARTIALLY_PAID';

      await prisma.purchaseBill.update({
        where: { id: bill.id },
        data: { amountPaid: newPaid, status: newStatus },
      });

      paymentsMade.push({ billNumber: bill.billNumber, amount: payAmount, status: newStatus });
      totalDebit += payAmount;
      totalCredit += payAmount;
      remainingAmount -= payAmount;
    }

    // Pay each journal entry until amount is exhausted
    for (const je of jePayables) {
      if (remainingAmount <= 0) break;
      if (je.apCredit <= 0) continue;

      const payAmount = Math.min(remainingAmount, je.apCredit);
      console.log('Paying JE:', je.reference || je.id, 'amount:', payAmount);

      // For JE-only payments, we don't create individual Payment records
      // We'll just track them for the journal entry
      jePaymentsMade.push({ jeNumber: je.reference || je.id.slice(-8).toUpperCase(), amount: payAmount });
      totalDebit += payAmount;
      totalCredit += payAmount;
      remainingAmount -= payAmount;
    }

    // Create single journal entry for all payments
    let journalEntry = null;
    if (totalDebit > 0) {
      const descParts = [];
      if (paymentsMade.length > 0) descParts.push(paymentsMade.map(p => p.billNumber).join(', '));
      if (jePaymentsMade.length > 0) descParts.push(jePaymentsMade.map(p => p.jeNumber).join(', '));
      
      journalEntry = await prisma.journalEntry.create({
        data: {
          date: new Date(paymentDate),
          description: `Payment for ${descParts.join('; ')}`,
          reference: referenceNumber || (paymentsMade.length > 0 ? `PAY-${paymentsMade[0].billNumber}` : `PAY-${jePaymentsMade[0]?.jeNumber || 'JE'}`),
          branchId: branchId || undefined,
          lines: {
            create: [
              { accountId: apAccount.id, debit: totalDebit, credit: 0 },
              { accountId: cashAccountId, debit: 0, credit: totalCredit },
            ],
          },
        },
      });

      // Link journal entry to all bills (only if there are bills)
      if (paymentsMade.length > 0) {
        await prisma.purchaseBill.updateMany({
          where: { billNumber: { in: paymentsMade.map(p => p.billNumber) } },
          data: { journalEntryId: journalEntry.id },
        });
      }

      console.log('Journal entry created:', journalEntry.id);

      // Create or find vendor's subsidiary ledger
      let supplierLedger = await prisma.subsidiaryLedger.findFirst({
        where: {
          entityType: 'SUPPLIER',
          entityName: vendorName,
          accountId: apAccount.id,
        },
      });

      if (!supplierLedger) {
        supplierLedger = await prisma.subsidiaryLedger.create({
          data: {
            accountId: apAccount.id,
            entityCode: `SUP-${Date.now()}`,
            entityName: vendorName,
            entityType: 'SUPPLIER',
            description: `Auto-created from vendor payment`,
          },
        });
      }

      // Create subsidiary transaction (debit reduces the payable)
      const subsidiaryDescParts = [];
      if (paymentsMade.length > 0) subsidiaryDescParts.push(paymentsMade.map(p => p.billNumber).join(', '));
      if (jePaymentsMade.length > 0) subsidiaryDescParts.push(jePaymentsMade.map(p => p.jeNumber).join(', '));
      
      await prisma.subsidiaryTransaction.create({
        data: {
          ledgerId: supplierLedger.id,
          date: new Date(paymentDate),
          referenceNo: referenceNumber || (paymentsMade.length > 0 ? `PAY-${paymentsMade[0].billNumber}` : (jePaymentsMade.length > 0 ? `PAY-${jePaymentsMade[0].jeNumber}` : 'PAY')),
          description: `Payment for ${subsidiaryDescParts.join('; ')}`,
          debit: totalDebit,
          credit: 0,
          journalEntryId: journalEntry.id,
        },
      });

      // Update supplier ledger totals
      const ledgerTransactions = await prisma.subsidiaryTransaction.findMany({
        where: { ledgerId: supplierLedger.id },
      });
      const debitTotal = ledgerTransactions.reduce((sum, t) => sum + t.debit, 0);
      const creditTotal = ledgerTransactions.reduce((sum, t) => sum + t.credit, 0);
      await prisma.subsidiaryLedger.update({
        where: { id: supplierLedger.id },
        data: {
          debitTotal,
          creditTotal,
          balance: creditTotal - debitTotal,
        },
      });

      console.log('Subsidiary transaction created for', vendorName);
    }

    console.log('Done! Payments made:', paymentsMade.length, 'JE payments:', jePaymentsMade.length);

    return NextResponse.json({ 
      success: true, 
      billPayments: paymentsMade,
      jePayments: jePaymentsMade,
      totalPaid: amount - remainingAmount,
      remainingBalance: remainingAmount
    });
  } catch (error) {
    console.error('ERROR:', error);
    return NextResponse.json({ 
      error: 'Failed: ' + (error instanceof Error ? error.message : 'Unknown error') 
    }, { status: 500 });
  }
}