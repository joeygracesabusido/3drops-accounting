'use strict';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

async function getUserRole() {
  const cookieStore = await cookies();
  return cookieStore.get('userRole')?.value || '';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const pettyCashId = searchParams.get('pettyCashId');
    const status = searchParams.get('status');
    const branchId = searchParams.get('branchId');

    const where: Record<string, unknown> = {};
    if (id) where.id = id;
    if (pettyCashId) where.pettyCashId = pettyCashId;
    if (status) where.status = status;
    if (branchId) where.branchId = branchId;

    const disbursements = await prisma.pettyCashDisbursement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(disbursements);
  } catch (error) {
    console.error('Error fetching disbursements:', error);
    return NextResponse.json({ error: 'Failed to fetch disbursements' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userRole = await getUserRole();
    if (userRole !== 'ADMIN' && userRole !== 'HR' && userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pettyCashId, amount, description, payeeName, reference, expenseAccountId, date, branchId } = body;

    if (!pettyCashId || !amount) {
      return NextResponse.json(
        { error: 'Petty cash fund and amount are required' },
        { status: 400 }
      );
    }

    const pettyCash = await prisma.pettyCash.findUnique({
      where: { id: pettyCashId },
    });

    if (!pettyCash || pettyCash.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Petty cash fund not found or inactive' },
        { status: 400 }
      );
    }

    if (amount > pettyCash.currentBalance) {
      return NextResponse.json(
        { error: 'Insufficient petty cash balance' },
        { status: 400 }
      );
    }

    const userEmail = await getUserEmail();
    const user = await prisma.user.findFirst({
      where: { email: userEmail },
      select: { id: true },
    });

    const userEmployee = await prisma.employee.findFirst({
      where: { email: userEmail },
      select: { id: true },
    });

    const disbursement = await prisma.pettyCashDisbursement.create({
      data: {
        pettyCashId,
        amount,
        date: date ? new Date(date) : new Date(),
        description,
        payeeName: payeeName || userEmail,
        reference,
        expenseAccountId: expenseAccountId || pettyCash.expenseAccountId,
        status: 'PENDING',
        createdById: user?.id,
        employeeId: userEmployee?.id,
        branchId: branchId || undefined,
      },
    });

    await prisma.pettyCash.update({
      where: { id: pettyCashId },
      data: {
        currentBalance: { decrement: amount },
      },
    });

    return NextResponse.json(disbursement);
  } catch (error) {
    console.error('Error creating disbursement:', error);
    return NextResponse.json({ error: 'Failed to create disbursement' }, { status: 500 });
  }
}

async function getUserEmail() {
  const cookieStore = await cookies();
  return cookieStore.get('userEmail')?.value || '';
}

export async function PATCH(request: Request) {
  try {
    const userRole = await getUserRole();
    if (userRole !== 'ADMIN' && userRole !== 'HR' && userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      status: newStatus,
      branchId,
      amount,
      date,
      description,
      payeeName,
      reference,
      expenseAccountId,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const disbursement = await prisma.pettyCashDisbursement.findUnique({
      where: { id },
    });

    if (!disbursement) {
      return NextResponse.json(
        { error: 'Disbursement not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (newStatus !== undefined) {
      updateData.status = newStatus;
      updateData.approvedBy = newStatus === 'APPROVED' ? userRole : null;
      updateData.approvedAt = newStatus === 'APPROVED' ? new Date() : null;
    }
    if (branchId !== undefined) updateData.branchId = branchId;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (date !== undefined) updateData.date = date ? new Date(date) : null;
    if (description !== undefined) updateData.description = description;
    if (payeeName !== undefined) updateData.payeeName = payeeName;
    if (reference !== undefined) updateData.reference = reference;
    if (expenseAccountId !== undefined) updateData.expenseAccountId = expenseAccountId || null;

    // The fund was debited at creation, so an amount correction moves the balance by the delta.
    const amountDelta = amount !== undefined ? disbursement.amount - Number(amount) : 0;
    if (amountDelta < 0) {
      const fund = await prisma.pettyCash.findUnique({
        where: { id: disbursement.pettyCashId },
        select: { currentBalance: true },
      });
      if ((fund?.currentBalance ?? 0) + amountDelta < 0) {
        return NextResponse.json({ error: 'Insufficient petty cash balance' }, { status: 400 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.pettyCashDisbursement.update({
        where: { id },
        data: updateData,
      });

      if (amountDelta !== 0 && disbursement.status !== 'REJECTED') {
        await tx.pettyCash.update({
          where: { id: disbursement.pettyCashId },
          data: { currentBalance: { increment: amountDelta } },
        });
      }

      if (newStatus === 'REJECTED' && disbursement.status !== 'REJECTED') {
        await tx.pettyCash.update({
          where: { id: disbursement.pettyCashId },
          data: { currentBalance: { increment: disbursement.amount } },
        });
      }

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating disbursement:', error);
    return NextResponse.json({ error: 'Failed to update disbursement' }, { status: 500 });
  }
}