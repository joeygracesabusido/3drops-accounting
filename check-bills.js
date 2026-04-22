const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.$connect()
  .then(async () => {
    const bills = await p.purchaseBill.findMany({
      include: { items: true, journalEntry: { include: { lines: { include: { account: true } } } } },
    });
    console.log('Bills count:', bills.length);
    if (bills.length > 0) {
      console.log('First bill:', JSON.stringify(bills[0], null, 2));
    }
    await p.$disconnect();
  })
  .catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
