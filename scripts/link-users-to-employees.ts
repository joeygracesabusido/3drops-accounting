import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function linkUsersToEmployees() {
  console.log('Starting to link users to employees...')

  try {
    // Get all users
    const users = await prisma.user.findMany({
      include: { employees: true }
    })

    // Get all employees
    const employees = await prisma.employee.findMany({
      include: { user: true }
    })

    let linkedCount = 0
    let alreadyLinkedCount = 0

    for (const user of users) {
      // Skip if already has linked employees
      if (user.employees && user.employees.length > 0) {
        console.log(`✓ ${user.email} already linked to ${user.employees.length} employee(s)`)
        alreadyLinkedCount++
        continue
      }

      // Try to find matching employee by email
      const matchingEmployee = employees.find(emp => emp.email === user.email)

      if (matchingEmployee) {
        // Check if employee already has a userId
        if (matchingEmployee.userId) {
          console.log(`- ${user.email} employee record already has userId`)
          continue
        }

        // Link the user to the employee
        await prisma.employee.update({
          where: { id: matchingEmployee.id },
          data: { userId: user.id }
        })

        console.log(`✓ Linked ${user.email} to employee ${matchingEmployee.fullName} (${matchingEmployee.employeeId})`)
        linkedCount++
      } else {
        console.log(`✗ No matching employee found for ${user.email}`)
      }
    }

    console.log('\n--- Summary ---')
    console.log(`Linked: ${linkedCount}`)
    console.log(`Already linked: ${alreadyLinkedCount}`)
    console.log('Done!')
  } catch (error) {
    console.error('Error linking users to employees:', error)
  } finally {
    await prisma.$disconnect()
  }
}

linkUsersToEmployees()
