
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
console.log('Testing PostgreSQL connection...');
console.log('Config:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  // Don't log password for security
  passwordSet: !!process.env.DB_PASSWORD
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.query('SELECT NOW() as time')
  .then(res => {
    console.log('? Connected successfully!');
    console.log('Server time:', res.rows[0].time);
    return pool.end();
  })
  .catch(err => {
    console.error('? Connection failed:');
    console.error('  Message:', err.message);
    console.error('  Code:', err.code);
    process.exit(1);
  });

