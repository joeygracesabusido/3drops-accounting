import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/accounting/customers - Get all customers
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const branchId = searchParams.get('branchId');

    if (id) {
      // Get single customer with transactions
      const customer = await prisma.subsidiaryLedger.findUnique({
        where: { id },
        include: {
          account: true,
          transactions: {
            orderBy: { date: 'desc' },
            take: 50,
          },
        },
      });

      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      return NextResponse.json(customer);
    }

    // Get all customers (entityType = CUSTOMER)
    const customers = await prisma.subsidiaryLedger.findMany({
      where: {
        entityType: 'CUSTOMER',
        isActive: true,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        account: true,
      },
      orderBy: { entityName: 'asc' },
    });

    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

// POST /api/accounting/customers - Create new customer
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      entityCode,
      entityName,
      description,
      email,
      phone,
      address,
      tin,
      creditLimit,
      paymentTerms,
      branchId,
    } = body;

    // Validate required fields
    if (!entityCode || !entityName) {
      return NextResponse.json({ error: 'Entity code and name are required' }, { status: 400 });
    }

    // Check if entity code already exists
    const existing = await prisma.subsidiaryLedger.findFirst({
      where: {
        entityType: 'CUSTOMER',
        entityCode,
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Customer code already exists' }, { status: 400 });
    }

    // Get or create the AR control account (1200)
    let arAccount = await prisma.account.findFirst({
      where: { code: '1200' },
    });

    if (!arAccount) {
      arAccount = await prisma.account.create({
        data: {
          code: '1200',
          name: 'Accounts Receivable - Customer',
          type: 'ASSET',
          normalBalance: 'DEBIT',
          hasSubsidiaryLedger: true,
          subsidiaryType: 'CUSTOMER',
        },
      });
    }

    // Create customer (subsidiary ledger entry)
    const customer = await prisma.subsidiaryLedger.create({
      data: {
        accountId: arAccount.id,
        entityCode,
        entityName,
        entityType: 'CUSTOMER',
        description: description || '',
        debitTotal: 0,
        creditTotal: 0,
        balance: 0,
        isActive: true,
        branchId: branchId || undefined,
        // Store additional info in description
        ...(email || phone || address || tin || creditLimit || paymentTerms ? {
          description: [description, `Email: ${email}`, `Phone: ${phone}`, `Address: ${address}`, `TIN: ${tin}`, `Credit Limit: ${creditLimit}`, `Payment Terms: ${paymentTerms}`].filter(Boolean).join('\n'),
        } : {}),
      },
      include: {
        account: true,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

// PATCH /api/accounting/customers - Update customer
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, entityName, description, email, phone, address, tin, creditLimit, paymentTerms, isActive, branchId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    // Get current customer to build description
    const currentCustomer = await prisma.subsidiaryLedger.findUnique({
      where: { id },
    });

    if (!currentCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Build description with additional fields
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

// DELETE /api/accounting/customers - Delete customer (soft delete)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
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
