import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const username = 'joeysabusido'
  const email = 'joeysabusido@example.com'
  const password = 'Genesis@11'
  const hashedPassword = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      name: 'Joey Sabusido',
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })

  console.log('User created:', user.id)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => await prisma.$disconnect())
