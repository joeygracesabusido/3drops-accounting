const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
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

async function check() {
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    const users = db.collection('users');
    
    const user = await users.findOne({ $or: [{ username: 'joeysabusido' }, { email: 'joeysabusido' }] });
    
    if (user) {
      console.log('User found:', JSON.stringify({ username: user.username, email: user.email, role: user.role, status: user.status }, null, 2));
      
      const isValid = await bcrypt.compare('genesis11', user.password);
      console.log('Password valid:', isValid);
    } else {
      console.log('User not found');
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.close();
  }
}

check();