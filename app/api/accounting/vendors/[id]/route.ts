import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

// PATCH /api/accounting/vendors/[id] - Update vendor
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!OBJECT_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }
    const body = await request.json();
    const { entityName, description, email, phone, address, tin, paymentTerms, isActive, branchId } = body;

    const currentVendor = await prisma.subsidiaryLedger.findUnique({
      where: { id },
    });

    if (!currentVendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const descParts = [];
    if (description) descParts.push(description);
    if (email) descParts.push(`Email: ${email}`);
    if (phone) descParts.push(`Phone: ${phone}`);
    if (address) descParts.push(`Address: ${address}`);
    if (tin) descParts.push(`TIN: ${tin}`);
    if (paymentTerms) descParts.push(`Payment Terms: ${paymentTerms}`);

    const updateData: Record<string, unknown> = {
      entityName,
      description: descParts.filter(Boolean).join('\n'),
      isActive: isActive !== undefined ? isActive : currentVendor.isActive,
    };
    if (branchId !== undefined) updateData.branchId = branchId;

    const vendor = await prisma.subsidiaryLedger.update({
      where: { id },
      data: updateData,
      include: {
        account: true,
      },
    });

    return NextResponse.json(vendor);
  } catch (error) {
    console.error('Error updating vendor:', error);
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 });
  }
}

// DELETE /api/accounting/vendors/[id] - Delete vendor (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!OBJECT_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const currentVendor = await prisma.subsidiaryLedger.findUnique({
      where: { id },
    });

    if (!currentVendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const vendor = await prisma.subsidiaryLedger.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(vendor);
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json({ error: 'Failed to delete vendor' }, { status: 500 });
  }
}
