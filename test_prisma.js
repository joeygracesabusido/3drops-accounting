const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing prisma.shift...');
  if (prisma.shift) {
    console.log('SUCCESS: prisma.shift is defined.');
    try {
      const shifts = await prisma.shift.findMany();
      console.log(`Fetched ${shifts.length} shifts.`);
    } catch (e) {
      console.log('Error fetching shifts (expected if DB is empty or not connected):', e.message);
    }
  } else {
    console.log('FAILURE: prisma.shift is undefined.');
    console.log('Available models:', Object.keys(prisma).filter(k => !k.startsWith('_')));
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
