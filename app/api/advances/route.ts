import { NextResponse } from 'next/server';
import { PrismaClient } from "@prisma/client";
import { cookies } from 'next/headers';
import { cache } from '@/lib/redis';
import { hasAdminAccess } from '@/lib/auth-helpers';

// Use a fresh client if the singleton is stale
const localPrisma = new PrismaClient();
const ADVANCES_CACHE_PREFIX = 'advances:';

// Helper to get the model safely
function getAdvanceModel(p: PrismaClient) {
  return p.advance;
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const advanceId = searchParams.get('id');

    const advanceModel = getAdvanceModel(localPrisma);
    if (!advanceModel) throw new Error('Advance model not found in Prisma client');

    if (advanceId) {
      const advance = await advanceModel.findUnique({
        where: { id: advanceId },
        include: { 
          employee: true,
          payments: {
            where: {
              payrollId: {
                not: null
              }
            },
            orderBy: { paymentDate: 'desc' },
            include: { payroll: true }
          }
        },
      });
      return NextResponse.json(advance);
    }

    // If not admin role, filter to only show the logged-in employee's advances
    const where: Record<string, string> = {};
    if (!hasAdminAccess(userRole || '')) {
      const user = await localPrisma.user.findUnique({
        where: { email: userEmail },
        include: { employees: true },
      });

      if (!user || !user.employees || user.employees.length === 0) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
      }

      where.employeeId = user.employees[0].id;
    } else if (employeeId) {
      where.employeeId = employeeId;
    }

    const cacheKey = `${ADVANCES_CACHE_PREFIX}${userRole}:${userEmail}`;
    try {
      const cachedData = await cache.get(cacheKey);
      if (cachedData) return NextResponse.json(cachedData);
    } catch (err) {
      console.error('Redis GET error:', err);
    }

    const advances = await advanceModel.findMany({
      where,
      include: { 
        employee: true,
        payments: {
          where: {
            payrollId: {
              not: null
            }
          },
          orderBy: { paymentDate: 'desc' },
          include: { payroll: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    try {
      await cache.set(cacheKey, advances, 1800); // Cache for 30 mins
    } catch (err) {
      console.error('Redis SET error:', err);
    }

    return NextResponse.json(advances);
  } catch (error: unknown) {
    console.error('Error fetching advances:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch advances', details: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('POST /api/advances - Request body:', body);
    
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (!hasAdminAccess(userRole || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { employeeId, type, totalAmount, deductionAmount } = body;

    if (!employeeId || !type || !totalAmount || !deductionAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const advanceModel = getAdvanceModel(localPrisma);
    if (!advanceModel) throw new Error('Advance model not found in Prisma client at runtime');

    const advance = await advanceModel.create({
      data: {
        employeeId,
        type,
        totalAmount: parseFloat(totalAmount),
        remainingBalance: parseFloat(totalAmount),
        deductionAmount: parseFloat(deductionAmount),
        status: 'ACTIVE',
      },
    });

    // Invalidate cache
    try {
      await cache.delByPattern(`${ADVANCES_CACHE_PREFIX}*`);
    } catch (err) {
      console.error('Redis DEL error:', err);
    }

    return NextResponse.json(advance, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating advance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: 'Failed to create advance',
      details: errorMessage
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (!hasAdminAccess(userRole || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await localPrisma.advance.delete({
      where: { id },
    });

    // Invalidate cache
    try {
      await cache.delByPattern(`${ADVANCES_CACHE_PREFIX}*`);
    } catch (err) {
      console.error('Redis DEL error:', err);
    }

    return NextResponse.json({ message: 'Advance deleted successfully' });
  } catch (error) {
    console.error('Error deleting advance:', error);
    return NextResponse.json({ error: 'Failed to delete advance' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (!hasAdminAccess(userRole || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id, deductionAmount, totalAmount } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Get current advance to calculate new balance
    const currentAdvance = await localPrisma.advance.findUnique({
      where: { id },
    });

    if (!currentAdvance) {
      return NextResponse.json({ error: 'Advance not found' }, { status: 404 });
    }

    // Calculate new remaining balance
    const newDeductionAmount = deductionAmount !== undefined ? parseFloat(deductionAmount) : currentAdvance.deductionAmount;
    const newTotalAmount = totalAmount !== undefined ? parseFloat(totalAmount) : currentAdvance.totalAmount;
    
    // Calculate how much has already been deducted
    const alreadyDeducted = currentAdvance.totalAmount - currentAdvance.remainingBalance;
    const newRemainingBalance = Math.max(0, newTotalAmount - alreadyDeducted);

    const updatedAdvance = await localPrisma.advance.update({
      where: { id },
      data: {
        deductionAmount: newDeductionAmount,
        totalAmount: newTotalAmount,
        remainingBalance: newRemainingBalance,
        status: newRemainingBalance <= 0 ? 'FULLY_PAID' : 'ACTIVE',
      },
    });

    // Invalidate cache
    try {
      await cache.delByPattern(`${ADVANCES_CACHE_PREFIX}*`);
    } catch (err) {
      console.error('Redis DEL error:', err);
    }

    return NextResponse.json(updatedAdvance);
  } catch (error) {
    console.error('Error updating advance:', error);
    return NextResponse.json({ error: 'Failed to update advance' }, { status: 500 });
  }
}
