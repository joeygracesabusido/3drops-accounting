import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get('isLoggedIn')?.value;

    if (!isLoggedIn) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const locations = await prisma.officeLocation.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(locations);
  } catch (error) {
    console.error('Error fetching office locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch office locations' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (!userRole || !['ADMIN', 'HR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin or HR access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, latitude, longitude, radius } = body;

    if (!name || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Name, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90) {
      return NextResponse.json(
        { error: 'Invalid latitude. Must be between -90 and 90' },
        { status: 400 }
      );
    }

    if (longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: 'Invalid longitude. Must be between -180 and 180' },
        { status: 400 }
      );
    }

    const location = await prisma.officeLocation.create({
      data: {
        name,
        latitude,
        longitude,
        radius: radius || 5,
        isActive: true,
      },
    });

    return NextResponse.json(location, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating office location:', error);
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Office location with this name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create office location' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (!userRole || !['ADMIN', 'HR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin or HR access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, latitude, longitude, radius, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const updateData: Partial<{ name: string; latitude: number; longitude: number; radius: number; isActive: boolean }> = {};

    if (name !== undefined) updateData.name = name;
    if (latitude !== undefined) {
      if (latitude < -90 || latitude > 90) {
        return NextResponse.json(
          { error: 'Invalid latitude. Must be between -90 and 90' },
          { status: 400 }
        );
      }
      updateData.latitude = latitude;
    }
    if (longitude !== undefined) {
      if (longitude < -180 || longitude > 180) {
        return NextResponse.json(
          { error: 'Invalid longitude. Must be between -180 and 180' },
          { status: 400 }
        );
      }
      updateData.longitude = longitude;
    }
    if (radius !== undefined) updateData.radius = radius;
    if (isActive !== undefined) updateData.isActive = isActive;

    const location = await prisma.officeLocation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(location);
  } catch (error) {
    console.error('Error updating office location:', error);
    return NextResponse.json(
      { error: 'Failed to update office location' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (!userRole || !['ADMIN', 'HR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin or HR access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    await prisma.officeLocation.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Office location deleted successfully' });
  } catch (error) {
    console.error('Error deleting office location:', error);
    return NextResponse.json(
      { error: 'Failed to delete office location' },
      { status: 500 }
    );
  }
}

