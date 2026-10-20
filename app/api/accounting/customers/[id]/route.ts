import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

// PATCH /api/accounting/customers/[id] - Update customer
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!OBJECT_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    const body = await request.json();
    const { entityName, description, email, phone, address, tin, creditLimit, paymentTerms, isActive, branchId } = body;

    const currentCustomer = await prisma.subsidiaryLedger.findUnique({
      where: { id },
    });

    if (!currentCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const descParts = [];
    if (description) descParts.push(description);
    if (email) descParts.push(`Email: ${email}`);
    if (phone) descParts.push(`Phone: ${phone}`);
    if (address) descParts.push(`Address: ${address}`);
    if (tin) descParts.push(`TIN: ${tin}`);
    if (creditLimit) descParts.push(`Credit Limit: ${creditLimit}`);
    if (paymentTerms) descParts.push(`Payment Terms: ${paymentTerms}`);

    const updateData: Record<string, unknown> = {
      entityName,
      description: descParts.filter(Boolean).join('\n'),
      isActive: isActive !== undefined ? isActive : currentCustomer.isActive,
    };
    if (branchId !== undefined) updateData.branchId = branchId;

    const customer = await prisma.subsidiaryLedger.update({
      where: { id },
      data: updateData,
      include: {
        account: true,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

// DELETE /api/accounting/customers/[id] - Delete customer (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!OBJECT_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const currentCustomer = await prisma.subsidiaryLedger.findUnique({
      where: { id },
    });

    if (!currentCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer = await prisma.subsidiaryLedger.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
