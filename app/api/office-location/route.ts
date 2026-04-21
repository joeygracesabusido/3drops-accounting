import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

// Haversine formula to calculate distance between two GPS coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
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

// Helper function to check if a location is within any active office geofence
async function checkGeofence(latitude: number, longitude: number): Promise<{
  isValid: boolean;
  distance: number;
  office?: {
    name: string;
    radius: number;
  };
}> {
  try {
    const activeLocations = await prisma.officeLocation.findMany({
      where: { isActive: true },
    });

    if (activeLocations.length === 0) {
      return {
        isValid: true,
        distance: 0,
        office: undefined,
      };
    }

    let minDistance = Infinity;
    let closestOffice = activeLocations[0];

    for (const location of activeLocations) {
      const distance = calculateDistance(
        latitude,
        longitude,
        location.latitude,
        location.longitude
      );

      if (distance <= location.radius) {
        return {
          isValid: true,
          distance,
          office: {
            name: location.name,
            radius: location.radius,
          },
        };
      }

      if (distance < minDistance) {
        minDistance = distance;
        closestOffice = location;
      }
    }

    return {
      isValid: false,
      distance: minDistance,
      office: {
        name: closestOffice.name,
        radius: closestOffice.radius,
      },
    };
  } catch (error) {
    console.error('Error checking geofence:', error);
    return {
      isValid: true,
      distance: 0,
      office: undefined,
    };
  }
}
