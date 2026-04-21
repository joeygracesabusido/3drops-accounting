import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase() },
          { email: username.toLowerCase() },
        ],
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Account is locked. Try again in ${remainingMinutes} minute(s).` },
        { status: 403 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      const failedAttempts = user.failedAttempts + 1;
      
      if (failedAttempts >= 3) {
        const lockUntil = new Date(Date.now() + 2 * 60 * 1000);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedAttempts: 0,
            lockUntil,
          },
        });
        return NextResponse.json(
          { error: 'Too many failed attempts. Account locked for 2 minutes.' },
          { status: 403 }
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts,
          lockUntil: null,
        },
      });

      return NextResponse.json(
        { error: `Invalid username or password. ${3 - failedAttempts} attempts remaining.` },
        { status: 401 }
      );
    }

    if (user.status === 'FOR_APPROVAL') {
      return NextResponse.json(
        { error: 'Your account is pending approval. Please contact the administrator.' },
        { status: 403 }
      );
    }

    if (user.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Your account has been rejected. Please contact the administrator.' },
        { status: 403 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockUntil: null,
      },
    });

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    }, {
      headers: {
        'Set-Cookie': [
          `isLoggedIn=true; Path=/; Max-Age=${60 * 60 * 24}`,
          `userId=${user.id}; Path=/; Max-Age=${60 * 60 * 24}`,
          `userRole=${user.role}; Path=/; Max-Age=${60 * 60 * 24}`,
          `userEmail=${user.email}; Path=/; Max-Age=${60 * 60 * 24}`,
          `userName=${encodeURIComponent(user.name || '')}; Path=/; Max-Age=${60 * 60 * 24}`,
        ].join(', '),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
