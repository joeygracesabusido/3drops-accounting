import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function cleanupOrphanedPayments() {
  try {
    // Find all orphaned payments (payments without a payroll)
    const orphanedPayments = await prisma.advancePayment.findMany({
      where: {
        payrollId: null
      }
    })

    console.log(`Found ${orphanedPayments.length} orphaned payments`)

    if (orphanedPayments.length > 0) {
      // Group by advanceId to restore balances
      const advancesToRestore = new Map<string, number>()

      for (const payment of orphanedPayments) {
        const current = advancesToRestore.get(payment.advanceId) || 0
        advancesToRestore.set(payment.advanceId, current + payment.amount)
      }

      console.log(`\nRestoring balances for ${advancesToRestore.size} advances:`)

      // Restore balances
      for (const [advanceId, amount] of advancesToRestore) {
        console.log(`  Advance ${advanceId.substring(0, 8)}...: +${amount}`)
        
        await prisma.advance.update({
          where: { id: advanceId },
          data: {
            remainingBalance: {
              increment: amount
            }
          }
        })
      }

      // Delete orphaned payments
      await prisma.advancePayment.deleteMany({
        where: {
          payrollId: null
        }
      })

      console.log(`\n✓ Cleaned up ${orphanedPayments.length} orphaned payments`)
      console.log(`✓ Restored balances for ${advancesToRestore.size} advances`)
    } else {
      console.log('No orphaned payments found')
    }

    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

cleanupOrphanedPayments()
