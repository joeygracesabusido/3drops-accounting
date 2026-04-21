import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AssetTransactionType, AssetStatus } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');

    const transactions = await prisma.assetTransaction.findMany({
      where: {
        ...(assetId && { assetId }),
      },
      include: {
        asset: true,
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Create the transaction
    const transaction = await prisma.assetTransaction.create({
      data: {
        assetId: data.assetId,
        type: data.type as AssetTransactionType,
        date: data.date ? new Date(data.date) : new Date(),
        previousValue: data.previousValue,
        newValue: data.newValue,
        cost: data.cost ? parseFloat(data.cost) : null,
        notes: data.notes,
        recordedById: data.recordedById || null,
      },
      include: {
        asset: true
      }
    });

    // If transaction updates the asset's state, update the asset
    if (data.type === AssetTransactionType.TRANSFER) {
      await prisma.asset.update({
        where: { id: data.assetId },
        data: {
          location: data.newLocation || undefined,
          assignedToId: data.newAssignedToId || null,
        }
      });
    } else if (data.type === AssetTransactionType.DISPOSAL) {
      await prisma.asset.update({
        where: { id: data.assetId },
        data: { status: AssetStatus.DISPOSED }
      });
    } else if (data.type === AssetTransactionType.MAINTENANCE && data.statusUpdate) {
      await prisma.asset.update({
        where: { id: data.assetId },
        data: { status: data.statusUpdate as AssetStatus }
      });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Failed to log transaction' }, { status: 500 });
  }
}
