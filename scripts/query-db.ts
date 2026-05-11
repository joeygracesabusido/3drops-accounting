import prisma from '../lib/prisma'

async function main() {
  console.log('=== HRIS Database Query ===\n')

  // 1. Fetch all users
  console.log('--- USERS ---')
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      status: true,
      employees: true,
    },
  })
  console.log(`Total users: ${users.length}\n`)
  for (const user of users) {
    console.log(`  ID: ${user.id}`)
    console.log(`  Username: ${user.username}`)
    console.log(`  Email: ${user.email}`)
    console.log(`  Name: ${user.name || '(none)'}`)
    console.log(`  Role: ${user.role}`)
    console.log(`  Status: ${user.status}`)
    console.log(`  Linked Employees: ${user.employees.length}`)
    console.log()
  }

  // 2. Fetch all employees
  console.log('--- EMPLOYEES ---')
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      employeeNumber: true,
      employeeId: true,
      fullName: true,
      email: true,
      position: true,
      department: true,
      isActive: true,
      faceDescriptor: true,
      user: true,
    },
  })
  console.log(`Total employees: ${employees.length}\n`)
  for (const emp of employees) {
    const hasFace = emp.faceDescriptor && emp.faceDescriptor.length > 0
    const linkedUser = emp.user ? emp.user.email : '(none)'
    console.log(`  ID: ${emp.id}`)
    console.log(`  Employee ID: ${emp.employeeId}`)
    console.log(`  Name: ${emp.fullName}`)
    console.log(`  Email: ${emp.email}`)
    console.log(`  Position: ${emp.position}`)
    console.log(`  Department: ${emp.department}`)
    console.log(`  Active: ${emp.isActive}`)
    console.log(`  Face Descriptor Enrolled: ${hasFace ? 'YES' : 'NO'}`)
    if (hasFace) {
      console.log(`  Face Descriptor Points: ${emp.faceDescriptor.length}`)
    }
    console.log(`  Linked User Email: ${linkedUser}`)
    console.log()
  }

  // 3. Check email matches between users and employees
  console.log('--- EMAIL MATCHES (User email == Employee email) ---')
  const userEmails = new Set(users.map(u => u.email))
  let matchCount = 0
  for (const emp of employees) {
    if (userEmails.has(emp.email)) {
      matchCount++
      const user = users.find(u => u.email === emp.email)
      console.log(`  MATCH: ${emp.email}`)
      console.log(`    Employee: ${emp.fullName} (${emp.position})`)
      console.log(`    User: ${user?.username} | Role: ${user?.role} | Status: ${user?.status}`)
      console.log()
    }
  }
  if (matchCount === 0) {
    console.log('  No matches found.')
    console.log()
  }

  // Show employees without linked users
  console.log('--- EMPLOYEES WITHOUT LINKED USER ---')
  const unlinked = employees.filter(e => !e.user)
  console.log(`Count: ${unlinked.length}\n`)
  for (const emp of unlinked) {
    console.log(`  ${emp.fullName} (${emp.email}) - Face enrolled: ${emp.faceDescriptor.length > 0 ? 'YES' : 'NO'}`)
  }
  console.log()

  // Show users without linked employees
  console.log('--- USERS WITHOUT LINKED EMPLOYEE ---')
  const orphanUsers = users.filter(u => u.employees.length === 0)
  console.log(`Count: ${orphanUsers.length}\n`)
  for (const user of orphanUsers) {
    console.log(`  ${user.email} | Role: ${user.role} | Status: ${user.status}`)
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
