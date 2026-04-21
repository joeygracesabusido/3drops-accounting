import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function fixTimeLog() {
  try {
    // Get employee 91420
    const employee = await prisma.employee.findFirst({
      where: { employeeId: '91420' },
      select: { id: true, fullName: true }
    })

    if (!employee) {
      console.log('Employee 91420 not found')
      await prisma.$disconnect()
      return
    }

    console.log(`Found employee: ${employee.fullName} (ID: ${employee.id})`)

    // Get the time log with incorrect time
    const timeLog = await prisma.timeLog.findFirst({
      where: { 
        employeeId: employee.id,
        clockIn: {
          gte: new Date('2026-03-26T00:00:00Z'),
          lte: new Date('2026-03-26T23:59:59Z')
        }
      }
    })

    if (!timeLog || !timeLog.clockIn) {
      console.log('Time log not found')
      await prisma.$disconnect()
      return
    }

    console.log('\nCurrent time log:')
    console.log(`  clockIn: ${timeLog.clockIn.toISOString()}`)
    console.log(`  clockIn display (getUTCHours): ${timeLog.clockIn.getUTCHours()}:${timeLog.clockIn.getUTCMinutes().toString().padStart(2, '0')}`)

    // The current time is stored as PH time (10:25 PH time)
    // We need to convert it to UTC so that getUTCHours() returns 10:25
    // Current: 2026-03-26 10:25:07 PH time = 2026-03-26 02:25:07 UTC
    // We want: getUTCHours() to return 10:25, so store as 2026-03-26 10:25:07 UTC
    
    // Create new date with UTC time matching the intended PH display time
    const year = timeLog.clockIn.getFullYear()
    const month = timeLog.clockIn.getMonth()
    const day = timeLog.clockIn.getDate()
    const hours = timeLog.clockIn.getHours() // 10 (PH local hours)
    const minutes = timeLog.clockIn.getMinutes() // 25
    const seconds = timeLog.clockIn.getSeconds() // 7

    // Create UTC date that will display as 10:25 when using getUTCHours()
    const correctedClockIn = new Date(Date.UTC(year, month, day, hours, minutes, seconds))

    console.log('\nCorrected time log:')
    console.log(`  clockIn: ${correctedClockIn.toISOString()}`)
    console.log(`  clockIn display (getUTCHours): ${correctedClockIn.getUTCHours()}:${correctedClockIn.getUTCMinutes().toString().padStart(2, '0')}`)

    // Update the time log
    const updated = await prisma.timeLog.update({
      where: { id: timeLog.id },
      data: { clockIn: correctedClockIn }
    })

    console.log('\n✓ Time log updated successfully!')
    console.log(`  Updated clockIn: ${updated.clockIn?.toISOString()}`)
    console.log(`  Will display as: ${updated.clockIn?.getUTCHours()}:${updated.clockIn?.getUTCMinutes().toString().padStart(2, '0')}`)

    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

fixTimeLog()
