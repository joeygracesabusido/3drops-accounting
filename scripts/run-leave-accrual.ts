/**
 * Leave Accrual Cron Job
 * Run this script on the last day of every month via cron/scheduler
 * 
 * Usage: npx ts-node scripts/run-leave-accrual.ts
 * 
 * Cron example (run on 28th of every month at 23:00):
 * 0 23 28 * * cd /path/to/app && npx ts-node scripts/run-leave-accrual.ts
 */

import prisma from '../lib/prisma'
import { calculateMonthlyAccrual } from '../lib/leave-credits'

async function runMonthlyAccrual() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  
  console.log(`Starting leave accrual for ${now.toLocaleString('default', { month: 'long' })} ${year}`)
  
  const regularEmployees = await prisma.employee.findMany({
    where: { 
      employeeStatus: 'REGULAR',
      isActive: true,
    },
    select: { id: true, fullName: true },
  })
  
  console.log(`Found ${regularEmployees.length} regular employees`)
  
  let successCount = 0
  let failCount = 0
  
  const promises = regularEmployees.map(async (emp) => {
    const result = await calculateMonthlyAccrual(emp.id, year, month)
    if (result.success) {
      successCount++
      console.log(`✓ ${emp.fullName}: +${result.accrued} days`)
    } else {
      failCount++
      console.log(`○ ${emp.fullName}: ${result.error}`)
    }
  })
  
  await Promise.all(promises)
  
  console.log(`\nAccrual complete: ${successCount} succeeded, ${failCount} skipped/failed`)
}

runMonthlyAccrual()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Accrual job failed:', err)
    process.exit(1)
  })
