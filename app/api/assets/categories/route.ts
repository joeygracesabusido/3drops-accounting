import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    const where: { branchId?: string } = {};
    if (branchId) where.branchId = branchId;

    const categories = await prisma.assetCategory.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching AssetCategories:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    if (!data.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const newCategory = await prisma.assetCategory.create({
      data: {
        name: data.name,
        description: data.description,
        branchId: data.branchId || null,
      },
    });

    return NextResponse.json(newCategory);
  } catch (error) {
    console.error('Error creating AssetCategory:', error);

    if (error instanceof Error && (error as unknown as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
