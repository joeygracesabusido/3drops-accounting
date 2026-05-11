import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkJerome() {
  const employees = await prisma.employee.findMany({
    where: {
      fullName: {
        contains: 'Jerome',
        mode: 'insensitive'
      }
    }
  });
  console.log('Found employees:', employees.map(e => e.fullName));

  if (employees.length > 0) {
    const jerome = employees[0];
    
    // Create Date objects for start and end of today
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    console.log('Checking time logs for:', jerome.fullName, 'between', startOfDay, 'and', endOfDay);
    
    // Find logs for today
    const logs = await prisma.timeLog.findMany({
      where: {
        employeeId: jerome.id,
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });
    
    console.log('Today logs count:', logs.length);
    console.log('Today logs:', JSON.stringify(logs, null, 2));
    
    // Also print recent logs
    const recentLogs = await prisma.timeLog.findMany({
      where: {
        employeeId: jerome.id
      },
      orderBy: {
        date: 'desc'
      },
      take: 3
    });
    console.log('Recent logs:', JSON.stringify(recentLogs, null, 2));
  }
}

checkJerome().then(() => prisma.$disconnect());
