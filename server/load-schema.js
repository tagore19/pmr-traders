
require('dotenv').config({ path: 'E:/PMR-Traders/server/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('Loading database schema...');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const schemaPath = path.join(__dirname, 'src', 'db', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

pool.query(schema)
  .then(() => {
    console.log('? Schema loaded successfully');
    return pool.end();
  })
  .catch(err => {
    console.error('? Failed to load schema:', err.message);
    process.exit(1);
  });

