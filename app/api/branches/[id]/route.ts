import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { name, code, address, contactPerson, contactPhone, contactEmail, isActive } = body;

    const existing = await prisma.branch.findFirst({
      where: { OR: [{ name }, { code }], NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Branch name or code already exists' }, { status: 409 });
    }

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(address !== undefined && { address }),
        ...(contactPerson !== undefined && { contactPerson }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(branch);
  } catch (error) {
    console.error('Error updating branch:', error);
    return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Check if branch is in use before deleting
    const usageCounts = await Promise.all([
      prisma.journalEntry.count({ where: { branchId: id } }),
      prisma.expense.count({ where: { branchId: id } }),
      prisma.salesInvoice.count({ where: { branchId: id } }),
      prisma.purchaseBill.count({ where: { branchId: id } }),
      prisma.asset.count({ where: { branchId: id } }),
    ]);
    const totalUsage = usageCounts.reduce((a, b) => a + b, 0);

    if (totalUsage > 0) {
      return NextResponse.json({
        error: 'Cannot delete branch with existing transactions',
        usageCount: totalUsage,
      }, { status: 400 });
    }

    await prisma.branch.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting branch:', error);
    return NextResponse.json({ error: 'Failed to delete branch' }, { status: 500 });
  }
}
