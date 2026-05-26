/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  calculateSSS,
  calculatePhilHealth,
  calculatePagIBIG,
  calculateWithholdingTax,
  calculateDailyRate,
  calculateHourlyRate
} from '@/lib/payroll';
import { cache } from '@/lib/redis';
import { cookies } from 'next/headers';
import { hasAdminAccess } from '@/lib/auth-helpers';
import { getEmployeeIdForUser } from '@/lib/user-employee-link';

export const dynamic = 'force-dynamic';

const PAYROLL_CACHE_PREFIX = 'payroll:';

function calculateSemiMonthlySalary(monthlySalary: number, frequency: string): number {
  if (frequency === 'SEMIMONTHLY') {
    return monthlySalary / 2;
  }
  return monthlySalary;
}

function countWorkingDays(
  start: Date,
  end: Date,
  holidays: { isActive: boolean; date: Date }[] = []
): number {
  let count = 0;
  
  // Create dates in local timezone to avoid UTC issues
  
  const holidayDates = new Set(
    holidays
      .filter((h) => h.isActive)
      .map((h) => new Date(h.date).toISOString().split('T')[0])
  );

  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    const dateStr = cur.toISOString().split('T')[0];
    if (day !== 0 && day !== 6 && !holidayDates.has(dateStr)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export async function POST(request: Request) {
  try {
    // Only ADMIN and HR can compute payroll
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Unauthorized. Only admins and HR can compute payroll.' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      employeeId, 
      periodStart, 
      periodEnd, 
      frequency, 
      deductions = ['sss', 'philhealth', 'pagibig', 'tax', 'cash_advance', 'sss_loan', 'pagibig_loan'],
      adjustmentAdd = 0,
      adjustmentDeduct = 0,
      adjustmentReason = ''
    } = body;

    if (!periodStart || !periodEnd || !frequency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Parse dates in local timezone to avoid UTC issues
    const [startYear, startMonth, startDay] = periodStart.split('-').map(Number);
    const [endYear, endMonth, endDay] = periodEnd.split('-').map(Number);
    const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);
    const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);

    const includeSSS = deductions.includes('sss');
    const includePhilHealth = deductions.includes('philhealth');
    const includePagIBIG = deductions.includes('pagibig');
    const includeTax = deductions.includes('tax');

    // Map frontend IDs to DB types
    const selectedAdvanceTypes = [];
    if (deductions.includes('cash_advance')) selectedAdvanceTypes.push('CASH_ADVANCE');
    if (deductions.includes('sss_loan')) selectedAdvanceTypes.push('SSS_LOAN');
    if (deductions.includes('pagibig_loan')) selectedAdvanceTypes.push('PAGIBIG_LOAN');

    // Fetch holidays for the period
    const holidays = await prisma.holiday.findMany({
      where: {
        isActive: true,
        branchId: null,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    if (employeeId === 'all') {
      const employees = await prisma.employee.findMany();
      
      const results = [];
      const errors = [];

      for (const employee of employees) {
        try {
          const existingPayroll = await prisma.payroll.findFirst({
            where: {
              employeeId: employee.id,
              periodStart: { gte: startDate },
              periodEnd: { lte: endDate },
            },
          });

          if (existingPayroll) {
            errors.push({ employee: employee.fullName, error: 'Payroll already exists for this period' });
            continue;
          }

          const timeLogs = await prisma.timeLog.findMany({
            where: {
              employeeId: employee.id,
              date: { gte: startDate, lte: endDate },
            },
          });

          const leaves = await prisma.leaveRequest.findMany({
            where: {
              employeeId: employee.id,
              status: 'APPROVED',
              startDate: { lte: endDate },
              endDate: { gte: startDate },
            },
          });

          const shiftSchedules = await prisma.shiftSchedule.findMany({
            where: {
              employeeId: employee.id,
              date: { gte: startDate, lte: endDate },
            },
            include: { shift: true },
          });

          const offDaysInPeriod = shiftSchedules.filter(s => s.shift.isOff).length;

          const approvedOvertimeLogs = timeLogs.filter(log => log.otStatus === 'APPROVED' && log.otHours > 0);
          const totalLogOtHours = approvedOvertimeLogs.reduce((sum, log) => sum + log.otHours, 0);

          const approvedOtRequests = await prisma.overtimeRequest.findMany({
            where: {
              employeeId: employee.id,
              status: 'APPROVED',
              date: { gte: startDate, lte: endDate },
            },
          });
          const totalRequestOtHours = approvedOtRequests.reduce((sum, req) => sum + req.hours, 0);

          const totalOtHours = totalLogOtHours + totalRequestOtHours;
          const totalLates = timeLogs.reduce((sum, log) => sum + (log.lateMinutes || 0), 0);
          const totalUndertime = timeLogs.reduce((sum, log) => sum + (log.undertimeMinutes || 0), 0);

          const monthlySalary = employee.payType === 'DAILY' 
            ? (employee.dailyRate * 26) 
            : employee.basicSalary;
          const employeePayType = employee.payType || 'MONTHLY';
          const employeeDailyRate = employee.dailyRate || calculateDailyRate(monthlySalary) || 0;
          
          let periodSalary = 0;
          const dailyRate = employeeDailyRate;
          
          if (employeePayType === 'DAILY') {
            periodSalary = 0;
          } else {
            periodSalary = calculateSemiMonthlySalary(monthlySalary, frequency);
          }
          
          const hourlyRate = calculateHourlyRate(employeePayType === 'DAILY' ? employeeDailyRate * 26 : monthlySalary);
          const otPay = totalOtHours * hourlyRate * 1.25;
          
          const leaveDays = leaves.reduce((sum, leave) => sum + leave.daysCount, 0);
          
          const workDaysInPeriod = countWorkingDays(startDate, endDate, holidays);
          
          // Calculate holiday pay
          let holidayPay = 0;
          let regularHolidayDays = 0;
          let specialHolidayDays = 0;
          
          // Create a map of time logs by date for quick lookup
          const timeLogByDate = new Map<string, typeof timeLogs[0]>();
          for (const log of timeLogs) {
            const dateStr = new Date(log.date).toLocaleDateString('en-CA');
            timeLogByDate.set(dateStr, log);
          }

          // Get sorted dates for before/after checking
          const sortedDates = Array.from(timeLogByDate.keys()).sort();
          
          for (const holiday of holidays) {
            if (!holiday.isActive) continue;
            
            const hDateStr = new Date(holiday.date).toLocaleDateString('en-CA');
            const holidayLog = timeLogByDate.get(hDateStr);
            const workedOnHoliday = holidayLog && holidayLog.workHours > 0 && holidayLog.clockIn && holidayLog.clockOut;

            // Check attendance before/after holiday
            const holidayDate = new Date(hDateStr);
            const datesBefore = sortedDates.filter(d => new Date(d) < holidayDate);
            const datesAfter = sortedDates.filter(d => new Date(d) > holidayDate);
            const hasAttendanceBefore = datesBefore.length > 0;
            const hasAttendanceAfter = datesAfter.length > 0;
            const hasAttendanceBeforeAndAfter = hasAttendanceBefore && hasAttendanceAfter;
            
            if (holiday.type === 'REGULAR') {
              // If worked on holiday with attendance before AND after
              if (workedOnHoliday && hasAttendanceBeforeAndAfter) {
                regularHolidayDays += 1;
              } else if (!workedOnHoliday && hasAttendanceBefore) {
                // Did not work on holiday but has attendance on/before holiday (legal holiday benefit)
                regularHolidayDays += 1;
              }
            } else if (holiday.type === 'SPECIAL') {
              // Special holiday requires working AND attendance before AND after
              if (workedOnHoliday && hasAttendanceBeforeAndAfter) {
                specialHolidayDays += 1;
              }
            }
          }
          
          // Philippine Labor Law holiday pay rates (DOLE):
          // - REGULAR holiday worked (and present day before): Additional 100% of daily wage
          // - SPECIAL holiday worked: Additional 30% of daily wage
          // - The base salary already includes regular pay for worked days
          if (regularHolidayDays > 0) {
            holidayPay += regularHolidayDays * dailyRate * 1.0; // Additional 100% (premium only)
          }
          if (specialHolidayDays > 0) {
            holidayPay += specialHolidayDays * dailyRate * 0.3; // Additional 30% (premium only)
          }
          holidayPay = Math.round(holidayPay * 100) / 100;
          
          // For semi-monthly: fixed 13 days per period, for monthly: 26 days
          // Off days are added to expected (they're not counted as absences)
          let expectedWorkDays = 0;
          if (frequency === 'SEMIMONTHLY') {
            expectedWorkDays = 13 + offDaysInPeriod;
          } else if (frequency === 'MONTHLY') {
            expectedWorkDays = 26 + offDaysInPeriod;
          } else {
            expectedWorkDays = Math.max(0, workDaysInPeriod - leaveDays);
          }
           
          // Subtract leave days from expected
          expectedWorkDays = Math.max(0, expectedWorkDays - leaveDays);
           
          const daysWithTimeLog = timeLogs.filter(log => log.clockIn !== null && log.clockOut !== null).length;
          
          let grossPay = 0;
          let otherDeductions = 0;
          
          if (employeePayType === 'DAILY') {
            grossPay = (daysWithTimeLog * dailyRate) + otPay + holidayPay + adjustmentAdd - adjustmentDeduct;
          } else {
            // Gross pay = base salary + OT + holiday pay + adjustments (no deductions yet)
            grossPay = periodSalary + otPay + holidayPay + adjustmentAdd - adjustmentDeduct;
            // Absences, lates, and undertime are separate deductions
            const absentDays = Math.max(0, expectedWorkDays - daysWithTimeLog);
            const absenceDeduction = absentDays * dailyRate;
            const lateDeduction = (totalLates / 60) * hourlyRate;
            const undertimeDeduction = (totalUndertime / 60) * hourlyRate;
            otherDeductions = absenceDeduction + lateDeduction + undertimeDeduction;
          }

          // Using lib/payroll functions for 2026 rates
          const sss = includeSSS ? calculateSSS(monthlySalary) : { employeeShare: 0, employerShare: 0 };
          const philHealth = includePhilHealth ? calculatePhilHealth(monthlySalary) : { employeeShare: 0, employerShare: 0 };
          const pagIbig = includePagIBIG ? calculatePagIBIG(monthlySalary) : { employeeShare: 0, employerShare: 0 };
          
          const totalGovDeductions = sss.employeeShare + philHealth.employeeShare + pagIbig.employeeShare;
          const taxableIncome = grossPay - totalGovDeductions;
          const withholdingTax = includeTax ? calculateWithholdingTax(taxableIncome, frequency) : 0;
          
          // Fetch active advances for this employee if selected by type
          const activeAdvances = selectedAdvanceTypes.length > 0 ? await prisma.advance.findMany({
            where: {
              employeeId: employee.id,
              status: 'ACTIVE',
              remainingBalance: { gt: 0 },
              type: { in: selectedAdvanceTypes }
            }
          }) : [];

          let totalAdvanceDeductions = 0;
          const advancePaymentsData = [];

          for (const advance of activeAdvances) {
            // Only deduct up to what's remaining
            const deduction = Math.min(advance.deductionAmount, advance.remainingBalance);
            if (deduction > 0) {
              totalAdvanceDeductions += deduction;
              advancePaymentsData.push({
                advanceId: advance.id,
                amount: deduction,
                balanceAfter: advance.remainingBalance - deduction,
                notes: `Deducted from payroll for ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
              });
            }
          }

          const totalDeductions = totalGovDeductions + withholdingTax + otherDeductions + totalAdvanceDeductions;
          const netPay = grossPay - totalDeductions;

          const payroll = await prisma.payroll.create({
            data: {
              employee: { connect: { id: employee.id } },
              month: startDate.getMonth() + 1,
              year: startDate.getFullYear(),
              periodStart: startDate,
              periodEnd: endDate,
              basicSalary: employeePayType === 'DAILY' ? (daysWithTimeLog * dailyRate) : (periodSalary || 0),
              dailyRate: dailyRate || 0,
              workDays: expectedWorkDays,
              daysWorked: daysWithTimeLog,
              otHours: totalOtHours,
              otPay,
              holidayPay,
              grossPay,
              sssEmployee: sss.employeeShare,
              sssEmployer: sss.employerShare,
              philhealthEmployee: philHealth.employeeShare,
              philhealthEmployer: philHealth.employerShare,
              pagibigEmployee: pagIbig.employeeShare,
              pagibigEmployer: pagIbig.employerShare,
              withholdingTax,
              lateMinutes: totalLates,
              undertimeMinutes: totalUndertime,
              otherDeductions: otherDeductions + totalAdvanceDeductions,
              adjustmentAdd,
              adjustmentDeduct,
              adjustmentReason,
              totalDeductions,
              netPay,
              status: 'PROCESSED',
              processedAt: new Date(),
            },
          });

          // Create advance payment records and update advance balances
          for (const paymentData of advancePaymentsData) {
            await prisma.advancePayment.create({
              data: {
                ...paymentData,
                payrollId: payroll.id,
                paymentDate: new Date()
              }
            });

            await prisma.advance.update({
              where: { id: paymentData.advanceId },
              data: {
                remainingBalance: paymentData.balanceAfter,
                status: paymentData.balanceAfter <= 0 ? 'FULLY_PAID' : 'ACTIVE'
              }
            });
          }

          results.push({
            payroll,
            employee: {
              id: employee.id,
              fullName: employee.fullName,
              employeeNumber: employee.employeeNumber,
              position: employee.position,
              department: employee.department,
              payType: employee.payType,
              dailyRate: employeeDailyRate,
            },
            netPay,
          });
        } catch {
          errors.push({ employee: employee.fullName, error: 'Failed to compute payroll' });
        }
      }

      return NextResponse.json({
        message: `Payroll computed for ${results.length} employees`,
        totalEmployees: employees.length,
        successCount: results.length,
        errorCount: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const existingPayroll = await prisma.payroll.findFirst({
      where: {
        employeeId,
        periodStart: { gte: startDate },
        periodEnd: { lte: endDate },
      },
    });

    if (existingPayroll) {
      return NextResponse.json(
        { error: 'Payroll already exists for this period. Use update to modify.' },
        { status: 409 }
      );
    }

    const timeLogs = await prisma.timeLog.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    const shiftSchedules = await prisma.shiftSchedule.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
      include: { shift: true },
    });

    const offDaysInPeriod = shiftSchedules.filter(s => s.shift.isOff).length;

    const approvedOvertimeLogs = timeLogs.filter(log => log.otStatus === 'APPROVED' && log.otHours > 0);
    const totalLogOtHours = approvedOvertimeLogs.reduce((sum, log) => sum + log.otHours, 0);

    const approvedOtRequests = await prisma.overtimeRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        date: { gte: startDate, lte: endDate },
      },
    });
    const totalRequestOtHours = approvedOtRequests.reduce((sum, req) => sum + req.hours, 0);

    const totalOtHours = totalLogOtHours + totalRequestOtHours;

    const totalLates = timeLogs.reduce((sum, log) => sum + (log.lateMinutes || 0), 0);
    const totalUndertime = timeLogs.reduce((sum, log) => sum + (log.undertimeMinutes || 0), 0);

    const monthlySalary = employee.payType === 'DAILY' 
      ? (employee.dailyRate * 26) 
      : employee.basicSalary;
    const employeePayType = employee.payType || 'MONTHLY';
    const employeeDailyRate = employee.dailyRate || calculateDailyRate(monthlySalary) || 0;
    
    let periodSalary = 0;
    const dailyRate = employeeDailyRate;
    
    if (employeePayType === 'DAILY') {
      periodSalary = 0;
    } else {
      periodSalary = calculateSemiMonthlySalary(monthlySalary, frequency);
    }
    
    const hourlyRate = calculateHourlyRate(employeePayType === 'DAILY' ? employeeDailyRate * 26 : monthlySalary);
    const otPay = totalOtHours * hourlyRate * 1.25;

    const leaveDays = leaves.reduce((sum, leave) => sum + leave.daysCount, 0);

    // Calculate working days from calendar for reference
    const workDaysInPeriod = countWorkingDays(startDate, endDate, holidays);
    
    // Calculate holiday pay
    let holidayPay = 0;
    let regularHolidayDays = 0;
    let specialHolidayDays = 0;
    
    // Create a map of time logs by date for quick lookup
    const timeLogByDate = new Map<string, typeof timeLogs[0]>();
    for (const log of timeLogs) {
      const dateStr = new Date(log.date).toLocaleDateString('en-CA');
      timeLogByDate.set(dateStr, log);
    }

    // Get sorted dates for before/after checking
    const sortedDates = Array.from(timeLogByDate.keys()).sort();
    
    for (const holiday of holidays) {
      if (!holiday.isActive) continue;
      
      const hDateStr = new Date(holiday.date).toLocaleDateString('en-CA');
      const holidayLog = timeLogByDate.get(hDateStr);
      const workedOnHoliday = holidayLog && holidayLog.workHours > 0 && holidayLog.clockIn && holidayLog.clockOut;

      // Check attendance before/after holiday
      const holidayDate = new Date(hDateStr);
      const datesBefore = sortedDates.filter(d => new Date(d) < holidayDate);
      const datesAfter = sortedDates.filter(d => new Date(d) > holidayDate);
      const hasAttendanceBefore = datesBefore.length > 0;
      const hasAttendanceAfter = datesAfter.length > 0;
      const hasAttendanceBeforeAndAfter = hasAttendanceBefore && hasAttendanceAfter;
      
      if (holiday.type === 'REGULAR') {
        // If worked on holiday with attendance before AND after
        if (workedOnHoliday && hasAttendanceBeforeAndAfter) {
          regularHolidayDays += 1;
        } else if (!workedOnHoliday && hasAttendanceBefore) {
          // Did not work on holiday but has attendance on/before holiday (legal holiday benefit)
          regularHolidayDays += 1;
        }
      } else if (holiday.type === 'SPECIAL') {
        // Special holiday requires working AND attendance before AND after
        if (workedOnHoliday && hasAttendanceBeforeAndAfter) {
          specialHolidayDays += 1;
        }
      }
    }
    
    // Philippine Labor Law holiday pay rates (DOLE):
    // - REGULAR holiday worked (and present day before): Additional 100% of daily wage
    // - SPECIAL holiday worked: Additional 30% of daily wage
    // - The base salary already includes regular pay for worked days
    if (regularHolidayDays > 0) {
      holidayPay += regularHolidayDays * dailyRate * 1.0; // Additional 100% (premium only)
    }
    if (specialHolidayDays > 0) {
      holidayPay += specialHolidayDays * dailyRate * 0.3; // Additional 30% (premium only)
    }
    holidayPay = Math.round(holidayPay * 100) / 100;
    
    // For semi-monthly: fixed 13 days per period, for monthly: 26 days
    // Off days are added to expected (they're not counted as absences)
    let expectedWorkDays = 0;
    if (frequency === 'SEMIMONTHLY') {
      expectedWorkDays = 13 + offDaysInPeriod;
    } else if (frequency === 'MONTHLY') {
      expectedWorkDays = 26 + offDaysInPeriod;
    } else {
      expectedWorkDays = Math.max(0, workDaysInPeriod - leaveDays);
    }
    
    // Subtract leave days from expected
    expectedWorkDays = Math.max(0, expectedWorkDays - leaveDays);

    const daysWithTimeLog = timeLogs.filter(log => log.clockIn !== null && log.clockOut !== null).length;
    
    let grossPay = 0;
    let otherDeductions = 0;
    let absenceDeduction = 0;
    let lateDeduction = 0;
    let undertimeDeduction = 0;
    let absentDays = 0;
    
    if (employeePayType === 'DAILY') {
      grossPay = (daysWithTimeLog * dailyRate) + otPay + holidayPay + adjustmentAdd - adjustmentDeduct;
    } else {
      // Gross pay = base salary + OT + holiday pay + adjustments (no deductions yet)
      grossPay = periodSalary + otPay + holidayPay + adjustmentAdd - adjustmentDeduct;
      // Absences, lates, and undertime are separate deductions
      absentDays = Math.max(0, expectedWorkDays - daysWithTimeLog);
      absenceDeduction = absentDays * dailyRate;
      lateDeduction = (totalLates / 60) * hourlyRate;
      undertimeDeduction = (totalUndertime / 60) * hourlyRate;
      otherDeductions = absenceDeduction + lateDeduction + undertimeDeduction;
    }

    // Using lib/payroll functions for 2026 rates
    const sss = includeSSS ? calculateSSS(monthlySalary) : { employeeShare: 0, employerShare: 0 };
    const philHealth = includePhilHealth ? calculatePhilHealth(monthlySalary) : { employeeShare: 0, employerShare: 0 };
    const pagIbig = includePagIBIG ? calculatePagIBIG(monthlySalary) : { employeeShare: 0, employerShare: 0 };

    const totalGovDeductions = sss.employeeShare + philHealth.employeeShare + pagIbig.employeeShare;

    const taxableIncome = grossPay - totalGovDeductions;
    const withholdingTax = includeTax ? calculateWithholdingTax(taxableIncome, frequency) : 0;

    // Fetch active advances for this employee if selected by type
    const activeAdvances = selectedAdvanceTypes.length > 0 ? await prisma.advance.findMany({
      where: {
        employeeId,
        status: 'ACTIVE',
        remainingBalance: { gt: 0 },
        type: { in: selectedAdvanceTypes }
      }
    }) : [];

    let totalAdvanceDeductions = 0;
    const advancePaymentsData = [];

    for (const advance of activeAdvances) {
      const deduction = Math.min(advance.deductionAmount, advance.remainingBalance);
      if (deduction > 0) {
        totalAdvanceDeductions += deduction;
        advancePaymentsData.push({
          advanceId: advance.id,
          amount: deduction,
          balanceAfter: advance.remainingBalance - deduction,
          notes: `Deducted from payroll for ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        });
      }
    }

    const totalDeductions = totalGovDeductions + withholdingTax + otherDeductions + totalAdvanceDeductions;
    const netPay = grossPay - totalDeductions;

    const payroll = await prisma.payroll.create({
      data: {
        employee: { connect: { id: employeeId } },
        month: startDate.getMonth() + 1,
        year: startDate.getFullYear(),
        periodStart: startDate,
        periodEnd: endDate,
        basicSalary: employeePayType === 'DAILY' ? (daysWithTimeLog * dailyRate) : (periodSalary || 0),
        dailyRate: dailyRate || 0,
        workDays: expectedWorkDays,
        daysWorked: daysWithTimeLog,
        otHours: totalOtHours,
        otPay,
        holidayPay,
        grossPay,
        sssEmployee: sss.employeeShare,
        sssEmployer: sss.employerShare,
        philhealthEmployee: philHealth.employeeShare,
        philhealthEmployer: philHealth.employerShare,
        pagibigEmployee: pagIbig.employeeShare,
        pagibigEmployer: pagIbig.employerShare,
        withholdingTax,
        lateMinutes: totalLates,
        undertimeMinutes: totalUndertime,
        otherDeductions: otherDeductions + totalAdvanceDeductions,
        adjustmentAdd,
        adjustmentDeduct,
        adjustmentReason,
        totalDeductions,
        netPay,
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    // Create advance payment records and update advance balances
    for (const paymentData of advancePaymentsData) {
      await prisma.advancePayment.create({
        data: {
          ...paymentData,
          payrollId: payroll.id,
          paymentDate: new Date()
        }
      });

      await prisma.advance.update({
        where: { id: paymentData.advanceId },
        data: {
          remainingBalance: paymentData.balanceAfter,
          status: paymentData.balanceAfter <= 0 ? 'FULLY_PAID' : 'ACTIVE'
        }
      });
    }

    // Invalidate payroll and advances cache
    try {
      await cache.delByPattern(`${PAYROLL_CACHE_PREFIX}*`);
      await cache.delByPattern('advances:*');
    } catch (cacheErr) {
      console.error('Failed to invalidate caches:', cacheErr);
    }

    return NextResponse.json({
      message: 'Payroll computed successfully',
      payroll,
      details: {
        employee: {
          id: employee.id,
          fullName: employee.fullName,
          employeeNumber: employee.employeeNumber,
          position: employee.position,
          department: employee.department,
          basicSalary: employee.basicSalary,
          payrollFrequency: employee.payrollFrequency,
          payType: employee.payType,
          dailyRate: employeeDailyRate,
        },
        period: {
          periodStart: startDate,
          periodEnd: endDate,
          frequency,
        },
        earnings: {
          baseSalary: employeePayType === 'DAILY' ? (daysWithTimeLog * dailyRate) : periodSalary,
          overtimePay: otPay,
          holidayPay,
          grossPay,
        },
        deductions: {
          absences: absenceDeduction,
          lates: lateDeduction,
          undertime: undertimeDeduction,
          cashAdvance: totalAdvanceDeductions,
          sss: sss.employeeShare,
          philHealth: philHealth.employeeShare,
          pagIbig: pagIbig.employeeShare,
          withholdingTax,
          totalDeductions,
        },
        totals: {
          totalOtHours,
          holidayDays: regularHolidayDays + specialHolidayDays,
          regularHolidayDays,
          specialHolidayDays,
          leaveDays,
          offDays: offDaysInPeriod,
          absentDays,
          lateMinutes: totalLates,
          undertimeMinutes: totalUndertime,
        },
        netPay,
      },
    });
  } catch (error) {
    console.error('Error computing payroll:', error);
    return NextResponse.json({ error: 'Failed to compute payroll' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get employee ID for user (with auto-linking)
    const linkedEmployeeId = await getEmployeeIdForUser(userEmail, userRole || '');

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    const cacheKey = `${PAYROLL_CACHE_PREFIX}${linkedEmployeeId || 'all'}:${employeeId || 'all'}:${month || 'all'}:${year || 'all'}`;

    try {
      const cachedPayrolls = await cache.get(cacheKey);
      if (cachedPayrolls) {
        return NextResponse.json(cachedPayrolls);
      }
    } catch (cacheErr) {
      console.error('Failed to get from payroll cache:', cacheErr);
    }

    const where: Record<string, number | string> = {};

    // EMPLOYEE role: only show their own payrolls
    if (!hasAdminAccess(userRole || '') && linkedEmployeeId) {
      where.employeeId = linkedEmployeeId;
    } else if (employeeId) {
      // Admin roles can filter by specific employee
      where.employeeId = employeeId;
    } else {
      // Admin roles with no employeeId filter see all payrolls
      // EMPLOYEE role with no linkedEmployeeId sees nothing
      if (!hasAdminAccess(userRole || '')) {
        where.employeeId = '000000000000000000000000';
      }
    }

    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    const payrolls = await prisma.payroll.findMany({
      where: where as never,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    }).catch((err) => {
      console.error('Prisma query error:', err);
      return [];
    });

    // Fetch employees separately to avoid P2032 error with null Float fields
    const employeeIds = [...new Set(payrolls.map(p => p.employeeId))];
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
    });
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    // Map and ensure no null rates from DB are passed through
    const validPayrolls = payrolls
      .map(p => ({
        ...p,
        dailyRate: p.dailyRate ?? 0, // Fallback for safety
        employee: employeeMap.get(p.employeeId),
      }));

    // Cache for 30 minutes
    try {
      await cache.set(cacheKey, validPayrolls, 1800);
    } catch (cacheErr) {
      console.error('Failed to set payroll cache:', cacheErr);
    }

    return NextResponse.json(validPayrolls);
  } catch (error) {
    console.error('Error fetching payrolls:', error);
    const prismaError = error as { code?: string; message?: string; meta?: Record<string, unknown> };
    console.error('Prisma error code:', prismaError.code);
    console.error('Prisma error meta:', prismaError.meta);
    return NextResponse.json({ error: 'Failed to fetch payrolls', details: prismaError.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    // Only ADMIN can delete payroll
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Only admins can delete payroll.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const payrollId = searchParams.get('id');

    if (!payrollId) {
      return NextResponse.json({ error: 'Payroll ID is required' }, { status: 400 });
    }

    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
    });

    if (!payroll) {
      return NextResponse.json({ error: 'Payroll not found' }, { status: 404 });
    }

    // Get all advance payments for this payroll before deleting
    const advancePayments = await prisma.advancePayment.findMany({
      where: { payrollId },
    });

    // Reverse the deductions by adding back the amounts to each advance
    for (const payment of advancePayments) {
      await prisma.advance.update({
        where: { id: payment.advanceId },
        data: {
          remainingBalance: {
            increment: payment.amount,
          },
          status: 'ACTIVE',
        },
      });
    }

    // Delete associated advance payments
    await prisma.advancePayment.deleteMany({
      where: { payrollId },
    });

    await prisma.payroll.delete({
      where: { id: payrollId },
    });

    // Invalidate cache
    try {
      await cache.delByPattern(`${PAYROLL_CACHE_PREFIX}*`);
      await cache.delByPattern('advances:*');
    } catch (cacheErr) {
      console.error('Failed to invalidate cache:', cacheErr);
    }

    return NextResponse.json({ message: 'Payroll deleted successfully' });
  } catch (error) {
    console.error('Error deleting payroll:', error);
    return NextResponse.json({ error: 'Failed to delete payroll' }, { status: 500 });
  }
}
