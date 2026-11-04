
require('dotenv').config({ path: 'E:/PMR-Traders/server/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.query('SELECT 1')
  .then(res => {
    console.log('Query successful:', res.rows[0]);
    return pool.end();
  })
  .catch(err => {
    console.error('Query failed:', err.message);
    process.exit(1);
  });

