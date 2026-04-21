import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { cookies } from 'next/headers';
import { getEmployeeIdForUser } from '@/lib/user-employee-link';

interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  absentPerDepartment: Array<{
    name: string;
    absent: number;
    total: number;
  }>;
  personalStats?: {
    isPresent: boolean;
    isOnLeave: boolean;
    employeeName?: string;
    department?: string;
  };
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    // Get employee ID for filtering (null for admin roles)
    const linkedEmployeeId = await getEmployeeIdForUser(userEmail, userRole || '');

    // 1. Get employees (filter by linked employee if EMPLOYEE role)
    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        ...(linkedEmployeeId ? { id: linkedEmployeeId } : {}),
      },
      select: {
        id: true,
        department: true,
        fullName: true,
      },
    });

    // 2. Get today's time logs (filter by linked employee if EMPLOYEE role)
    const todayLogs = await prisma.timeLog.findMany({
      where: {
        date: {
          gte: startOfToday,
          lte: endOfToday,
        },
        ...(linkedEmployeeId ? { employeeId: linkedEmployeeId } : {}),
      },
      select: {
        employeeId: true,
        clockIn: true,
        clockOut: true,
      },
    });

    const presentEmployeeIds = new Set(todayLogs.map((log) => log.employeeId));

    // 3. Get approved leaves for today (filter by linked employee if EMPLOYEE role)
    const activeLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endOfToday },
        endDate: { gte: startOfToday },
        ...(linkedEmployeeId ? { employeeId: linkedEmployeeId } : {}),
      },
      select: {
        employeeId: true,
        leaveType: true,
      },
    });

    const onLeaveEmployeeIds = new Set(activeLeaves.map((leave) => leave.employeeId));

    // 4. Calculate stats based on role
    let stats: DashboardStats;

    if (linkedEmployeeId) {
      // EMPLOYEE role: show only personal stats
      const isPresent = presentEmployeeIds.has(linkedEmployeeId);
      const isOnLeave = onLeaveEmployeeIds.has(linkedEmployeeId);
      const employee = employees[0];

      stats = {
        totalEmployees: 1,
        presentToday: isPresent ? 1 : 0,
        onLeaveToday: isOnLeave ? 1 : 0,
        absentPerDepartment: isPresent || isOnLeave ? [] : [
          {
            name: employee?.department || 'Unassigned',
            absent: 1,
            total: 1,
          },
        ],
        personalStats: {
          isPresent,
          isOnLeave,
          employeeName: employee?.fullName,
          department: employee?.department,
        },
      };
    } else {
      // Admin roles: show all department stats
      const departmentStats: Record<string, { total: number; present: number; absent: number; onLeave: number }> = {};

      employees.forEach((emp) => {
        const dept = emp.department || 'Unassigned';
        if (!departmentStats[dept]) {
          departmentStats[dept] = { total: 0, present: 0, absent: 0, onLeave: 0 };
        }
        
        departmentStats[dept].total++;
        
        if (presentEmployeeIds.has(emp.id)) {
          departmentStats[dept].present++;
        } else if (onLeaveEmployeeIds.has(emp.id)) {
          departmentStats[dept].onLeave++;
          departmentStats[dept].absent++; // Leaves are counted as absent from work
        } else {
          departmentStats[dept].absent++;
        }
      });

      const absentPerDepartment = Object.entries(departmentStats).map(([name, stats]) => ({
        name,
        absent: stats.absent,
        total: stats.total,
      }));

      stats = {
        totalEmployees: employees.length,
        presentToday: presentEmployeeIds.size,
        onLeaveToday: onLeaveEmployeeIds.size,
        absentPerDepartment,
      };
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
