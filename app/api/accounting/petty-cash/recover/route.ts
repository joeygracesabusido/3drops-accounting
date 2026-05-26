'use strict';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

async function getUserRole() {
  const cookieStore = await cookies();
  return cookieStore.get('userRole')?.value || '';
}

export async function POST() {
  try {
    const userRole = await getUserRole();
    if (userRole !== 'ADMIN' && userRole !== 'HR' && userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const funds = await prisma.pettyCash.findMany();
    const results: { id: string; name: string; oldBalance: number; newBalance: number; fixed: boolean }[] = [];

    for (const fund of funds) {
      const disbursements = await prisma.pettyCashDisbursement.findMany({
        where: { pettyCashId: fund.id },
      });

      const approvedLiquidations = await prisma.pettyCashLiquidation.findMany({
        where: { pettyCashId: fund.id, status: 'APPROVED' },
      });

      const totalDisbursed = disbursements.reduce((sum, d) => sum + d.amount, 0);
      const totalRejected = disbursements
        .filter(d => d.status === 'REJECTED')
        .reduce((sum, d) => sum + d.amount, 0);
      const totalVariance = approvedLiquidations
        .filter(l => l.variance && l.variance > 0)
        .reduce((sum, l) => sum + (l.variance || 0), 0);

      const correctBalance = fund.fundAmount - totalDisbursed + totalRejected + totalVariance;
      const oldBalance = fund.currentBalance;

      if (Math.abs(oldBalance - correctBalance) > 0.01) {
        await prisma.pettyCash.update({
          where: { id: fund.id },
          data: { currentBalance: correctBalance },
        });

        results.push({
          id: fund.id,
          name: fund.name,
          oldBalance,
          newBalance: correctBalance,
          fixed: true,
        });
      } else {
        results.push({
          id: fund.id,
          name: fund.name,
          oldBalance,
          newBalance: correctBalance,
          fixed: false,
        });
      }
    }

    return NextResponse.json({
      message: 'Recovery complete',
      fundsRecovered: results.filter(r => r.fixed).length,
      details: results,
    });
  } catch (error) {
    console.error('Error recovering petty cash balances:', error);
    return NextResponse.json({ error: 'Failed to recover balances' }, { status: 500 });
  }
}
