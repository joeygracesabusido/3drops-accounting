import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username } = body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase() },
          { email: username.toLowerCase() },
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockUntil: null,
      },
    });

    return NextResponse.json({ message: 'Account unlocked successfully' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
