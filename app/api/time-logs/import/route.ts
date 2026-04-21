import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
    
    // Normalize column names to handle variations like "Employee Number", "employee_number", "Clock In", etc.
    const data = rawData.map(row => {
      const normalized: Record<string, unknown> = {};
      for (const key of Object.keys(row)) {
        // Convert to camelCase: "Employee Number" -> "employeeNumber", "clock_in" -> "clockIn"
        const normalizedKey = key
          .replace(/^[._\s]+/, '')           // Remove leading spaces/dots
          .replace(/[._\s]+([a-zA-Z])/g, (_, c) => c.toUpperCase()) // camelCase
          .replace(/^[a-zA-Z]/, c => c.toLowerCase()); // lowercase first char
        normalized[normalizedKey] = row[key];
      }
      return normalized;
    });

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'File is empty or has no valid data' },
        { status: 400 }
      );
    }

    // Log first row keys for debugging
    console.log('[Time Logs Import] Column headers found:', Object.keys(data[0]));

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    const parseTime = (timeVal: unknown, baseDate: Date): Date | null => {
      if (timeVal == null) return null;

      const res = new Date(baseDate);

      if (timeVal instanceof Date) {
        res.setHours(timeVal.getHours(), timeVal.getMinutes(), 0, 0);
        return res;
      }

      if (typeof timeVal === 'number') {
        // Excel time is a fraction of a day
        const totalMinutes = Math.round(timeVal * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        res.setHours(hours, minutes, 0, 0);
        return res;
      }

      if (typeof timeVal === 'string') {
        const parts = timeVal.split(':');
        if (parts.length >= 2) {
          const hours = parseInt(parts[0], 10);
          const minutes = parseInt(parts[1], 10);
          if (!isNaN(hours) && !isNaN(minutes)) {
            res.setHours(hours, minutes, 0, 0);
            return res;
          }
        }
      }

      return null;
    };

    for (const row of data) {
      try {
        const rowKeys = Object.keys(row).join(', ');
        
        if (!row.employeeNumber || !row.date) {
          results.failed++;
          results.errors.push(`Row skipped: missing employeeNumber or date. Available columns: ${rowKeys}`);
          continue;
        }

        const employee = await prisma.employee.findFirst({
          where: { employeeNumber: parseInt(String(row.employeeNumber)) },
        });

        if (!employee) {
          results.failed++;
          results.errors.push(`Employee not found: ${row.employeeNumber}`);
          continue;
        }

        let dateObj: Date;
        if (row.date instanceof Date) {
          dateObj = row.date;
        } else if (typeof row.date === 'number') {
          // Handle Excel numeric date
          dateObj = new Date((row.date - 25569) * 86400 * 1000);
        } else {
          dateObj = new Date(String(row.date));
        }

        if (isNaN(dateObj.getTime())) {
          results.failed++;
          results.errors.push(`Invalid date for employee ${row.employeeNumber}: ${row.date}`);
          continue;
        }

        // Normalize date to 00:00:00
        const dateNormalized = new Date(dateObj);
        dateNormalized.setHours(0, 0, 0, 0);

        const dateStart = new Date(dateNormalized);
        const dateEnd = new Date(dateNormalized);
        dateEnd.setDate(dateEnd.getDate() + 1);

        const existingLog = await prisma.timeLog.findFirst({
          where: {
            employeeId: employee.id,
            date: {
              gte: dateStart,
              lt: dateEnd,
            },
          },
        });

        const clockInTime = parseTime(row.clockIn, dateNormalized);
        const clockOutTime = parseTime(row.clockOut, dateNormalized);
        
        // Log if times are null for debugging
        if (!clockInTime || !clockOutTime) {
          console.log('[Time Logs Import] Row data:', {
            employeeNumber: row.employeeNumber,
            date: row.date,
            clockIn: row.clockIn,
            clockOut: row.clockOut,
            clockInParsed: clockInTime,
            clockOutParsed: clockOutTime,
          });
        }

        let workHours = 0;
        let otHours = 0;
        if (clockInTime && clockOutTime) {
          workHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
          workHours = Math.round(workHours * 100) / 100;
          otHours = Math.max(0, workHours - 8);
        }

        if (existingLog) {
          await prisma.timeLog.update({
            where: { id: existingLog.id },
            data: {
              clockIn: clockInTime || existingLog.clockIn,
              clockOut: clockOutTime || existingLog.clockOut,
              workHours: workHours || existingLog.workHours,
              otHours: otHours || existingLog.otHours,
              notes: (row.notes as string) || existingLog.notes,
              isEdited: true,
            },
          });
        } else {
          await prisma.timeLog.create({
            data: {
              employeeId: employee.id,
              date: dateNormalized,
              clockIn: clockInTime,
              clockOut: clockOutTime,
              workHours,
              otHours,
              notes: (row.notes as string) || '',
            },
          });
        }

        results.success++;
      } catch (rowError) {
        results.failed++;
        results.errors.push(`Error processing row: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      message: `Import completed: ${results.success} successful, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    console.error('Error importing time logs:', error);
    return NextResponse.json(
      { error: 'Failed to import time logs' },
      { status: 500 }
    );
  }
}
