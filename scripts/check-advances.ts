import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function checkAdvances() {
  try {
    // Get all advances with their payments
    const advances = await prisma.advance.findMany({
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
          include: { payroll: true }
        }
      }
    })

    console.log('\n=== All Advances ===')
    for (const advance of advances) {
      console.log(`\nAdvance ID: ${advance.id}`)
      console.log(`  Type: ${advance.type}`)
      console.log(`  Total Amount: ${advance.totalAmount}`)
      console.log(`  Remaining Balance: ${advance.remainingBalance}`)
      console.log(`  Deduction Amount: ${advance.deductionAmount}`)
      console.log(`  Status: ${advance.status}`)
      console.log(`  Payments (${advance.payments.length}):`)
      
      let totalDeducted = 0
      for (const payment of advance.payments) {
        console.log(`    - ${payment.amount} (Payroll: ${payment.payrollId?.substring(0, 8)}...)`)
        totalDeducted += payment.amount
      }
      
      const expectedBalance = advance.totalAmount - totalDeducted
      console.log(`  Total Deducted: ${totalDeducted}`)
      console.log(`  Expected Balance: ${expectedBalance}`)
      console.log(`  Balance Match: ${Math.abs(advance.remainingBalance - expectedBalance) < 0.01 ? '✓' : '✗ MISMATCH!'}`)
    }

    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkAdvances()
