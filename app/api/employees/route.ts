import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cache } from '@/lib/redis';
import { calculateDailyRate } from '@/lib/payroll';
import { cookies } from 'next/headers';
import { getEmployeeIdForUser } from '@/lib/user-employee-link';

const EMPLOYEES_CACHE_KEY = 'employees:all';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position');

    // Get employee ID for user (with auto-linking)
    const linkedEmployeeId = await getEmployeeIdForUser(userEmail, userRole || '');

    // Build where clause based on role
    const whereClause: Record<string, unknown> = {};

    if (position) {
      whereClause.position = { contains: position, mode: 'insensitive' as const };
    }

    // If employee, only show their own record
    if (linkedEmployeeId) {
      whereClause.id = linkedEmployeeId;
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Only ADMIN and HR can create employees
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Unauthorized. Only admins and HR can create employees.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      fullName, email, position, department, basicSalary, dailyRate, payType,
      payrollFrequency, managerId, hireDate, tin, sssNo, philhealthNo, pagibigNo, bankName, bankAccountNo,
      employeeStatus, regularizationDate,
    } = body;

    const maxEmployee = await prisma.employee.findFirst({ 
      orderBy: { employeeNumber: 'desc' },
      where: { NOT: { employeeNumber: null } }
    });
    
    const nextNumber = (maxEmployee?.employeeNumber || 0) + 1;
    const employeeId = `EMP-${String(nextNumber).padStart(4, '0')}`;

    const employee = await prisma.employee.create({
      data: {
        employeeNumber: nextNumber,
        fullName, email,
        employeeId,
        position, department,
        payType: payType || 'MONTHLY',
        basicSalary: parseFloat(basicSalary || '0'),
        dailyRate: payType === 'DAILY' ? (parseFloat(dailyRate) || calculateDailyRate(parseFloat(basicSalary))) : parseFloat(dailyRate || '0'),
        payrollFrequency,
        managerId: managerId || null,
        hireDate: new Date(hireDate),
        tin: tin || '', sssNo: sssNo || '', philhealthNo: philhealthNo || '', pagibigNo: pagibigNo || '',
        bankName: bankName || '', bankAccountNo: bankAccountNo || '',
        isActive: true,
        employeeStatus: employeeStatus || 'PROBATIONARY',
        regularizationDate: regularizationDate ? new Date(regularizationDate) : null,
      },
    });

    await cache.del(EMPLOYEES_CACHE_KEY);
    return NextResponse.json({ message: 'Employee created successfully', employee }, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Failed to create employee', details: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    // Only ADMIN and HR can update employees
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Unauthorized. Only admins and HR can update employees.' }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'employeeId', 'fullName', 'email', 'position', 'department', 'basicSalary', 'dailyRate', 'payType',
      'payrollFrequency', 'managerId', 'hireDate', 'tin', 'sssNo', 'philhealthNo',
      'pagibigNo', 'bankName', 'bankAccountNo', 'isActive', 'employeeStatus', 'regularizationDate'
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        if (field === 'basicSalary' || field === 'dailyRate') {
          updateData[field] = parseFloat(String(body[field]));
        } else if (field === 'hireDate' || field === 'regularizationDate') {
          const dateValue = body[field];
          if (dateValue && dateValue !== '') {
            updateData[field] = new Date(dateValue);
          } else {
            updateData[field] = null;
          }
        } else {
          updateData[field] = body[field];
        }
      }
    });

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
    });

    await cache.del(EMPLOYEES_CACHE_KEY);
    return NextResponse.json({ message: 'Employee updated successfully', employee }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error updating employee:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update employee', details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    // Only ADMIN can delete employees
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Only admins can delete employees.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    await prisma.employee.delete({ where: { id } });
    await cache.del(EMPLOYEES_CACHE_KEY);
    return NextResponse.json({ message: 'Employee deleted successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}
