import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

interface TouchlinkLog {
  employeeId: string;
  dateTime: Date;
  status: number;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.trim().split('\n');
    
    if (lines.length === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    const parseTouchlinkLine = (line: string): TouchlinkLog | null => {
      const fields = line.trim().split(/\t+/);
      
      if (fields.length < 2) return null;

      const userId = fields[0].trim();
      const dateTimeStr = fields[1].trim();

      if (!userId || !dateTimeStr) return null;

      // Try to parse the datetime string
      // Format from Touchlink: "2026-03-01 07:58:16" (24-hour) or "2026-03-01 07:58:16 AM/PM"
      let dateTime: Date;
      
      // Try 24-hour format first: YYYY-MM-DD HH:MM:SS
      let match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
      
      if (match) {
        const [, year, month, day, hour, minute, second] = match;
        const hourNum = parseInt(hour);
        // Create date in local time - the device already exports in local time
        // JavaScript will interpret this as the server's local timezone
        dateTime = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          hourNum,
          parseInt(minute),
          parseInt(second)
        );
      } else {
        // Try 12-hour format: YYYY-MM-DD HH:MM:SS AM/PM
        match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/i);
        
        if (match) {
          const [, year, month, day, hour, minute, second, ampm] = match;
          let hourNum = parseInt(hour);
          const isPM = ampm.toUpperCase() === 'PM';
          
          // Convert 12-hour to 24-hour
          if (isPM && hourNum !== 12) hourNum += 12;
          if (!isPM && hourNum === 12) hourNum = 0;
          
          // Create date in local time - no timezone conversion needed
          dateTime = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            hourNum,
            parseInt(minute),
            parseInt(second)
          );
        } else {
          // Fallback to standard parsing
          dateTime = new Date(dateTimeStr);
        }
      }
      
      if (isNaN(dateTime.getTime())) return null;

      const status = fields[2] ? parseInt(fields[2], 10) : 0;

      return {
        employeeId: userId,
        dateTime,
        status,
      };
    };

    const groupedLogs: Map<string, TouchlinkLog[]> = new Map();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const log = parseTouchlinkLine(line);
      
      if (!log) {
        results.failed++;
        results.errors.push(`Line ${i + 1}: Invalid format`);
        continue;
      }

      const key = `${log.employeeId}_${log.dateTime.toISOString().split('T')[0]}`;
      if (!groupedLogs.has(key)) {
        groupedLogs.set(key, []);
      }
      groupedLogs.get(key)!.push(log);
    }

    for (const [key, logs] of groupedLogs) {
      const [employeeId] = key.split('_');
      
      try {
        const employee = await prisma.employee.findFirst({
          where: { 
            OR: [
              { employeeNumber: parseInt(employeeId, 10) },
              { employeeId: employeeId }
            ]
          },
        });

        if (!employee) {
          results.failed += logs.length;
          results.errors.push(`Employee not found for ID "${employeeId}"`);
          continue;
        }

        logs.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
        const firstLog = logs[0];
        const lastLog = logs[logs.length - 1];

        const dateNormalized = new Date(firstLog.dateTime);
        dateNormalized.setHours(0, 0, 0, 0);

        const dateStart = new Date(dateNormalized);
        const dateEnd = new Date(dateNormalized);
        dateEnd.setDate(dateEnd.getDate() + 1);

        // Fetch shift schedule for this employee on this date
        const shiftSchedule = await prisma.shiftSchedule.findFirst({
          where: {
            employeeId: employee.id,
            date: {
              gte: startOfDay(dateNormalized),
              lte: endOfDay(dateNormalized),
            },
          },
          include: { shift: true },
        });

        // Calculate lateMinutes based on shift schedule
        let lateMinutes = 0;
        let undertimeMinutes = 0;
        
        if (shiftSchedule?.shift && !shiftSchedule.shift.isOff && shiftSchedule.shift.startTime !== '-') {
          const [shiftHour, shiftMin] = shiftSchedule.shift.startTime.split(':').map(Number);
          const clockInDate = new Date(firstLog.dateTime);
          const scheduledTime = new Date(clockInDate);
          scheduledTime.setHours(shiftHour, shiftMin, 0, 0);
          
          const lateMs = clockInDate.getTime() - scheduledTime.getTime();
          if (lateMs > 60000) { // More than 1 minute late
            lateMinutes = Math.floor(lateMs / 60000);
          }

          // Calculate undertime if clock out is before scheduled end
          if (shiftSchedule.shift.endTime !== '-') {
            const [endHour, endMin] = shiftSchedule.shift.endTime.split(':').map(Number);
            const clockOutDate = new Date(lastLog.dateTime);
            const scheduledEndTime = new Date(clockOutDate);
            scheduledEndTime.setHours(endHour, endMin, 0, 0);
            
            const undertimeMs = scheduledEndTime.getTime() - clockOutDate.getTime();
            if (undertimeMs > 60000) { // More than 1 minute early
              undertimeMinutes = Math.floor(undertimeMs / 60000);
            }
          }
        }

        const existingLog = await prisma.timeLog.findFirst({
          where: {
            employeeId: employee.id,
            date: {
              gte: dateStart,
              lt: dateEnd,
            },
          },
        });

        if (existingLog) {
          const hasClockIn = existingLog.clockIn !== null;
          const hasClockOut = existingLog.clockOut !== null;

          const updateData: Record<string, unknown> = {
            isEdited: true,
            notes: 'Imported from Touchlink biometric device',
          };

          if (!hasClockIn) {
            updateData.clockIn = firstLog.dateTime;
            updateData.lateMinutes = lateMinutes;
          }
          if (!hasClockOut && logs.length > 1) {
            updateData.clockOut = lastLog.dateTime;
            updateData.undertimeMinutes = undertimeMinutes;
            
            if (firstLog.dateTime && lastLog.dateTime) {
              const hoursWorked = (lastLog.dateTime.getTime() - firstLog.dateTime.getTime()) / (1000 * 60 * 60);
              updateData.workHours = Math.round(hoursWorked * 100) / 100;
            }
          }

          await prisma.timeLog.update({
            where: { id: existingLog.id },
            data: updateData,
          });
        } else {
          const clockIn = firstLog.dateTime;
          const clockOut = logs.length > 1 ? lastLog.dateTime : null;
          
          let workHours = 0;
          if (clockIn && clockOut) {
            workHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
            workHours = Math.round(workHours * 100) / 100;
          }

          await prisma.timeLog.create({
            data: {
              employeeId: employee.id,
              date: dateNormalized,
              clockIn,
              clockOut,
              workHours,
              lateMinutes,
              undertimeMinutes,
              isEdited: true,
              notes: 'Imported from Touchlink biometric device',
            },
          });
        }
        results.success++;
      } catch (rowError) {
        results.failed += logs.length;
        results.errors.push(`Error processing logs for employee "${employeeId}": ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      message: `Import completed: ${results.success} successful, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    console.error('Error importing biometric data:', error);
    return NextResponse.json(
      { error: 'Failed to import biometric data' },
      { status: 500 }
    );
  }
}
