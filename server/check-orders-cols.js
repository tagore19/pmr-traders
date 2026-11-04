require('dotenv').config({ path: 'E:/PMR-Traders/server/.env' });
const pool = require('./src/db');

async function checkCols() {
  const pCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customer_payments'");
  console.log('PAYMENTS COLUMNS:', pCols.rows.map(r => r.column_name));

  const cCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customer_credit_notes'");
  console.log('CREDIT NOTES COLUMNS:', cCols.rows.map(r => r.column_name));
  await pool.end();
}

checkCols().catch(console.error);
