import { PrismaClient, LeaveStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('123456', 10)

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@hris.ph',
      name: 'System Administrator',
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })

  const manager1 = await prisma.user.upsert({
    where: { username: 'manager1' },
    update: {},
    create: {
      username: 'manager1',
      email: 'manager1@hris.ph',
      name: 'John Smith',
      password: hashedPassword,
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  })

  const manager2 = await prisma.user.upsert({
    where: { username: 'manager2' },
    update: {},
    create: {
      username: 'manager2',
      email: 'manager2@hris.ph',
      name: 'Sarah Johnson',
      password: hashedPassword,
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  })

  const emp1 = await prisma.user.upsert({
    where: { username: 'employee1' },
    update: {},
    create: {
      username: 'employee1',
      email: 'employee1@hris.ph',
      name: 'Juan dela Cruz',
      password: hashedPassword,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    },
  })

  const emp2 = await prisma.user.upsert({
    where: { username: 'employee2' },
    update: {},
    create: {
      username: 'employee2',
      email: 'employee2@hris.ph',
      name: 'Maria Santos',
      password: hashedPassword,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    },
  })

  const emp3 = await prisma.user.upsert({
    where: { username: 'employee3' },
    update: {},
    create: {
      username: 'employee3',
      email: 'employee3@hris.ph',
      name: 'Pedro Garcia',
      password: hashedPassword,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    },
  })

  const emp4 = await prisma.user.upsert({
    where: { username: 'employee4' },
    update: {},
    create: {
      username: 'employee4',
      email: 'employee4@hris.ph',
      name: 'Ana Reyes',
      password: hashedPassword,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    },
  })

  const emp5 = await prisma.user.upsert({
    where: { username: 'employee5' },
    update: {},
    create: {
      username: 'employee5',
      email: 'employee5@hris.ph',
      name: 'Michael Lee',
      password: hashedPassword,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    },
  })

  console.log('Created users')

  const employees = [
    {
      userId: manager1.id,
      employeeNumber: 1001,
      employeeId: 'EMP001',
      fullName: 'John Smith',
      email: 'manager1@hris.ph',
      position: 'IT Manager',
      department: 'IT',
      basicSalary: 60000,
      payrollFrequency: 'MONTHLY',
      hireDate: new Date('2024-01-15'),
      isActive: true,
      tin: '123456789012',
      sssNo: '1234567890',
      philhealthNo: '123456789012',
      pagibigNo: '123456789012',
      bankName: 'BPI',
      bankAccountNo: '1234567890',
    },
    {
      userId: manager2.id,
      employeeNumber: 1002,
      employeeId: 'EMP002',
      fullName: 'Sarah Johnson',
      email: 'manager2@hris.ph',
      position: 'HR Manager',
      department: 'HR',
      basicSalary: 55000,
      payrollFrequency: 'MONTHLY',
      hireDate: new Date('2024-02-01'),
      isActive: true,
      tin: '234567890123',
      sssNo: '2345678901',
      philhealthNo: '234567890123',
      pagibigNo: '234567890123',
      bankName: 'BDO',
      bankAccountNo: '2345678901',
    },
    {
      userId: emp1.id,
      employeeNumber: 1003,
      employeeId: 'EMP003',
      fullName: 'Juan dela Cruz',
      email: 'employee1@hris.ph',
      position: 'Software Engineer',
      department: 'IT',
      basicSalary: 45000,
      payrollFrequency: 'MONTHLY',
      hireDate: new Date('2024-03-01'),
      isActive: true,
      tin: '345678901234',
      sssNo: '3456789012',
      philhealthNo: '345678901234',
      pagibigNo: '345678901234',
      bankName: 'Metrobank',
      bankAccountNo: '3456789012',
    },
    {
      userId: emp2.id,
      employeeNumber: 1004,
      employeeId: 'EMP004',
      fullName: 'Maria Santos',
      email: 'employee2@hris.ph',
      position: 'Marketing Specialist',
      department: 'Marketing',
      basicSalary: 35000,
      payrollFrequency: 'MONTHLY',
      hireDate: new Date('2024-04-01'),
      isActive: true,
      tin: '456789012345',
      sssNo: '4567890123',
      philhealthNo: '456789012345',
      pagibigNo: '456789012345',
      bankName: 'Landbank',
      bankAccountNo: '4567890123',
    },
    {
      userId: emp3.id,
      employeeNumber: 1005,
      employeeId: 'EMP005',
      fullName: 'Pedro Garcia',
      email: 'employee3@hris.ph',
      position: 'Accountant',
      department: 'Finance',
      basicSalary: 40000,
      payrollFrequency: 'MONTHLY',
      hireDate: new Date('2024-05-01'),
      isActive: true,
      tin: '567890123456',
      sssNo: '5678901234',
      philhealthNo: '567890123456',
      pagibigNo: '567890123456',
      bankName: 'PNB',
      bankAccountNo: '5678901234',
    },
    {
      userId: emp4.id,
      employeeNumber: 1006,
      employeeId: 'EMP006',
      fullName: 'Ana Reyes',
      email: 'employee4@hris.ph',
      position: 'HR Specialist',
      department: 'HR',
      basicSalary: 32000,
      payrollFrequency: 'MONTHLY',
      hireDate: new Date('2024-06-01'),
      isActive: true,
      tin: '678901234567',
      sssNo: '6789012345',
      philhealthNo: '678901234567',
      pagibigNo: '678901234567',
      bankName: 'RCBC',
      bankAccountNo: '6789012345',
    },
    {
      userId: emp5.id,
      employeeNumber: 1007,
      employeeId: 'EMP007',
      fullName: 'Michael Lee',
      email: 'employee5@hris.ph',
      position: 'Sales Executive',
      department: 'Sales',
      basicSalary: 30000,
      payrollFrequency: 'MONTHLY',
      hireDate: new Date('2024-07-01'),
      isActive: true,
      tin: '789012345678',
      sssNo: '7890123456',
      philhealthNo: '789012345678',
      pagibigNo: '789012345678',
      bankName: 'Security Bank',
      bankAccountNo: '7890123456',
    },
  ]

  const createdEmployees = []
  for (const empData of employees) {
    let emp = await prisma.employee.findUnique({ where: { email: empData.email } });
    if (!emp) {
      emp = await prisma.employee.create({ data: empData });
    }
    createdEmployees.push(emp);
    console.log(`Created employee: ${emp.fullName}`)
  }

  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  const timeLogs = []
  for (const emp of createdEmployees) {
    for (let day = 1; day <= 20; day++) {
      const date = new Date(currentYear, currentMonth, day)
      const dayOfWeek = date.getDay()
      if (dayOfWeek === 0) continue

      const clockIn = new Date(currentYear, currentMonth, day, 8, 0, 0)
      const isOvertime = [5, 12, 19].includes(day)
      const clockOut = new Date(currentYear, currentMonth, day, isOvertime ? 19 : 17, 0, 0)

      const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / 3600000 - 1
      const otHours = isOvertime ? Math.max(0, hoursWorked - 8) : 0

      timeLogs.push({
        employeeId: emp.id,
        date: date,
        clockIn: clockIn,
        clockOut: clockOut,
        workHours: hoursWorked,
        otHours: otHours,
        otStatus: isOvertime ? 'APPROVED' as const : 'PENDING' as const,
        lateMinutes: 0,
        undertimeMinutes: 0,
      })
    }
  }

  await prisma.timeLog.createMany({ data: timeLogs })
  console.log(`Created ${timeLogs.length} time logs`)

  const leaves: {
    employeeId: string;
    approverId: string;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    daysCount: number;
    reason: string;
    status: LeaveStatus;
  }[] = [
    {
      employeeId: createdEmployees[2].id,
      approverId: createdEmployees[0].id,
      leaveType: 'BUSINESS_TRIP',
      startDate: new Date(currentYear, currentMonth, 10),
      endDate: new Date(currentYear, currentMonth, 12),
      daysCount: 3,
      reason: 'Client meeting in Cebu',
      status: 'APPROVED',
    },
    {
      employeeId: createdEmployees[3].id,
      approverId: createdEmployees[1].id,
      leaveType: 'BUSINESS_TRIP',
      startDate: new Date(currentYear, currentMonth, 15),
      endDate: new Date(currentYear, currentMonth, 16),
      daysCount: 2,
      reason: 'Trade show in Manila',
      status: 'APPROVED',
    },
    {
      employeeId: createdEmployees[4].id,
      approverId: createdEmployees[1].id,
      leaveType: 'VACATION',
      startDate: new Date(currentYear, currentMonth, 20),
      endDate: new Date(currentYear, currentMonth, 22),
      daysCount: 3,
      reason: 'Family vacation',
      status: 'APPROVED',
    },
    {
      employeeId: createdEmployees[5].id,
      approverId: createdEmployees[1].id,
      leaveType: 'SICK',
      startDate: new Date(currentYear, currentMonth, 5),
      endDate: new Date(currentYear, currentMonth, 5),
      daysCount: 1,
      reason: 'Not feeling well',
      status: 'APPROVED',
    },
    {
      employeeId: createdEmployees[6].id,
      approverId: createdEmployees[0].id,
      leaveType: 'BUSINESS_TRIP',
      startDate: new Date(currentYear, currentMonth, 8),
      endDate: new Date(currentYear, currentMonth, 9),
      daysCount: 2,
      reason: 'Product demo in Davao',
      status: 'PENDING',
    },
  ]

  for (const leave of leaves) {
    await prisma.leaveRequest.create({ data: leave })
  }
  console.log(`Created ${leaves.length} leave requests`)

  console.log('\n=== Dummy Data Created Successfully ===')
  console.log('\nLogin Credentials:')
  console.log('  Admin: admin / 123456')
  console.log('  Manager 1: manager1 / 123456')
  console.log('  Manager 2: manager2 / 123456')
  console.log('  Employee 1-5: employee1-5 / 123456')
  console.log('\nFeatures:')
  console.log('  - Time logs with approved overtime for days 5, 12, 19')
  console.log('  - 3 approved business trip leaves')
  console.log('  - 1 pending business trip leave')
  console.log('  - Regular vacation and sick leaves')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
