import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

interface PunchTime {
  time: Date;
  type: 'IN' | 'OUT';
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

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number | Date | null)[][];
    
    if (jsonData.length === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      absent: 0,
      errors: [] as string[],
    };

    const parseTime = (timeStr: string | number | Date | null | undefined, dateObj: Date): Date | null => {
      if (timeStr === null || timeStr === undefined || timeStr === '') return null;
      
      // Handle Excel numeric time (fraction of a day, e.g., 0.3125 = 7:30 AM)
      if (typeof timeStr === 'number') {
        const totalMinutes = Math.round(timeStr * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const year = dateObj.getUTCFullYear();
        const month = dateObj.getUTCMonth();
        const day = dateObj.getUTCDate();
        return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
      }
      
      const timeStrClean = String(timeStr).trim();
      
      let hours = 0;
      let minutes = 0;
      
      const match = timeStrClean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        const ampm = match[3]?.toUpperCase();
        
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      } else {
        return null;
      }

      // Create date with hours/minutes in UTC to ensure consistency across deployments
      // The dateObj is already in UTC (from parseDate), so we set UTC hours
      const year = dateObj.getUTCFullYear();
      const month = dateObj.getUTCMonth();
      const day = dateObj.getUTCDate();
      return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
    };

    const parseDate = (dateVal: string | number | Date | null): Date | null => {
      if (!dateVal) return null;
      
      if (dateVal instanceof Date) {
        // xlsx adjusts timezone when cellDates: true, but due to historical 1899 timezone offsets
        // in Manila, dates sometimes parse as 23:59:35 of the previous day!
        // We add 12 hours safely to move it to the middle of the intended day before extracting parts.
        const shiftedDate = new Date(dateVal.getTime() + 12 * 60 * 60 * 1000);
        return new Date(Date.UTC(
          shiftedDate.getFullYear(),
          shiftedDate.getMonth(),
          shiftedDate.getDate(),
          0, 0, 0, 0
        ));
      }
      
      // Handle Excel numeric date (days since 1899-12-30)
      if (typeof dateVal === 'number') {
        return new Date(Date.UTC(
          1899,
          11, // December (0-indexed)
          30 + dateVal,
          0, 0, 0, 0
        ));
      }
      
      const dateStr = String(dateVal).trim();
      const dateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!dateMatch) return null;
      
      const [, month, day, year] = dateMatch;
      return new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        0, 0, 0, 0
      ));
    };

    const groupedByEmployee: Map<string, Map<string, { row: (string | number | Date | null)[]; dateObj: Date }>> = new Map();
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length < 2) continue;
      
      const employeeId = String(row[0] || '').trim();
      const dateVal = row[1];
      const dateObj = parseDate(dateVal);
      
      if (!employeeId || !dateObj) continue;
      
      const dateStr = dateObj.toISOString().split('T')[0];
      
      if (!groupedByEmployee.has(employeeId)) {
        groupedByEmployee.set(employeeId, new Map());
      }
      groupedByEmployee.get(employeeId)!.set(dateStr, { row, dateObj });
    }

    for (const [employeeNumber, dateMap] of groupedByEmployee) {
      const employee = await prisma.employee.findFirst({
        where: {
          OR: [
            { employeeNumber: parseInt(employeeNumber, 10) },
            { employeeId: employeeNumber }
          ]
        },
      });

      if (!employee) {
        results.failed += dateMap.size;
        results.errors.push(`Employee not found: ${employeeNumber}`);
        continue;
      }

      for (const [dateStr, { row }] of dateMap) {
        try {
          const dateObj = new Date(dateStr + 'T00:00:00Z'); // Use UTC midnight

          const punches: PunchTime[] = [];
          
          const in1 = parseTime(row[2], dateObj);
          if (in1) punches.push({ time: in1, type: 'IN' });
          
          const out1 = parseTime(row[3], dateObj);
          if (out1) punches.push({ time: out1, type: 'OUT' });
          
          const in2 = parseTime(row[4], dateObj);
          if (in2) punches.push({ time: in2, type: 'IN' });
          
          const out2 = parseTime(row[5], dateObj);
          if (out2) punches.push({ time: out2, type: 'OUT' });
          
          const in3 = parseTime(row[6], dateObj);
          if (in3) punches.push({ time: in3, type: 'IN' });
          
          const out3 = parseTime(row[7], dateObj);
          if (out3) punches.push({ time: out3, type: 'OUT' });

          const hasAnyPunch = punches.length > 0;

          if (!hasAnyPunch) {
            const existingLog = await prisma.timeLog.findFirst({
              where: {
                employeeId: employee.id,
                date: {
                  gte: dateObj,
                  lt: new Date(dateObj.getTime() + 24 * 60 * 60 * 1000),
                },
              },
            });

            if (existingLog) {
              await prisma.timeLog.update({
                where: { id: existingLog.id },
                data: {
                  clockIn: null,
                  clockOut: null,
                  workHours: 0,
                  lateMinutes: 0,
                  undertimeMinutes: 0,
                  notes: 'Absent - No IN/OUT recorded',
                },
              });
            } else {
              await prisma.timeLog.create({
                data: {
                  employeeId: employee.id,
                  date: dateObj,
                  clockIn: null,
                  clockOut: null,
                  workHours: 0,
                  lateMinutes: 0,
                  undertimeMinutes: 0,
                  notes: 'Absent - No IN/OUT recorded',
                },
              });
            }
            results.absent++;
            continue;
          }

          punches.sort((a, b) => a.time.getTime() - b.time.getTime());
          const firstPunch = punches[0];
          const lastPunch = punches[punches.length - 1];

          let lateMinutes = 0;
          let undertimeMinutes = 0;

          const shiftSchedule = await prisma.shiftSchedule.findFirst({
            where: {
              employeeId: employee.id,
              date: {
                gte: dateObj,
                lt: new Date(dateObj.getTime() + 24 * 60 * 60 * 1000),
              },
            },
            include: { shift: true },
          });

          if (shiftSchedule?.shift && !shiftSchedule.shift.isOff && shiftSchedule.shift.startTime !== '-') {
            const [shiftHour, shiftMin] = shiftSchedule.shift.startTime.split(':').map(Number);
            const scheduledTime = new Date(firstPunch.time);
            scheduledTime.setUTCHours(shiftHour, shiftMin, 0, 0);
            
            const lateMs = firstPunch.time.getTime() - scheduledTime.getTime();
            if (lateMs > 60000) {
              lateMinutes = Math.floor(lateMs / 60000);
            }

            if (shiftSchedule.shift.endTime !== '-') {
              const [endHour, endMin] = shiftSchedule.shift.endTime.split(':').map(Number);
              const scheduledEndTime = new Date(lastPunch.time);
              scheduledEndTime.setUTCHours(endHour, endMin, 0, 0);
              
              const undertimeMs = scheduledEndTime.getTime() - lastPunch.time.getTime();
              if (undertimeMs > 60000) {
                undertimeMinutes = Math.floor(undertimeMs / 60000);
              }
            }
          }

          const workHours = firstPunch.time && lastPunch.time
            ? Math.round((lastPunch.time.getTime() - firstPunch.time.getTime()) / (1000 * 60 * 60) * 100) / 100
            : 0;

          const existingLog = await prisma.timeLog.findFirst({
            where: {
              employeeId: employee.id,
              date: {
                gte: dateObj,
                lt: new Date(dateObj.getTime() + 24 * 60 * 60 * 1000),
              },
            },
          });

          if (existingLog) {
            await prisma.timeLog.update({
              where: { id: existingLog.id },
              data: {
                clockIn: firstPunch.time,
                clockOut: lastPunch.time,
                workHours,
                lateMinutes,
                undertimeMinutes,
                notes: 'Imported from XCLS file',
              },
            });
          } else {
            await prisma.timeLog.create({
              data: {
                employeeId: employee.id,
                date: dateObj,
                clockIn: firstPunch.time,
                clockOut: lastPunch.time,
                workHours,
                lateMinutes,
                undertimeMinutes,
                notes: 'Imported from XCLS file',
              },
            });
          }
          results.success++;
        } catch (rowError) {
          results.failed++;
          results.errors.push(`Error processing ${employeeNumber} on ${dateStr}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
        }
      }
    }

    return NextResponse.json({
      message: `Import completed: ${results.success} successful, ${results.absent} absent, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    console.error('Error importing XCLS data:', error);
    return NextResponse.json(
      { error: 'Failed to import XCLS data' },
      { status: 500 }
    );
  }
}
