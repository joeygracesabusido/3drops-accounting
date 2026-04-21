import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  await p.$connect();

  // Update control accounts to enable subsidiary ledger
  const updates = [
    { code: '1200', name: 'Accounts Receivable', subsidiaryType: 'CUSTOMER' },
    { code: '1300', name: 'Inventory', subsidiaryType: 'INVENTORY_ITEM' },
    { code: '1600', name: 'Fixed Assets', subsidiaryType: 'ASSET' },
    { code: '2100', name: 'Accounts Payable', subsidiaryType: 'SUPPLIER' },
  ];

  for (const update of updates) {
    const account = await p.account.findFirst({ where: { code: update.code } });
    if (account) {
      await p.account.update({
        where: { id: account.id },
        data: {
          hasSubsidiaryLedger: true,
          subsidiaryType: update.subsidiaryType,
        },
      });
      console.log(`Updated ${account.code} - ${account.name}: hasSubsidiaryLedger=true, subsidiaryType=${update.subsidiaryType}`);
    } else {
      console.log(`Account ${update.code} - ${update.name} not found`);
    }
  }

  await p.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
