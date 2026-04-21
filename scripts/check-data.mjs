import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  await p.$connect();

  console.log('=== ALL ACCOUNTS ===');
  const allAccounts = await p.account.findMany();
  allAccounts.forEach(a => {
    console.log(`${a.code} - ${a.name} | hasSubsidiaryLedger: ${a.hasSubsidiaryLedger} | subsidiaryType: ${a.subsidiaryType}`);
  });

  console.log('\n=== ACCOUNTS WITH SUBSIDIARY LEDGER ===');
  const subsidiaryAccounts = await p.account.findMany({
    where: { hasSubsidiaryLedger: true }
  });
  subsidiaryAccounts.forEach(a => {
    console.log(`${a.code} - ${a.name} | subsidiaryType: ${a.subsidiaryType}`);
  });

  console.log('\n=== 2100 ACCOUNT ===');
  const account2100 = await p.account.findFirst({ where: { code: '2100' } });
  console.log(JSON.stringify(account2100, null, 2));

  console.log('\n=== SUBSIDIARY LEDGERS FOR 2100 ===');
  const ledgers = await p.subsidiaryLedger.findMany({
    where: { accountId: account2100?.id }
  });
  console.log(JSON.stringify(ledgers, null, 2));

  console.log('\n=== PURCHASE BILLS ===');
  const bills = await p.purchaseBill.findMany({ take: 5 });
  bills.forEach(b => {
    console.log(`ID: ${b.id} | supplierId: ${b.supplierId} | amount: ${b.totalAmount}`);
  });

  await p.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
