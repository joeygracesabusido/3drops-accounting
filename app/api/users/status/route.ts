import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, status } = body;

    if (!userId || !status) {
      return NextResponse.json(
        { error: 'User ID and status are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    return NextResponse.json({
      message: `User ${status.toLowerCase()} successfully`,
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
