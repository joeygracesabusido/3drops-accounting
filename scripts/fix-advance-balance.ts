import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function fixAdvanceBalance() {
  try {
    // Get the advance and its valid payments
    const advance = await prisma.advance.findUnique({
      where: { id: '69be5b917c35db7f02bcd4cd' },
      include: {
        payments: {
          where: { payrollId: { not: null } }
        }
      }
    })

    if (!advance) {
      console.log('Advance not found')
      await prisma.$disconnect()
      return
    }

    const totalDeducted = advance.payments.reduce((sum, p) => sum + p.amount, 0)
    const correctBalance = advance.totalAmount - totalDeducted

    console.log('Current state:')
    console.log(`  Total Amount: ${advance.totalAmount}`)
    console.log(`  Total Deducted: ${totalDeducted}`)
    console.log(`  Current Balance: ${advance.remainingBalance}`)
    console.log(`  Correct Balance: ${correctBalance}`)

    // Fix the balance
    const updated = await prisma.advance.update({
      where: { id: advance.id },
      data: {
        remainingBalance: correctBalance
      }
    })

    console.log(`\n✓ Fixed! New balance: ${updated.remainingBalance}`)

    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

fixAdvanceBalance()
