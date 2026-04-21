import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    const whereClause = role ? { role: role.toUpperCase() as 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE' } : {};

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (!userRole || !['ADMIN', 'HR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin or HR access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, status, role } = body;

    if (!userId && !role && !status) {
      return NextResponse.json(
        { error: 'User ID and at least one field (status or role) is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['FOR_APPROVAL', 'APPROVED', 'REJECTED'];
    const validRoles = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'];

    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (status) updateData.status = status;
    if (role) updateData.role = role;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({
      message: 'User updated successfully',
      user,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
