const express = require('express');
const pool = require('../db');
const { verifySupervisor } = require('../middleware/auth');
const { isValidDateString, parsePositiveFloat, parsePositiveInt, sanitizeString, isValidUUID } = require('../middleware/security');

const router = express.Router();

// Helper: resolve group_id for supervisor if not present in token
async function resolveUserGroupId(user) {
  if (user.group_id) return user.group_id;
  const u = await pool.query('SELECT group_id FROM users WHERE id = $1', [user.id]);
  return u.rows[0]?.group_id || null;
}

// ── DAILY PAPER RATES ────────────────────────────────────────────────────────

// GET /api/rates/today – Get today's paper rate (Global)
router.get('/rates/today', verifySupervisor, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await pool.query(
      `SELECT r.*, u.name AS set_by_name, u.role AS set_by_role
       FROM daily_rates r
       LEFT JOIN users u ON u.id = COALESCE(r.set_by_admin_id, r.set_by_user_id)
       WHERE r.date = $1`,
      [today]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Today's Paper Rate has not been set yet." });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/rates/by-date – Get rate for any specific date
router.get('/rates/by-date', verifySupervisor, async (req, res) => {
  const { date } = req.query;
  if (!date || !isValidDateString(date)) {
    return res.status(400).json({ error: 'Valid date query parameter (YYYY-MM-DD) required' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.name AS set_by_name, u.role AS set_by_role
       FROM daily_rates r
       LEFT JOIN users u ON u.id = COALESCE(r.set_by_admin_id, r.set_by_user_id)
       WHERE r.date = $1`,
      [date]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'No paper rate found for ' + date });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/rates/history – Get recent rates history (last 60 entries)
router.get('/rates/history', verifySupervisor, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.name AS set_by_name, u.role AS set_by_role
       FROM daily_rates r
       LEFT JOIN users u ON u.id = COALESCE(r.set_by_admin_id, r.set_by_user_id)
       ORDER BY r.date DESC
       LIMIT 60`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/rates/daily – Set or update paper rate for any date (UPSERT)
router.post('/rates/daily', verifySupervisor, async (req, res) => {
  const { date, paper_rate } = req.body;
  if (!date || !isValidDateString(date)) {
    return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
  }
  const rate = parsePositiveFloat(paper_rate, -1);
  if (rate < 0) {
    return res.status(400).json({ error: 'paper_rate must be a valid non-negative number' });
  }

  try {
    // Check if orders already exist for that date
    const { rows: orders } = await pool.query(
      'SELECT COUNT(*) FROM orders WHERE date = $1',
      [date]
    );
    const ordersExist = parseInt(orders[0].count, 10) > 0;

    const { rows } = await pool.query(
      `INSERT INTO daily_rates (date, paper_rate, set_by_admin_id, set_by_user_id)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (date) DO UPDATE
       SET paper_rate = EXCLUDED.paper_rate,
           set_by_admin_id = EXCLUDED.set_by_admin_id,
           set_by_user_id = EXCLUDED.set_by_user_id
       RETURNING *`,
      [date, rate, req.user.id]
    );
    res.status(200).json({ rate: rows[0], ordersExist });
  } catch (err) {
    console.error('[RATES POST ERROR]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/rates/daily/:date – Update paper rate (Admin or Supervisor)
router.put('/rates/daily/:date', verifySupervisor, async (req, res) => {
  const { date } = req.params;
  if (!isValidDateString(date)) {
    return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
  }
  const rate = parsePositiveFloat(req.body.paper_rate, -1);
  if (rate < 0) {
    return res.status(400).json({ error: 'paper_rate must be a valid non-negative number' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO daily_rates (date, paper_rate, set_by_admin_id, set_by_user_id)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (date) DO UPDATE
       SET paper_rate = EXCLUDED.paper_rate,
           set_by_admin_id = EXCLUDED.set_by_admin_id,
           set_by_user_id = EXCLUDED.set_by_user_id
       RETURNING *`,
      [date, rate, req.user.id]
    );

    const { rows: orders } = await pool.query(
      'SELECT COUNT(*) FROM orders WHERE date = $1',
      [date]
    );
    res.json({ rate: rows[0], ordersExist: parseInt(orders[0].count, 10) > 0 });
  } catch (err) {
    console.error('[RATES PUT ERROR]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ── GROUPS ──────────────────────────────────────────────────────────────────

// GET /api/groups – Get all groups (for supervisor/admin dropdowns)
router.get('/groups', verifySupervisor, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM groups ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ── CUSTOMERS ───────────────────────────────────────────────────────────────

// GET /api/customers – All customers (scoped to group for supervisor, all or filtered for admin)
router.get('/customers', verifySupervisor, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'ADMIN') {
      if (req.query.group_id && isValidUUID(req.query.group_id)) {
        query = `SELECT c.id, c.name, c.minus_rate, c.opening_balance, c.opening_balance_type, c.group_id, g.name AS group_name
                 FROM customers c
                 LEFT JOIN groups g ON g.id = c.group_id
                 WHERE c.group_id = $1 ORDER BY c.name`;
        params = [req.query.group_id];
      } else {
        query = `SELECT c.id, c.name, c.minus_rate, c.opening_balance, c.opening_balance_type, c.group_id, g.name AS group_name
                 FROM customers c
                 LEFT JOIN groups g ON g.id = c.group_id
                 ORDER BY c.name`;
        params = [];
      }
    } else {
      const gid = await resolveUserGroupId(req.user);
      query = `SELECT c.id, c.name, c.minus_rate, c.opening_balance, c.opening_balance_type, c.group_id, g.name AS group_name
               FROM customers c
               LEFT JOIN groups g ON g.id = c.group_id
               WHERE c.group_id = $1 ORDER BY c.name`;
      params = [gid];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[CUSTOMERS GET ERROR]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/customers – Create customer (supervisor auto-assigned; admin chooses or defaults)
router.post('/customers', verifySupervisor, async (req, res) => {
  const rawName = sanitizeString(req.body.name, 100);
  if (!rawName) return res.status(400).json({ error: 'Customer name is required' });

  try {
    let targetGroupId = req.user.role === 'ADMIN' ? req.body.group_id : await resolveUserGroupId(req.user);

    if (!targetGroupId) {
      const g = await pool.query('SELECT id FROM groups ORDER BY name LIMIT 1');
      targetGroupId = g.rows[0]?.id;
      if (targetGroupId && req.user.role !== 'ADMIN') {
        await pool.query('UPDATE users SET group_id = $1 WHERE id = $2', [targetGroupId, req.user.id]);
      }
    }
    if (!targetGroupId) {
      return res.status(400).json({ error: 'No group found in system. Please seed groups first.' });
    }

    const minusRate = parsePositiveFloat(req.body.minus_rate, 0);
    const openingBal = parsePositiveFloat(req.body.opening_balance, 0);
    const opBalType = req.body.opening_balance_type === 'CR' ? 'CR' : 'DR';

    const { rows } = await pool.query(
      `INSERT INTO customers (name, group_id, minus_rate, opening_balance, opening_balance_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [rawName, targetGroupId, minusRate, openingBal, opBalType]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A customer with this name already exists in this group' });
    }
    console.error('[CUSTOMER POST ERROR]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/customers/:id – Update customer
router.put('/customers/:id', verifySupervisor, async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ error: 'Invalid customer ID format' });

  const rawName = req.body.name ? sanitizeString(req.body.name, 100) : null;
  const minusRate = req.body.minus_rate !== undefined ? parsePositiveFloat(req.body.minus_rate, 0) : null;
  const openingBal = req.body.opening_balance !== undefined ? parsePositiveFloat(req.body.opening_balance, 0) : null;
  const opBalType = req.body.opening_balance_type ? (req.body.opening_balance_type === 'CR' ? 'CR' : 'DR') : null;

  try {
    let query, params;
    if (req.user.role === 'ADMIN') {
      query = `UPDATE customers SET
                 name = COALESCE($1, name),
                 minus_rate = COALESCE($2, minus_rate),
                 opening_balance = COALESCE($3, opening_balance),
                 opening_balance_type = COALESCE($4, opening_balance_type)
               WHERE id = $5 RETURNING *`;
      params = [rawName, minusRate, openingBal, opBalType, id];
    } else {
      const gid = await resolveUserGroupId(req.user);
      query = `UPDATE customers SET
                 name = COALESCE($1, name),
                 minus_rate = COALESCE($2, minus_rate),
                 opening_balance = COALESCE($3, opening_balance),
                 opening_balance_type = COALESCE($4, opening_balance_type)
               WHERE id = $5 AND group_id = $6 RETURNING *`;
      params = [rawName, minusRate, openingBal, opBalType, id, gid];
    }

    const { rows } = await pool.query(query, params);
    if (!rows.length) return res.status(404).json({ error: 'Customer not found or access denied' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Customer name already exists in this group' });
    }
    console.error('[CUSTOMER PUT ERROR]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// DELETE /api/customers/:id – Delete customer with referential check
router.delete('/customers/:id', verifySupervisor, async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ error: 'Invalid customer ID format' });

  try {
    let query, params;
    if (req.user.role === 'ADMIN') {
      query = `DELETE FROM customers WHERE id = $1 RETURNING *`;
      params = [id];
    } else {
      const gid = await resolveUserGroupId(req.user);
      query = `DELETE FROM customers WHERE id = $1 AND group_id = $2 RETURNING *`;
      params = [id, gid];
    }
    const { rows } = await pool.query(query, params);
    if (!rows.length) return res.status(404).json({ error: 'Customer not found or access denied' });
    res.json({ message: 'Customer deleted', customer: rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete customer: they already have recorded orders, payments, or credit notes.' });
    }
    console.error('[CUSTOMER DELETE ERROR]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ── ORDERS ──────────────────────────────────────────────────────────────────

// POST /api/orders – Submit a new order (ACID Transaction)
router.post('/orders', verifySupervisor, async (req, res) => {
  const { customer_id, daily_farm_id, farm_id, boxes, weight_kg, date, notes } = req.body;
  const effectiveFarmId = daily_farm_id || farm_id;

  if (!customer_id || !isValidUUID(customer_id)) {
    return res.status(400).json({ error: 'Valid customer_id is required' });
  }
  if (!effectiveFarmId || !isValidUUID(effectiveFarmId)) {
    return res.status(400).json({ error: 'Please select a valid Daily Farm for this order' });
  }

  const orderWeight = parsePositiveFloat(weight_kg, 0);
  if (orderWeight <= 0) {
    return res.status(400).json({ error: 'weight_kg must be a positive number greater than 0' });
  }

  const orderBoxes = parsePositiveInt(boxes, 1);
  if (orderBoxes <= 0) {
    return res.status(400).json({ error: 'boxes must be at least 1' });
  }

  const orderDate = date || new Date().toISOString().split('T')[0];
  if (!isValidDateString(orderDate)) {
    return res.status(400).json({ error: 'Invalid order date format. Expected YYYY-MM-DD.' });
  }

  try {
    // Execute inside ACID transaction
    const createdOrder = await pool.withTransaction(async (client) => {
      // 1. Verify paper rate exists for date
      const { rows: rateRows } = await client.query(
        'SELECT paper_rate FROM daily_rates WHERE date = $1',
        [orderDate]
      );
      if (!rateRows.length) {
        throw new Error(`Paper Rate has not been set for ${orderDate}. Please set today's paper rate first.`);
      }
      const paperRate = parseFloat(rateRows[0].paper_rate);

      // 2. Verify daily farm exists
      const { rows: farmRows } = await client.query(
        'SELECT id, farm_name FROM daily_farms WHERE id = $1',
        [effectiveFarmId]
      );
      if (!farmRows.length) {
        throw new Error('Selected daily farm was not found. Please refresh and select an existing farm.');
      }

      // 3. Verify customer and group access
      let custQuery, custParams;
      if (req.user.role === 'ADMIN') {
        custQuery = 'SELECT id, minus_rate, group_id FROM customers WHERE id = $1';
        custParams = [customer_id];
      } else {
        const gid = await resolveUserGroupId(req.user);
        custQuery = 'SELECT id, minus_rate, group_id FROM customers WHERE id = $1 AND group_id = $2';
        custParams = [customer_id, gid];
      }
      const { rows: custRows } = await client.query(custQuery, custParams);
      if (!custRows.length) {
        throw new Error('Customer not found or not accessible within your group.');
      }

      const minusRate = parseFloat(custRows[0].minus_rate) || 0;
      const customerGroupId = custRows[0].group_id;

      // 4. Insert order
      const { rows: inserted } = await client.query(
        `INSERT INTO orders (date, customer_id, group_id, supervisor_id, daily_farm_id, boxes, weight_kg, applied_paper_rate, applied_minus_rate, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          orderDate,
          customer_id,
          customerGroupId,
          req.user.id,
          effectiveFarmId,
          orderBoxes,
          orderWeight,
          paperRate,
          minusRate,
          sanitizeString(notes, 500) || null
        ]
      );

      // 5. Fetch full order with joined display details
      const fullOrder = await client.query(
        `SELECT o.*, c.name AS customer_name, df.farm_name, df.vehicle_no, g.name AS group_name, u.name AS supervisor_name
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         JOIN daily_farms df ON df.id = o.daily_farm_id
         JOIN groups g ON g.id = o.group_id
         JOIN users u ON u.id = o.supervisor_id
         WHERE o.id = $1`,
        [inserted[0].id]
      );

      return fullOrder.rows[0];
    });

    res.status(201).json(createdOrder);
  } catch (err) {
    console.error('[ORDER POST ERROR]', err);
    res.status(400).json({ error: err.message || 'Failed to record order' });
  }
});

// GET /api/orders – Orders list (filtered by date, group, or supervisor)
router.get('/orders', verifySupervisor, async (req, res) => {
  const { date, group_id } = req.query;
  const orderDate = date || new Date().toISOString().split('T')[0];

  if (!isValidDateString(orderDate)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' });
  }

  try {
    let query, params;
    if (req.user.role === 'ADMIN') {
      if (group_id && isValidUUID(group_id)) {
        query = `SELECT o.*, c.name AS customer_name, c.group_id, g.name AS group_name, df.farm_name, df.vehicle_no, u.name AS supervisor_name
                 FROM orders o
                 JOIN customers c ON c.id = o.customer_id
                 LEFT JOIN groups g ON g.id = o.group_id
                 LEFT JOIN daily_farms df ON df.id = o.daily_farm_id
                 JOIN users u ON u.id = o.supervisor_id
                 WHERE o.date = $1 AND o.group_id = $2 
                 ORDER BY o.voucher_no DESC, o.created_at DESC`;
        params = [orderDate, group_id];
      } else {
        query = `SELECT o.*, c.name AS customer_name, c.group_id, g.name AS group_name, df.farm_name, df.vehicle_no, u.name AS supervisor_name
                 FROM orders o
                 JOIN customers c ON c.id = o.customer_id
                 LEFT JOIN groups g ON g.id = o.group_id
                 LEFT JOIN daily_farms df ON df.id = o.daily_farm_id
                 JOIN users u ON u.id = o.supervisor_id
                 WHERE o.date = $1 
                 ORDER BY o.voucher_no DESC, o.created_at DESC`;
        params = [orderDate];
      }
    } else {
      const gid = await resolveUserGroupId(req.user);
      query = `SELECT o.*, c.name AS customer_name, c.group_id, g.name AS group_name, df.farm_name, df.vehicle_no
               FROM orders o
               JOIN customers c ON c.id = o.customer_id
               LEFT JOIN groups g ON g.id = o.group_id
               LEFT JOIN daily_farms df ON df.id = o.daily_farm_id
               WHERE o.date = $1 AND o.group_id = $2
               ORDER BY o.voucher_no DESC, o.created_at DESC`;
      params = [orderDate, gid];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[ORDERS GET ERROR]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/orders/:id – Update an existing order with IDOR protection
router.put('/orders/:id', verifySupervisor, async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ error: 'Invalid order ID format' });

  const boxes = req.body.boxes !== undefined ? parsePositiveInt(req.body.boxes, 1) : null;
  const weight = req.body.weight_kg !== undefined ? parsePositiveFloat(req.body.weight_kg, 0) : null;
  const dailyFarmId = req.body.daily_farm_id ? (isValidUUID(req.body.daily_farm_id) ? req.body.daily_farm_id : null) : null;
  const notes = req.body.notes !== undefined ? sanitizeString(req.body.notes, 500) : null;

  try {
    // IDOR check for supervisors
    if (req.user.role !== 'ADMIN') {
      const existing = await pool.query('SELECT group_id FROM orders WHERE id = $1', [id]);
      if (!existing.rows.length) return res.status(404).json({ error: 'Order not found' });
      const gid = await resolveUserGroupId(req.user);
      if (existing.rows[0].group_id !== gid) {
        return res.status(403).json({ error: 'Access denied: cannot modify order from another group' });
      }
    }

    const { rows } = await pool.query(
      `UPDATE orders SET
         boxes = COALESCE($1, boxes),
         weight_kg = COALESCE($2, weight_kg),
         daily_farm_id = COALESCE($3, daily_farm_id),
         notes = COALESCE($4, notes)
       WHERE id = $5
       RETURNING *`,
      [boxes, weight, dailyFarmId, notes, id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[ORDER PUT ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to update order' });
  }
});

// DELETE /api/orders/:id – Cancel / Delete an order with IDOR protection
router.delete('/orders/:id', verifySupervisor, async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ error: 'Invalid order ID format' });

  try {
    // IDOR check for supervisors
    if (req.user.role !== 'ADMIN') {
      const existing = await pool.query('SELECT group_id FROM orders WHERE id = $1', [id]);
      if (!existing.rows.length) return res.status(404).json({ error: 'Order not found' });
      const gid = await resolveUserGroupId(req.user);
      if (existing.rows[0].group_id !== gid) {
        return res.status(403).json({ error: 'Access denied: cannot delete order from another group' });
      }
    }

    const { rows } = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order deleted successfully', order: rows[0] });
  } catch (err) {
    console.error('[ORDER DELETE ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to delete order' });
  }
});

module.exports = router;
