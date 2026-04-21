import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AssetStatus, DepreciationMethod, AssetTransactionType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status');

    const assets = await prisma.asset.findMany({
      where: {
        ...(categoryId && { categoryId }),
        ...(status && { status: status as AssetStatus }),
      },
      include: {
        category: true,
        assignedTo: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Automatically generate asset code if not provided
    let assetCode = data.assetCode;
    if (!assetCode) {
      const count = await prisma.asset.count();
      assetCode = `AST-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    }

    const asset = await prisma.asset.create({
      data: {
        assetCode,
        name: data.name,
        brand: data.brand || null,
        description: data.description,
        categoryId: data.categoryId,
        purchaseDate: new Date(data.purchaseDate),
        supplier: data.supplier,
        purchaseCost: parseFloat(data.purchaseCost),
        usefulLife: parseInt(data.usefulLife),
        residualValue: parseFloat(data.residualValue),
        depreciationMethod: data.depreciationMethod as DepreciationMethod,
        location: data.location,
        quantity: parseInt(data.quantity) || 1,
        assignedToId: data.assignedToId || null,
        status: data.status as AssetStatus || AssetStatus.ACTIVE,
        // Create initial acquisition transaction automatically
        transactions: {
          create: {
            type: AssetTransactionType.ACQUISITION,
            cost: parseFloat(data.purchaseCost),
            notes: 'Initial acquisition',
          }
        }
      },
      include: {
        category: true,
        assignedTo: true,
      }
    });

    return NextResponse.json(asset);
  } catch (error) {
    console.error('Error creating asset:', error);
    if (error instanceof Error && (error as unknown as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Asset Code already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create asset' }, { status: 500 });
  }
}
