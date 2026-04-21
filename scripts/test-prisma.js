const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const dotenvPath = path.join(__dirname, '..', '.env');
const dotenvContent = fs.readFileSync(dotenvPath, 'utf8');
let url = '';
dotenvContent.split('\n').forEach(line => {
  if (line.startsWith('DATABASE_URL=')) {
    url = line.replace('DATABASE_URL=', '').trim().replace(/^"|"$/g, '');
  }
});

console.log('Testing Prisma with URL:', url.replace(/\/\/.*:.*@/, '//***:***@'));

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: url
    }
  }
});

async function test() {
  try {
    await prisma.$connect();
    console.log('Connected!');
    
    const users = await prisma.user.findMany({ take: 1 });
    console.log('Found users:', users.length);
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('Error:', e.code, e.message);
    console.error('Meta:', e.meta);
  } finally {
    await prisma.$disconnect();
  }
}

test();