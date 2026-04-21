import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assetId, amount, type } = body;

    if (!assetId || !amount || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const assetAcc = await prisma.account.findFirst({ where: { name: { contains: 'Fixed Assets' }, type: 'ASSET' } });
    const expenseAcc = await prisma.account.findFirst({ where: { name: { contains: 'Depreciation' }, type: 'EXPENSE' } });
    const accumDepAcc = await prisma.account.findFirst({ where: { name: { contains: 'Accumulated Depreciation' }, type: 'ASSET' } });
    const cashAcc = await prisma.account.findFirst({ where: { name: { contains: 'Cash' }, type: 'ASSET' } });


    if (!assetAcc || !expenseAcc || !accumDepAcc || !cashAcc) {
      return NextResponse.json({ error: 'Required accounting accounts not found' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (type === 'ACQUISITION') {
        return await tx.journalEntry.create({
          data: {
            date: new Date(),
            description: `Asset Acquisition: ${asset.name}`,
            reference: asset.assetCode,
            lines: {
              create: [
                { accountId: assetAcc.id, debit: amount, credit: 0, memo: 'Increase Asset Value' },
                { accountId: cashAcc.id, debit: 0, credit: amount, memo: 'Cash Payment' }, // Simplified for example
              ]
            }
          }
        });
      } else if (type === 'DEPRECIATION') {
        return await tx.journalEntry.create({
          data: {
            date: new Date(),
            description: `Monthly Depreciation: ${asset.name}`,
            reference: asset.assetCode,
            lines: {
              create: [
                { accountId: expenseAcc.id, debit: amount, credit: 0, memo: 'Depreciation Expense' },
                { accountId: accumDepAcc.id, debit: 0, credit: amount, memo: 'Accumulated Depreciation' },
              ]
            }
          }
        });
      }
      throw new Error('Invalid transaction type');
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error syncing asset to ledger:', error);
    return NextResponse.json({ error: 'Failed to sync asset' }, { status: 500 });
  }
}
