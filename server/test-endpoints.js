require('dotenv').config({ path: 'E:/PMR-Traders/server/.env' });
const pool = require('./src/db');
const jwt = require('jsonwebtoken');

async function testApi() {
  const sureshUser = (await pool.query("SELECT * FROM users WHERE name = 'Suresh Supervisor'")).rows[0];
  const token = jwt.sign(
    { id: sureshUser.id, name: sureshUser.name, role: sureshUser.role, group_id: sureshUser.group_id },
    process.env.JWT_SECRET || 'pmr_secret_key_2026',
    { expiresIn: '1d' }
  );

  const ajju = (await pool.query("SELECT id FROM customers WHERE name = 'AJJU'")).rows[0];

  // 1. Ledger
  const res = await fetch(`http://localhost:4000/api/customers/${ajju.id}/ledger`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('\n--- AJJU LEDGER STATUS:', res.status);
  console.log('Customer:', data.customer?.name, `(${data.customer?.group_name})`);
  console.log('Opening Balance:', data.opening_balance);
  console.log('Transactions Count:', data.transactions?.length);
  for (const tx of (data.transactions || [])) {
    console.log(`  ${tx.date} | ${tx.particulars} | Vch #${tx.voucher_no} | ${tx.boxes}b | ${tx.weight_kg}kg | Rate ₹${tx.rate} | Debit: ₹${tx.debit} | Running Balance: ₹${tx.running_balance} ${tx.balance_type}`);
  }
  console.log('Closing Balance:', data.summary?.closing_balance, data.summary?.closing_balance_type);

  // 2. Group Summary
  const sumRes = await fetch(`http://localhost:4000/api/reports/group-summary?group_id=${sureshUser.group_id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const sumData = await sumRes.json();
  console.log('\n--- GROUP SUMMARY STATUS:', sumRes.status);
  console.log('Group Name:', sumData.group_name);
  console.log('Customers in summary:', sumData.rows?.length);
  console.log('Grand Total:', sumData.grand_total);

  // 3. Daily Sheet
  const today = new Date().toISOString().split('T')[0];
  const sheetRes = await fetch(`http://localhost:4000/api/sheets/daily?date=${today}&group_id=${sureshUser.group_id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const sheetData = await sheetRes.json();
  console.log('\n--- DAILY SHEET STATUS:', sheetRes.status);
  console.log('Group Name:', sheetData.group_name);
  console.log('Farms count in sheet:', sheetData.farms?.length);
  for (const f of (sheetData.farms || [])) {
    console.log(`  🌾 ${f.farm_name}: ${f.orders.length} order(s) | Subtotal: ${f.subtotal.boxes}b, ${f.subtotal.weight_kg}kg, ₹${f.subtotal.total_amount}`);
  }
  console.log('Grand Total:', sheetData.grand_total);

  await pool.end();
  process.exit(0);
}

testApi().catch(e => {
  console.error(e);
  process.exit(1);
});
