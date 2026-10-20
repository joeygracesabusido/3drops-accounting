import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await prisma.user.findMany({ take: 1 });
    return NextResponse.json({
      message: 'Connected',
      userCount: users.length,
      url: (process.env.DATABASE_URL || '').replace(/\/\/.*:.*@/, '//***:***@'),
      users: users.map(u => ({ username: u.username, role: u.role }))
    });
  } catch (e: unknown) {
    console.error('DEBUG error:', e);
    const err = e as { message?: string; code?: string; meta?: unknown };
    return NextResponse.json({
      error: err.message,
      code: err.code,
      meta: err.meta
    }, { status: 500 });
  }
}
