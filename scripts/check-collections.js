const { MongoClient } = require('mongodb');
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

if (!url) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}
console.log('Connecting to:', url.replace(/:[^:@]+@/, ':***@'));

async function check() {
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name).join(', '));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.close();
  }
}

check();