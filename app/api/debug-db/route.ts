import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const dotenvPath = path.join(process.cwd(), '.env');
const dotenvContent = fs.readFileSync(dotenvPath, 'utf8');
let url = '';
dotenvContent.split('\n').forEach(line => {
  if (line.startsWith('DATABASE_URL=')) {
    url = line.replace('DATABASE_URL=', '').trim().replace(/^"|"$/g, '');
  }
});

console.log('NEXT.JS DATABASE_URL:', url.replace(/\/\/.*:.*@/, '//***:***@'));

const prisma = new PrismaClient({
  datasources: {
    db: { url }
  }
});

export async function GET() {
  try {
    const users = await prisma.user.findMany({ take: 1 });
    return NextResponse.json({ 
      message: 'Connected',
      userCount: users.length,
      url: url.replace(/\/\/.*:.*@/, '//***:***@'),
      users: users.map(u => ({ username: u.username, role: u.role }))
    });
  } catch (e: any) {
    console.error('DEBUG error:', e);
    return NextResponse.json({ 
      error: e.message,
      code: e.code,
      meta: e.meta
    }, { status: 500 });
  }
}