import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST() {
  try {
    const allLedgers = await prisma.subsidiaryLedger.findMany({
      include: { account: true }
    });

    const results = [];

    for (const ledger of allLedgers) {
      const txs = await prisma.subsidiaryTransaction.findMany({
        where: { ledgerId: ledger.id }
      });

      const debitTotal = txs.reduce((s, t) => s + t.debit, 0);
      const creditTotal = txs.reduce((s, t) => s + t.credit, 0);
      const isCreditNormal = ledger.account.normalBalance === 'CREDIT';
      const balance = isCreditNormal ? creditTotal - debitTotal : debitTotal - creditTotal;

      await prisma.subsidiaryLedger.update({
        where: { id: ledger.id },
        data: {
          debitTotal,
          creditTotal,
          balance
        }
      });

      results.push({
        id: ledger.id,
        entityName: ledger.entityName,
        debitTotal,
        creditTotal,
        balance
      });
    }

    return NextResponse.json({ success: true, updated: results.length, details: results });
  } catch (error) {
    console.error('Error syncing subsidiary balances:', error);
    return NextResponse.json({ error: 'Failed to sync balances' }, { status: 500 });
  }
}
