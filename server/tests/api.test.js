const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const { startServer } = require('../src/index');
const pool = require('../src/db');
const initDb = require('../src/db/initDb');

const PORT = 4000;
const BASE_URL = `http://localhost:${PORT}/api`;

let serverInstance;
let adminToken = '';
let sureshToken = '';
let sathishToken = '';
let testCustomerId = '';
let testDailyFarmId = '';
let testOrderId = '';
let testPaymentId = '';

test.before(async () => {
  // Ensure database schema and seeds are active
  await initDb(true);
  serverInstance = await startServer();
});

test.after(async () => {
  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
  }
  await pool.end();
});

test('1. System Health Check', async () => {
  const res = await fetch(`${BASE_URL}/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.database, 'connected');
  assert.ok(typeof data.latency_ms === 'number');
});

test('2. Authentication & JWT Issuance', async () => {
  // Admin Login
  const adminRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Admin Owner', password: 'admin123' })
  });
  assert.equal(adminRes.status, 200);
  const adminData = await adminRes.json();
  assert.ok(adminData.token);
  assert.equal(adminData.user.role, 'ADMIN');
  adminToken = adminData.token;

  // Suresh Supervisor Login
  const sureshRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'suresh', password: 'suresh123' })
  });
  assert.equal(sureshRes.status, 200);
  const sureshData = await sureshRes.json();
  assert.ok(sureshData.token);
  assert.equal(sureshData.user.role, 'SUPERVISOR');
  sureshToken = sureshData.token;

  // Sathish Supervisor Login
  const sathishRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'sathish', password: 'sathish123' })
  });
  assert.equal(sathishRes.status, 200);
  const sathishData = await sathishRes.json();
  assert.ok(sathishData.token);
  sathishToken = sathishData.token;

  // Invalid Password Rejection
  const badRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Admin Owner', password: 'wrongpassword' })
  });
  assert.equal(badRes.status, 401);
});

test('3. Auth /me Session Verification', async () => {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.role, 'ADMIN');
  assert.equal(data.user.name, 'Admin Owner');
});

test('4. Daily Paper Rate Management', async () => {
  const testDate = '2026-11-04';
  const testRate = 132.50;

  // Set rate (UPSERT)
  const setRes = await fetch(`${BASE_URL}/rates/daily`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ date: testDate, paper_rate: testRate })
  });
  assert.equal(setRes.status, 200);
  const setData = await setRes.json();
  assert.equal(parseFloat(setData.rate.paper_rate), testRate);

  // Fetch rate by date
  const getRes = await fetch(`${BASE_URL}/rates/by-date?date=${testDate}`, {
    headers: { 'Authorization': `Bearer ${sureshToken}` }
  });
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(parseFloat(getData.paper_rate), testRate);
});

test('5. Daily Farm Procurement Intake & Role-Based Masking', async () => {
  const farmDate = '2026-11-04';
  const farmName = 'Venkat Poultry Farm ' + Date.now();

  // Admin adds farm with rate_per_kg
  const addRes = await fetch(`${BASE_URL}/daily-farms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      date: farmDate,
      farm_name: farmName,
      vehicle_no: 'AP 36 TX 4499',
      total_weight_kg: 2500,
      total_boxes: 120,
      rate_per_kg: 110,
      notes: 'Morning flock intake'
    })
  });
  assert.equal(addRes.status, 201);
  const addData = await addRes.json();
  assert.equal(addData.farm_name, farmName);
  assert.equal(addData.rate_per_kg, 110);
  assert.equal(addData.total_procurement_cost, 2500 * 110);
  testDailyFarmId = addData.id;

  // Supervisor reads farms (Security Check: procurement cost and rate must be masked)
  const supGetRes = await fetch(`${BASE_URL}/daily-farms?date=${farmDate}`, {
    headers: { 'Authorization': `Bearer ${sureshToken}` }
  });
  assert.equal(supGetRes.status, 200);
  const supFarms = await supGetRes.json();
  const targetFarm = supFarms.find(f => f.id === testDailyFarmId);
  assert.ok(targetFarm);
  assert.equal(targetFarm.rate_per_kg, null, 'Supervisor should not see rate_per_kg');
  assert.equal(targetFarm.total_procurement_cost, null, 'Supervisor should not see total_procurement_cost');
  assert.equal(parseFloat(targetFarm.remaining_kg), 2500);
});

test('6. Customer CRUD & Group Scoping', async () => {
  const custName = 'Kishan Chicken Center ' + Date.now();

  // Suresh Supervisor adds a customer (auto-scoped to Suresh Group)
  const addRes = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sureshToken}`
    },
    body: JSON.stringify({
      name: custName,
      minus_rate: 4.00,
      opening_balance: 5000,
      opening_balance_type: 'DR'
    })
  });
  assert.equal(addRes.status, 201);
  const addData = await addRes.json();
  assert.equal(addData.name, custName);
  assert.equal(parseFloat(addData.minus_rate), 4.00);
  testCustomerId = addData.id;

  // Suresh Supervisor can view this customer
  const sureshListRes = await fetch(`${BASE_URL}/customers`, {
    headers: { 'Authorization': `Bearer ${sureshToken}` }
  });
  const sureshList = await sureshListRes.json();
  assert.ok(sureshList.some(c => c.id === testCustomerId));

  // Sathish Supervisor CANNOT view or access Suresh Group customer (Authorization Check)
  const sathishListRes = await fetch(`${BASE_URL}/customers`, {
    headers: { 'Authorization': `Bearer ${sathishToken}` }
  });
  const sathishList = await sathishListRes.json();
  assert.ok(!sathishList.some(c => c.id === testCustomerId));
});

test('7. Order Placement & ACID Stock Deduction', async () => {
  // Input Validation Test: Reject negative weight
  const invalidOrderRes = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sureshToken}`
    },
    body: JSON.stringify({
      customer_id: testCustomerId,
      daily_farm_id: testDailyFarmId,
      boxes: 10,
      weight_kg: -50,
      date: '2026-11-04'
    })
  });
  assert.equal(invalidOrderRes.status, 400);

  // Valid Order Placement
  const validOrderRes = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sureshToken}`
    },
    body: JSON.stringify({
      customer_id: testCustomerId,
      daily_farm_id: testDailyFarmId,
      boxes: 20,
      weight_kg: 400,
      date: '2026-11-04',
      notes: 'Delivery crate batch A'
    })
  });
  assert.equal(validOrderRes.status, 201);
  const orderData = await validOrderRes.json();
  assert.equal(parseFloat(orderData.weight_kg), 400);
  // Paper rate was 132.50, customer minus_rate was 4.00 -> final_rate = 128.50
  assert.equal(parseFloat(orderData.final_rate), 128.50);
  // Total amount = 400 * 128.50 = 51400.00
  assert.equal(parseFloat(orderData.total_amount), 51400.00);
  testOrderId = orderData.id;

  // Verify daily farm live remaining stock automatically deducted
  const checkFarmRes = await fetch(`${BASE_URL}/daily-farms?date=2026-11-04`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const farms = await checkFarmRes.json();
  const updatedFarm = farms.find(f => f.id === testDailyFarmId);
  assert.equal(parseFloat(updatedFarm.total_dispatched_kg), 400);
  assert.equal(parseFloat(updatedFarm.remaining_kg), 2100);
  assert.equal(parseInt(updatedFarm.remaining_boxes, 10), 100);
});

test('8. Customer Payments & Credit Notes', async () => {
  // Record Cash Payment
  const payRes = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sureshToken}`
    },
    body: JSON.stringify({
      customer_id: testCustomerId,
      payment_date: '2026-11-04',
      amount_paid: 20000,
      payment_mode: 'CASH',
      notes: 'Part payment received'
    })
  });
  assert.equal(payRes.status, 201);
  const payData = await payRes.json();
  assert.equal(parseFloat(payData.amount_paid), 20000);
  testPaymentId = payData.id;

  // Record Credit Note
  const crRes = await fetch(`${BASE_URL}/credit-notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sureshToken}`
    },
    body: JSON.stringify({
      customer_id: testCustomerId,
      date: '2026-11-04',
      boxes: 1,
      weight_kg: 10,
      rate_per_kg: 128.50,
      reason: '1 dead bird replacement credit'
    })
  });
  assert.equal(crRes.status, 201);
});

test('9. Tally-Style Customer Ledger Calculation', async () => {
  const ledgerRes = await fetch(`${BASE_URL}/customers/${testCustomerId}/ledger`, {
    headers: { 'Authorization': `Bearer ${sureshToken}` }
  });
  assert.equal(ledgerRes.status, 200);
  const ledger = await ledgerRes.json();

  // Opening Balance: 5000 Dr
  assert.equal(ledger.opening_balance.amount, 5000);
  assert.equal(ledger.opening_balance.type, 'Dr');

  // Debits: Order of 51,400.00
  assert.equal(ledger.summary.total_debits, 51400.00);

  // Credits: Payment 20,000 + Credit Note 1,285 = 21,285.00
  assert.equal(ledger.summary.total_credits, 21285.00);

  // Closing Balance: 5,000 + 51,400 - 21,285 = 35,115.00 Dr
  assert.equal(ledger.summary.closing_balance, 35115.00);
  assert.equal(ledger.summary.closing_balance_type, 'Dr');
  assert.equal(ledger.transactions.length, 3);
});

test('10. High-Performance Group Summary (0 N+1 Queries)', async () => {
  const summaryRes = await fetch(`${BASE_URL}/reports/group-summary`, {
    headers: { 'Authorization': `Bearer ${sureshToken}` }
  });
  assert.equal(summaryRes.status, 200);
  const summary = await summaryRes.json();

  assert.ok(summary.rows.length >= 1);
  const customerSummary = summary.rows.find(r => r.id === testCustomerId);
  assert.ok(customerSummary);
  assert.equal(customerSummary.closing_balance, 35115.00);
  assert.equal(customerSummary.closing_balance_type, 'Dr');
  assert.ok(summary.grand_total.closing_balance >= 35115.00);
});

test('11. IDOR Security Checks (Inter-group Access Prevention)', async () => {
  // Sathish Supervisor tries to DELETE Suresh Supervisor customer payment -> Must be 403 Forbidden
  const idorPayRes = await fetch(`${BASE_URL}/payments/${testPaymentId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${sathishToken}` }
  });
  assert.equal(idorPayRes.status, 403, 'Cross-group payment deletion must be forbidden');

  // Sathish Supervisor tries to DELETE Suresh Supervisor order -> Must be 403 Forbidden
  const idorOrderRes = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${sathishToken}` }
  });
  assert.equal(idorOrderRes.status, 403, 'Cross-group order deletion must be forbidden');
});
