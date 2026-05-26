import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(branches);
  } catch (error) {
    console.error('Error fetching branches:', error);
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, code, address, contactPerson, contactPhone, contactEmail } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
    }

    const existing = await prisma.branch.findFirst({
      where: { OR: [{ name }, { code }] },
    });
    if (existing) {
      return NextResponse.json({ error: 'Branch name or code already exists' }, { status: 409 });
    }

    const branch = await prisma.branch.create({
      data: { name, code, address, contactPerson, contactPhone, contactEmail },
    });

    return NextResponse.json(branch);
  } catch (error) {
    console.error('Error creating branch:', error);
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 });
  }
}
