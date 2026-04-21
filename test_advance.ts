import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Starting test insertion...');
    
    // Jerome Sabusido's ID from previous search
    const employeeId = '69a3f6fd7dcda7c88bc10320';
    
    const advance = await prisma.advance.create({
      data: {
        employeeId: employeeId,
        type: 'CASH_ADVANCE',
        totalAmount: 5000,
        remainingBalance: 5000,
        deductionAmount: 500,
        status: 'ACTIVE',
      },
    });
    
    console.log('SUCCESS: Advance created via script:', JSON.stringify(advance, null, 2));
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('FAILURE: Error in script:', error.message);
    } else {
      console.error('FAILURE: Error in script:', error);
    }
    console.log('AVAILABLE MODELS IN SCRIPT:', Object.keys(prisma).filter(k => !k.startsWith('$')));
  } finally {
    await prisma.$disconnect();
  }
}

test();
