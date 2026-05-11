import prisma from '@/lib/prisma';

async function updateSubsidiaryBalances() {
  console.log('Starting subsidiary ledger balance update...');

  const ledgers = await prisma.subsidiaryLedger.findMany({
    include: { transactions: true },
  });

  console.log(`Found ${ledgers.length} subsidiary ledgers`);

  for (const ledger of ledgers) {
    // Always use "debits - credits" convention for consistency
    const debitTotal = ledger.transactions.reduce((sum, t) => sum + t.debit, 0);
    const creditTotal = ledger.transactions.reduce((sum, t) => sum + t.credit, 0);
    const balance = debitTotal - creditTotal;

    await prisma.subsidiaryLedger.update({
      where: { id: ledger.id },
      data: { debitTotal, creditTotal, balance },
    });

    console.log(`Updated ${ledger.entityName} (${ledger.entityCode}): debit=${debitTotal}, credit=${creditTotal}, balance=${balance}`);
  }

  console.log('Done!');
}

updateSubsidiaryBalances()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
