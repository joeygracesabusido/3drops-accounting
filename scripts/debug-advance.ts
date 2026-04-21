import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function debugAdvance() {
  try {
    // Get the specific advance with mismatch
    const advance = await prisma.advance.findUnique({
      where: { id: '69be5b917c35db7f02bcd4cd' },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
          include: { payroll: true }
        }
      }
    })

    if (!advance) {
      console.log('Advance not found')
      await prisma.$disconnect()
      return
    }

    console.log('\n=== Advance Details ===')
    console.log(`Total Amount: ${advance.totalAmount}`)
    console.log(`Remaining Balance: ${advance.remainingBalance}`)
    console.log(`\nPayments:`)
    
    let totalDeducted = 0
    let orphanedPayments = 0
    
    for (const payment of advance.payments) {
      const hasPayroll = payment.payrollId !== null
      const status = hasPayroll ? '✓ Has Payroll' : '✗ ORPHANED (no payroll)'
      console.log(`  - ${payment.amount} (${status})`)
      if (!hasPayroll) orphanedPayments++
      totalDeducted += payment.amount
    }
    
    console.log(`\nTotal Deducted: ${totalDeducted}`)
    console.log(`Orphaned Payments: ${orphanedPayments}`)
    console.log(`Expected Balance: ${advance.totalAmount - totalDeducted}`)
    console.log(`Actual Balance: ${advance.remainingBalance}`)
    console.log(`Difference: ${advance.remainingBalance - (advance.totalAmount - totalDeducted)}`)

    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

debugAdvance()
