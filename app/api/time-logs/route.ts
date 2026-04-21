import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { cookies } from 'next/headers';
import { buildRoleBasedWhereClause } from '@/lib/auth-helpers';

const MANILA_TIMEZONE = 'Asia/Manila';

function getManilaNow(): Date {
  const now = new Date();
  const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: MANILA_TIMEZONE }));
  return manilaTime;
}

function getManilaToday(): { start: Date; end: Date } {
  const now = getManilaNow();
  return {
    start: startOfDay(now),
    end: endOfDay(now),
  };
}

// Haversine formula to calculate distance between two GPS coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Get all active office locations
async function getActiveOfficeLocations() {
  try {
    const locations = await prisma.officeLocation.findMany({
      where: { isActive: true },
    });
    return locations;
  } catch (error) {
    console.error('Error fetching office locations:', error);
    return [];
  }
}

// Validate GPS location against all active office geofences
async function validateGPS(latitude: number, longitude: number) {
  const activeLocations = await getActiveOfficeLocations();

  // If no office locations are set, allow by default
  if (activeLocations.length === 0) {
    return { valid: true, distance: 0 };
  }

  let minDistance = Infinity;
  let minRadius = 0;

  for (const location of activeLocations) {
    const distance = calculateDistance(
      latitude,
      longitude,
      location.latitude,
      location.longitude
    );

    if (distance <= location.radius) {
      return {
        valid: true,
        distance,
        radius: location.radius,
      };
    }

    if (distance < minDistance) {
      minDistance = distance;
      minRadius = location.radius;
    }
  }

  return {
    valid: false,
    distance: minDistance,
    radius: minRadius,
  };
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
    const employeeIdParam = searchParams.get('employeeId');

    // Build role-based where clause
    const where = await buildRoleBasedWhereClause(userEmail, userRole || '', employeeIdParam ?? undefined);

    const timeLogs = await prisma.timeLog.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const employeeIds = Array.from(new Set(timeLogs.map(log => log.employeeId)));
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, fullName: true, employeeId: true },
    });
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    // Fetch all active holidays
    const holidays = await prisma.holiday.findMany({
      where: { isActive: true, branchId: null },
    })
    const holidayMap = new Map(
      holidays.map(h => [new Date(h.date).toLocaleDateString(), h])
    );

    const formattedLogs = await Promise.all(timeLogs.map(async (log) => {
      const emp = employeeMap.get(log.employeeId);
      const logDateStr = new Date(log.date).toLocaleDateString();
      const holiday = holidayMap.get(logDateStr) || null;
      
      const schedule = await prisma.shiftSchedule.findFirst({
        where: {
          employeeId: log.employeeId,
          date: {
            gte: startOfDay(new Date(log.date)),
            lte: endOfDay(new Date(log.date)),
          }
        },
        include: {
          shift: true
        }
      });

      return {
        ...log,
        shift: schedule?.shift || null,
        holiday,
        employee: emp ? {
          fullName: emp.fullName,
          employeeId: emp.employeeId,
        } : { fullName: 'Unknown', employeeId: 'N/A' },
      };
    }));

    return NextResponse.json(formattedLogs);
  } catch (error) {
    console.error('Error fetching time logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, type, latitude, longitude } = body;

    if (!employeeId || !type) {
      return NextResponse.json({ error: 'Employee ID and type are required' }, { status: 400 });
    }

    // Validate GPS location if provided
    let gpsValid = true;
    let gpsDistance = 0;
    let gpsRadius = 0;
    
    if (latitude !== undefined && longitude !== undefined) {
      const gpsResult = await validateGPS(latitude, longitude);
      gpsValid = gpsResult.valid;
      gpsDistance = gpsResult.distance;
      gpsRadius = gpsResult.radius ?? 0;
    } else {
      // If no GPS provided, check if office location is configured
      const activeLocations = await getActiveOfficeLocations();
      if (activeLocations.length > 0) {
        return NextResponse.json(
          { error: 'GPS location is required. Please enable location services.' },
          { status: 400 }
        );
      }
    }

    // Reject if outside geofence
    if (!gpsValid) {
      return NextResponse.json(
        { 
          error: `You must be within ${gpsRadius} meters of the office to ${type}. Current distance: ${Math.round(gpsDistance)} meters` 
        },
        { status: 403 }
      );
    }

    const now = getManilaNow();
    const { start: todayStart, end: todayEnd } = getManilaToday();

    const existingLog = await prisma.timeLog.findFirst({
      where: {
        employeeId,
        date: { gte: todayStart, lte: todayEnd },
      },
    });

    if (type === 'clockIn') {
      if (existingLog && existingLog.clockIn) {
        return NextResponse.json({ error: 'You have already clocked in today' }, { status: 400 });
      }

      // Calculate lateness if a shift is assigned
      let lateMinutes = 0;
      const schedule = await prisma.shiftSchedule.findFirst({
        where: {
          employeeId,
          date: { gte: todayStart, lte: todayEnd },
        },
        include: { shift: true }
      });

      if (schedule?.shift && !schedule.shift.isOff && schedule.shift.startTime !== '-') {
        const [sHour, sMin] = schedule.shift.startTime.split(':').map(Number);
        const scheduledTime = new Date(now.getTime());
        scheduledTime.setHours(sHour, sMin, 0, 0);
        
        const diffMs = now.getTime() - scheduledTime.getTime();
        if (diffMs > 60000) { // More than 1 minute late
          lateMinutes = Math.floor(diffMs / 60000);
        }
      }

      if (existingLog) {
        await prisma.timeLog.update({
          where: { id: existingLog.id },
          data: { 
            clockIn: now, 
            lateMinutes,
            clockInLatitude: latitude,
            clockInLongitude: longitude,
          },
        });
      } else {
        await prisma.timeLog.create({
          data: {
            employeeId,
            date: now,
            clockIn: now,
            lateMinutes,
            clockInLatitude: latitude,
            clockInLongitude: longitude,
          },
        });
      }
      return NextResponse.json({ message: 'Clock in recorded successfully' });
    }

    if (type === 'clockOut') {
      if (!existingLog) {
        return NextResponse.json({ error: 'You have not clocked in today' }, { status: 400 });
      }
      if (existingLog.clockOut) {
        return NextResponse.json({ error: 'You have already clocked out today' }, { status: 400 });
      }

      const clockInTime = new Date(existingLog.clockIn!);
      const hoursWorked = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      await prisma.timeLog.update({
        where: { id: existingLog.id },
        data: {
          clockOut: now,
          workHours: Math.round(hoursWorked * 100) / 100,
          clockOutLatitude: latitude,
          clockOutLongitude: longitude,
        },
      });

      return NextResponse.json({ message: 'Clock out recorded successfully' });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Error recording time log:', error);
    return NextResponse.json({ error: 'Failed to record time log' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Time log ID is required' }, { status: 400 });
    }

    await prisma.timeLog.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Time log deleted successfully' });
  } catch (error) {
    console.error('Error deleting time log:', error);
    return NextResponse.json({ error: 'Failed to delete time log' }, { status: 500 });
  }
}
