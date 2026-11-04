require('dotenv').config({ path: 'E:/PMR-Traders/server/.env' });
const pool = require('./src/db');
const bcrypt = require('bcryptjs');

async function testAuth() {
  const users = (await pool.query('SELECT id, name, role, credentials FROM users')).rows;
  console.log('USERS IN DB:');
  for (const u of users) {
    const isPass = u.role === 'ADMIN' ? 'admin123' : u.name.toLowerCase().includes('sathish') ? 'sathish123' : 'suresh123';
    const match = await bcrypt.compare(isPass, u.credentials);
    console.log(`- ${u.name} (${u.role}): match '${isPass}' ->`, match);
  }

  // Also test HTTP login request
  const res = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Admin Owner', password: 'admin123' })
  });
  console.log('HTTP login status:', res.status);
  const data = await res.json();
  console.log('HTTP login response:', data);

  await pool.end();
  process.exit(0);
}

testAuth().catch(console.error);
