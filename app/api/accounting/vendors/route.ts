import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/accounting/vendors - Get all vendors (suppliers)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // Get single vendor with transactions
      const vendor = await prisma.subsidiaryLedger.findUnique({
        where: { id },
        include: {
          account: true,
          transactions: {
            orderBy: { date: 'desc' },
            take: 50,
          },
        },
      });

      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      // Calculate balance from transactions
      const debitTotal = vendor.transactions.reduce((sum, t) => sum + t.debit, 0);
      const creditTotal = vendor.transactions.reduce((sum, t) => sum + t.credit, 0);
      const vendorWithBalance = {
        ...vendor,
        debitTotal,
        creditTotal,
        balance: debitTotal - creditTotal,
      };

      return NextResponse.json(vendorWithBalance);
    }

    // Get all vendors (entityType = SUPPLIER)
    const vendors = await prisma.subsidiaryLedger.findMany({
      where: {
        entityType: 'SUPPLIER',
        isActive: true,
      },
      include: {
        account: true,
        transactions: true,
      },
      orderBy: { entityName: 'asc' },
    });

    // Calculate balance for each vendor from transactions
    const vendorsWithBalance = vendors.map(vendor => {
      const debitTotal = vendor.transactions.reduce((sum, t) => sum + t.debit, 0);
      const creditTotal = vendor.transactions.reduce((sum, t) => sum + t.credit, 0);
      return {
        ...vendor,
        debitTotal,
        creditTotal,
        balance: debitTotal - creditTotal,
      };
    });

    return NextResponse.json(vendorsWithBalance);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
  }
}

// POST /api/accounting/vendors - Create new vendor
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
      paymentTerms,
    } = body;

    // Validate required fields
    if (!entityName) {
      return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });
    }

    // Auto-generate vendor code if not provided
    let finalEntityCode = entityCode;
    if (!finalEntityCode || finalEntityCode.trim() === '') {
      const existingVendors = await prisma.subsidiaryLedger.findMany({
        where: {
          entityType: 'SUPPLIER',
          entityCode: { startsWith: 'SUP-' },
        },
        select: { entityCode: true },
        orderBy: { entityCode: 'desc' },
      });

      let maxNum = 0;
      for (const v of existingVendors) {
        const match = v.entityCode.match(/^SUP-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }

      finalEntityCode = `SUP-${String(maxNum + 1).padStart(4, '0')}`;
    }

    // Check if entity code already exists
    const existing = await prisma.subsidiaryLedger.findFirst({
      where: {
        entityType: 'SUPPLIER',
        entityCode: finalEntityCode,
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Vendor code already exists' }, { status: 400 });
    }

    // Get or create the AP control account (2100)
    let apAccount = await prisma.account.findFirst({
      where: { code: '2100' },
    });

    if (!apAccount) {
      apAccount = await prisma.account.create({
        data: {
          code: '2100',
          name: 'Accounts Payable - Supplier',
          type: 'LIABILITY',
          normalBalance: 'CREDIT',
          hasSubsidiaryLedger: true,
          subsidiaryType: 'SUPPLIER',
        },
      });
    }

    // Create vendor (subsidiary ledger entry)
    const vendor = await prisma.subsidiaryLedger.create({
      data: {
        accountId: apAccount.id,
        entityCode: finalEntityCode,
        entityName,
        entityType: 'SUPPLIER',
        description: description || '',
        debitTotal: 0,
        creditTotal: 0,
        balance: 0,
        isActive: true,
        // Store additional info in description for now (or extend schema later)
        ...(email || phone || address || tin || paymentTerms ? {
          description: [description, `Email: ${email}`, `Phone: ${phone}`, `Address: ${address}`, `TIN: ${tin}`, `Payment Terms: ${paymentTerms}`].filter(Boolean).join('\n'),
        } : {}),
      },
      include: {
        account: true,
      },
    });

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 });
  }
}

// PATCH /api/accounting/vendors - Update vendor
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, entityName, description, email, phone, address, tin, paymentTerms, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
    }

    // Get current vendor to build description
    const currentVendor = await prisma.subsidiaryLedger.findUnique({
      where: { id },
    });

    if (!currentVendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Build description with additional fields
    const descParts = [];
    if (description) descParts.push(description);
    if (email) descParts.push(`Email: ${email}`);
    if (phone) descParts.push(`Phone: ${phone}`);
    if (address) descParts.push(`Address: ${address}`);
    if (tin) descParts.push(`TIN: ${tin}`);
    if (paymentTerms) descParts.push(`Payment Terms: ${paymentTerms}`);

    const vendor = await prisma.subsidiaryLedger.update({
      where: { id },
      data: {
        entityName,
        description: descParts.filter(Boolean).join('\n'),
        isActive: isActive !== undefined ? isActive : currentVendor.isActive,
      },
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

// DELETE /api/accounting/vendors - Delete vendor (soft delete)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
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
