const express = require('express');
const pool = require('../db');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/admin/rates/daily – Set today's paper rate
router.post('/rates/daily', verifyAdmin, async (req, res) => {
  const { date, paper_rate } = req.body;
  if (!date || paper_rate === undefined) {
    return res.status(400).json({ error: 'date and paper_rate required' });
  }
  try {
    // Check if orders already exist for that date → prompt for recalculation
    const { rows: existing } = await pool.query(
      'SELECT id FROM daily_rates WHERE date = $1', [date]
    );
    if (existing.length) {
      return res.status(409).json({
        error: 'Rate for this date already exists. Use PUT to update.',
        existingId: existing[0].id
      });
    }
    const { rows } = await pool.query(
      `INSERT INTO daily_rates (date, paper_rate, set_by_admin_id, set_by_user_id)
       VALUES ($1, $2, $3, $3) RETURNING *`,
      [date, paper_rate, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/admin/rates/daily/:date – Update paper rate (prompts recalculation on frontend)
router.put('/rates/daily/:date', verifyAdmin, async (req, res) => {
  const { paper_rate } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE daily_rates SET paper_rate=$1 WHERE date=$2 RETURNING *`,
      [paper_rate, req.params.date]
    );
    if (!rows.length) return res.status(404).json({ error: 'Rate not found for this date' });

    // Check existing orders for that date
    const { rows: orders } = await pool.query(
      'SELECT COUNT(*) FROM orders WHERE date = $1', [req.params.date]
    );
    res.json({ rate: rows[0], ordersExist: parseInt(orders[0].count) > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── CUSTOMERS ──────────────────────────────────────────────────────────────

// POST /api/admin/customers
router.post('/customers', verifyAdmin, async (req, res) => {
  const { name, group_id, minus_rate } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Customer name required' });
  let targetGroupId = group_id;
  if (!targetGroupId) {
    const g = await pool.query('SELECT id FROM groups ORDER BY name LIMIT 1');
    targetGroupId = g.rows[0]?.id;
  }
  if (!targetGroupId) return res.status(400).json({ error: 'group_id required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO customers (name, group_id, minus_rate)
       VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), targetGroupId, minus_rate !== undefined ? parseFloat(minus_rate) : 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Customer name already exists in this group' });
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/admin/customers/:id
router.put('/customers/:id', verifyAdmin, async (req, res) => {
  const { name, group_id, minus_rate } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE customers SET
         name = COALESCE($1, name),
         group_id = COALESCE($2, group_id),
         minus_rate = COALESCE($3, minus_rate)
       WHERE id = $4 RETURNING *`,
      [name ? name.trim() : null, group_id || null, minus_rate !== undefined ? parseFloat(minus_rate) : null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Customer name already exists in this group' });
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// DELETE /api/admin/customers/:id – Delete customer
router.delete('/customers/:id', verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM customers WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted', customer: rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete customer: they already have recorded orders or payments in the system.' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/customers/:id/profile – Full ledger profile
router.get('/customers/:id/profile', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { year, from, to } = req.query;
  let dateFilter = '';
  const params = [id];
  if (year) {
    params.push(year);
    dateFilter = `AND EXTRACT(YEAR FROM o.date) = $${params.length}`;
  } else if (from && to) {
    params.push(from, to);
    dateFilter = `AND o.date BETWEEN $${params.length - 1} AND $${params.length}`;
  }
  try {
    const customer = await pool.query(
      'SELECT c.*, g.name AS group_name FROM customers c LEFT JOIN groups g ON g.id=c.group_id WHERE c.id=$1',
      [id]
    );
    if (!customer.rows.length) return res.status(404).json({ error: 'Customer not found' });

    const orders = await pool.query(
      `SELECT o.*, f.farm_name FROM orders o
       LEFT JOIN farms f ON f.id = o.farm_id
       WHERE o.customer_id = $1 ${dateFilter}
       ORDER BY o.date DESC`,
      params
    );

    const payments = await pool.query(
      `SELECT * FROM customer_payments WHERE customer_id=$1 ORDER BY payment_date DESC`,
      [id]
    );

    const summary = await pool.query(
      `SELECT
         COALESCE(SUM(o.weight_kg), 0)      AS total_kg,
         COALESCE(SUM(o.total_amount), 0)   AS total_billed
       FROM orders o WHERE o.customer_id=$1`,
      [id]
    );
    const paidResult = await pool.query(
      `SELECT COALESCE(SUM(amount_paid),0) AS total_paid
       FROM customer_payments WHERE customer_id=$1 AND is_reversed=FALSE`,
      [id]
    );
    const totalBilled = parseFloat(summary.rows[0].total_billed);
    const totalPaid = parseFloat(paidResult.rows[0].total_paid);
    const outstanding = totalBilled - totalPaid;

    res.json({
      customer: customer.rows[0],
      orders: orders.rows,
      payments: payments.rows,
      summary: {
        total_kg: parseFloat(summary.rows[0].total_kg),
        total_billed: totalBilled,
        total_paid: totalPaid,
        outstanding_due: outstanding,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/customers/:id/payments – Record payment from customer
router.post('/customers/:id/payments', verifyAdmin, async (req, res) => {
  const { payment_date, amount_paid, notes } = req.body;
  if (!payment_date || !amount_paid) {
    return res.status(400).json({ error: 'payment_date and amount_paid required' });
  }
  try {
    // Get customer's group_id
    const cust = await pool.query('SELECT group_id FROM customers WHERE id=$1', [req.params.id]);
    if (!cust.rows.length) return res.status(404).json({ error: 'Customer not found' });
    const groupId = cust.rows[0].group_id;
    
    const { rows } = await pool.query(
      `INSERT INTO customer_payments (customer_id, group_id, payment_date, amount_paid, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, groupId, payment_date, amount_paid, notes, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/customers/:id/payments
router.get('/customers/:id/payments', verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM customer_payments WHERE customer_id=$1 ORDER BY payment_date DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── FARMS ──────────────────────────────────────────────────────────────────

// POST /api/admin/farms
router.post('/farms', verifyAdmin, async (req, res) => {
  const { farm_name, route_details } = req.body;
  if (!farm_name) return res.status(400).json({ error: 'farm_name required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO farms (farm_name, route_details) VALUES ($1,$2) RETURNING *`,
      [farm_name, route_details]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Farm name already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/farms/:id
router.put('/farms/:id', verifyAdmin, async (req, res) => {
  const { farm_name, route_details, is_active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE farms SET
         farm_name = COALESCE($1, farm_name),
         route_details = COALESCE($2, route_details),
         is_active = COALESCE($3, is_active)
       WHERE id=$4 RETURNING *`,
      [farm_name, route_details, is_active, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Farm not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/farms/:id/profile – Full farm ledger profile
router.get('/farms/:id/profile', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { year, from, to } = req.query;
  let dateFilter = '';
  const params = [id];
  if (year) {
    params.push(year);
    dateFilter = `AND EXTRACT(YEAR FROM s.date) = $${params.length}`;
  } else if (from && to) {
    params.push(from, to);
    dateFilter = `AND s.date BETWEEN $${params.length - 1} AND $${params.length}`;
  }
  try {
    const farm = await pool.query('SELECT * FROM farms WHERE id=$1', [id]);
    if (!farm.rows.length) return res.status(404).json({ error: 'Farm not found' });

    const intakes = await pool.query(
      `SELECT * FROM farm_stock_intake s WHERE s.farm_id=$1 ${dateFilter} ORDER BY s.date DESC`,
      params
    );
    const payments = await pool.query(
      `SELECT * FROM farm_payments WHERE farm_id=$1 ORDER BY payment_date DESC`,
      [id]
    );
    const summary = await pool.query(
      `SELECT
         COALESCE(SUM(weight_kg),0)       AS total_kg,
         COALESCE(SUM(payable_amount),0)  AS total_payable
       FROM farm_stock_intake WHERE farm_id=$1`,
      [id]
    );
    const paidResult = await pool.query(
      `SELECT COALESCE(SUM(amount_paid),0) AS total_paid
       FROM farm_payments WHERE farm_id=$1 AND is_reversed=FALSE`,
      [id]
    );
    const totalPayable = parseFloat(summary.rows[0].total_payable);
    const totalPaid = parseFloat(paidResult.rows[0].total_paid);

    res.json({
      farm: farm.rows[0],
      intakes: intakes.rows,
      payments: payments.rows,
      summary: {
        total_kg: parseFloat(summary.rows[0].total_kg),
        total_payable: totalPayable,
        total_paid: totalPaid,
        outstanding_due: totalPayable - totalPaid,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/farms/:id/payments – Record payment to a farm
router.post('/farms/:id/payments', verifyAdmin, async (req, res) => {
  const { payment_date, amount_paid, notes } = req.body;
  if (!payment_date || !amount_paid) {
    return res.status(400).json({ error: 'payment_date and amount_paid required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO farm_payments (farm_id, payment_date, amount_paid, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, payment_date, amount_paid, notes, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── STOCK INTAKE ──────────────────────────────────────────────────────────

// POST /api/admin/stock
router.post('/stock', verifyAdmin, async (req, res) => {
  const { date, farm_id, weight_kg, rate_per_kg, notes } = req.body;
  if (!date || !farm_id || !weight_kg || !rate_per_kg) {
    return res.status(400).json({ error: 'date, farm_id, weight_kg, rate_per_kg required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO farm_stock_intake (date, farm_id, weight_kg, rate_per_kg, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [date, farm_id, weight_kg, rate_per_kg, notes]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/stock
router.get('/stock', verifyAdmin, async (req, res) => {
  const { date, farm_id } = req.query;
  let query = `SELECT s.*, f.farm_name FROM farm_stock_intake s JOIN farms f ON f.id=s.farm_id WHERE 1=1`;
  const params = [];
  if (date) { params.push(date); query += ` AND s.date=$${params.length}`; }
  if (farm_id) { params.push(farm_id); query += ` AND s.farm_id=$${params.length}`; }
  query += ' ORDER BY s.date DESC';
  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/stock/:id – Update weight_loss_kg (auto-recalculates stored columns)
router.put('/stock/:id', verifyAdmin, async (req, res) => {
  const { weight_loss_kg, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE farm_stock_intake SET
         weight_loss_kg = COALESCE($1, weight_loss_kg),
         notes = COALESCE($2, notes)
       WHERE id=$3 RETURNING *`,
      [weight_loss_kg, notes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Stock record not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/stock/:id
router.delete('/stock/:id', verifyAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM farm_stock_intake WHERE id=$1', [req.params.id]);
    res.json({ message: 'Stock record deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/orders/:id – Admin override any order
router.put('/orders/:id', verifyAdmin, async (req, res) => {
  const { weight_kg, applied_paper_rate, applied_minus_rate } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE orders SET
         weight_kg = COALESCE($1, weight_kg),
         applied_paper_rate = COALESCE($2, applied_paper_rate),
         applied_minus_rate = COALESCE($3, applied_minus_rate)
       WHERE id=$4 RETURNING *`,
      [weight_kg, applied_paper_rate, applied_minus_rate, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/customers – list all customers (optionally filtered by group)
router.get('/customers', verifyAdmin, async (req, res) => {
  try {
    let query, params;
    if (req.query.group_id) {
      query = `SELECT c.*, g.name AS group_name
               FROM customers c
               LEFT JOIN groups g ON g.id = c.group_id
               WHERE c.group_id = $1 ORDER BY c.name`;
      params = [req.query.group_id];
    } else {
      query = `SELECT c.*, g.name AS group_name
               FROM customers c
               LEFT JOIN groups g ON g.id = c.group_id
               ORDER BY c.name`;
      params = [];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message || 'Server error' }); }
});

// GET /api/admin/farms – list all farms
router.get('/farms', verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM farms ORDER BY farm_name');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/users – list all users (supervisors)
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.role, u.group_id, g.name AS group_name, u.created_at
       FROM users u
       LEFT JOIN groups g ON g.id=u.group_id
       ORDER BY u.name`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/groups – list all groups
router.get('/groups', verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM groups ORDER BY name');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
