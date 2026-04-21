import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get('isLoggedIn')?.value;

    if (isLoggedIn !== 'true') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Face Descriptor API] Fetching for employeeId:', params.id);
    
    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      select: { faceDescriptor: true, fullName: true, employeeId: true },
    });

    if (!employee) {
      console.log('[Face Descriptor API] Employee not found:', params.id);
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (!employee.faceDescriptor || employee.faceDescriptor.length === 0) {
      console.log('[Face Descriptor API] No face descriptor for', employee.fullName, '(' + employee.employeeId + ')');
      return NextResponse.json({ 
        error: 'No face descriptor enrolled for this employee',
        employeeName: employee.fullName 
      }, { status: 404 });
    }

    console.log('[Face Descriptor API] Found descriptor for', employee.fullName, '- length:', employee.faceDescriptor.length);
    return NextResponse.json({ faceDescriptor: employee.faceDescriptor });
  } catch (error) {
    console.error('[FACE_GET_DESCRIPTOR_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
