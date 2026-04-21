import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const logs = await prisma.timeLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { employee: true }
    });
    console.log('Last 10 TimeLogs:');
    console.log(JSON.stringify(logs, null, 2));
    
    const count = await prisma.timeLog.count();
    console.log('Total TimeLog count:', count);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
