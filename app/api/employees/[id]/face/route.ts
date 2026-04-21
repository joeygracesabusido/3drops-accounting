import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    const isLoggedIn = cookieStore.get('isLoggedIn')?.value;

    if (isLoggedIn !== 'true') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN or HR can enroll faces
    if (userRole !== 'ADMIN' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Forbidden – only ADMIN or HR can enroll faces' }, { status: 403 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const body = await request.json();
    const { faceDescriptor } = body;

    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length === 0) {
      return NextResponse.json({ error: 'Invalid face descriptor' }, { status: 400 });
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        faceDescriptor: faceDescriptor,
      },
    });

    return NextResponse.json({
      message: 'Face descriptor enrolled successfully',
      employeeId: updatedEmployee.id,
    });
  } catch (error) {
    console.error('[FACE_ENROLL_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
