import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { name, code, address, contactPerson, contactPhone, contactEmail } = await request.json();
    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create the branch
      const branch = await tx.branch.create({
        data: { name, code, address: address || undefined, contactPerson: contactPerson || undefined, contactPhone: contactPhone || undefined, contactEmail: contactEmail || undefined },
      });

      // Migrate existing records to this branch
      const [je, exp, si, pb, pm, ast, asc, sub, pc] = await Promise.all([
        tx.journalEntry.updateMany({ where: { branchId: null }, data: { branchId: branch.id } }),
        tx.expense.updateMany({ where: { branchId: null }, data: { branchId: branch.id } }),
        tx.salesInvoice.updateMany({ where: { branchId: null }, data: { branchId: branch.id } }),
        tx.purchaseBill.updateMany({ where: { branchId: null }, data: { branchId: branch.id } }),
        tx.payment.updateMany({ where: { branchId: null }, data: { branchId: branch.id } }),
        tx.asset.updateMany({ where: { branchId: null }, data: { branchId: branch.id } }),
        tx.assetCategory.updateMany({ where: { branchId: null }, data: { branchId: branch.id } }),
        tx.subsidiaryLedger.updateMany({ where: { branchId: null }, data: { branchId: branch.id } }),
        tx.pettyCash.updateMany({ where: { branchId: null }, data: { branchId: branch.id } }),
      ]);

      const migrated = {
        journalEntries: je.count,
        expenses: exp.count,
        salesInvoices: si.count,
        purchaseBills: pb.count,
        payments: pm.count,
        assets: ast.count,
        assetCategories: asc.count,
        subsidiaryLedgers: sub.count,
        pettyCashFunds: pc.count,
      };

      return { branch, migrated };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error seeding branch:', error);
    return NextResponse.json({ error: 'Failed to seed branch' }, { status: 500 });
  }
}
