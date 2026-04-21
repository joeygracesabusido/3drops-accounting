import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function checkTimeLogs() {
  // Search by employeeId field (the string field like '91420', '91417')
  const employees = await prisma.employee.findMany({
    where: { employeeId: { in: ['91420', '91417'] } },
    select: { id: true, employeeNumber: true, employeeId: true, fullName: true }
  })
  
  console.log('Employees found:', employees.length)
  console.log('Employees:', employees)
  
  for (const emp of employees) {
    const logs = await prisma.timeLog.findMany({
      where: { employeeId: emp.id },
      orderBy: { date: 'desc' },
      take: 5
    })
    
    console.log(`\n${emp.fullName} (${emp.employeeId}):`)
    for (const log of logs) {
      console.log(`  Date: ${log.date}`)
      console.log(`    clockIn: ${log.clockIn}`)
      console.log(`    clockIn UTC: ${log.clockIn?.getUTCHours()}:${log.clockIn?.getUTCMinutes().toString().padStart(2, '0')}`)
      console.log(`    clockOut: ${log.clockOut}`)
      console.log(`    clockOut UTC: ${log.clockOut?.getUTCHours()}:${log.clockOut?.getUTCMinutes().toString().padStart(2, '0')}`)
    }
  }
  
  await prisma.$disconnect()
}

checkTimeLogs()
