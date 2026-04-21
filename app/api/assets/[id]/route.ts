import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AssetStatus } from '@prisma/client';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        assignedTo: true,
        transactions: {
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json(asset);
  } catch (error) {
    console.error('Error fetching asset:', error);
    return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json();
    
    const updateData: Partial<Record<string, unknown>> = {
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      supplier: data.supplier,
      purchaseCost: data.purchaseCost ? parseFloat(data.purchaseCost) : undefined,
      usefulLife: data.usefulLife ? parseInt(data.usefulLife) : undefined,
      residualValue: data.residualValue ? parseFloat(data.residualValue) : undefined,
      depreciationMethod: data.depreciationMethod,
      location: data.location,
      quantity: data.quantity ? parseInt(data.quantity) : undefined,
      assignedToId: data.assignedToId || null,
      status: data.status as AssetStatus,
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const asset = await prisma.asset.update({
      where: { id: params.id },
      data: updateData,
      include: {
        category: true,
        assignedTo: true,
      }
    });

    return NextResponse.json(asset);
  } catch (error) {
    console.error('Error updating asset:', error);
    return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.asset.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting asset:', error);
    return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
  }
}
