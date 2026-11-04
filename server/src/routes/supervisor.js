const express = require('express');
const pool = require('../db');
const { verifySupervisor } = require('../middleware/auth');

const router = express.Router();

// Helper: get group filter for supervisor
function getGroupFilter(req) {
  if (req.user.role === 'ADMIN') {
    // Admin can filter by group_id query param, or see all
    return req.query.group_id ? `AND c.group_id = $${req.query.group_id ? '99' : '0'}` : '';
  }
  // Supervisor only sees their group
  return req.user.group_id ? `AND c.group_id = '${req.user.group_id}'` : '';
}

// GET /api/rates/today – Get today's paper rate (Global)
router.get('/rates/today', verifySupervisor, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await pool.query(
      `SELECT r.*, u.name AS set_by_name, u.role AS set_by_role
       FROM daily_rates r
       LEFT JOIN users u ON u.id = COALESCE(r.set_by_admin_id, r.set_by_user_id)
       WHERE r.date = $1`, [today]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Today\'s Paper Rate has not been set yet.' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/rates/by-date – Get rate for any specific date
router.get('/rates/by-date', verifySupervisor, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date query parameter required' });
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.name AS set_by_name, u.role AS set_by_role
       FROM daily_rates r
       LEFT JOIN users u ON u.id = COALESCE(r.set_by_admin_id, r.set_by_user_id)
       WHERE r.date = $1`, [date]
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
  if (!date || paper_rate === undefined) {
    return res.status(400).json({ error: 'date and paper_rate required' });
  }
  try {
    // Check if orders already exist for that date
    const { rows: orders } = await pool.query(
      'SELECT COUNT(*) FROM orders WHERE date = $1', [date]
    );
    const ordersExist = parseInt(orders[0].count) > 0;

    const { rows } = await pool.query(
      `INSERT INTO daily_rates (date, paper_rate, set_by_admin_id, set_by_user_id)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (date) DO UPDATE
       SET paper_rate = EXCLUDED.paper_rate,
           set_by_admin_id = EXCLUDED.set_by_admin_id,
           set_by_user_id = EXCLUDED.set_by_user_id
       RETURNING *`,
      [date, paper_rate, req.user.id]
    );
    res.status(200).json({ rate: rows[0], ordersExist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/rates/daily/:date – Update paper rate (Admin or Supervisor)
router.put('/rates/daily/:date', verifySupervisor, async (req, res) => {
  const { paper_rate } = req.body;
  if (paper_rate === undefined) {
    return res.status(400).json({ error: 'paper_rate required' });
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
      [req.params.date, paper_rate, req.user.id]
    );

    // Check existing orders for that date
    const { rows: orders } = await pool.query(
      'SELECT COUNT(*) FROM orders WHERE date = $1', [req.params.date]
    );
    res.json({ rate: rows[0], ordersExist: parseInt(orders[0].count) > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/groups – Get all groups (for admin dropdown)
router.get('/groups', verifySupervisor, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM groups ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers – All customers (scoped to group)
router.get('/customers', verifySupervisor, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'ADMIN') {
      if (req.query.group_id) {
        query = `SELECT c.id, c.name, c.minus_rate, c.opening_balance, c.opening_balance_type, c.group_id, g.name AS group_name
                 FROM customers c
                 LEFT JOIN groups g ON g.id=c.group_id
                 WHERE c.group_id=$1 ORDER BY c.name`;
        params = [req.query.group_id];
      } else {
        query = `SELECT c.id, c.name, c.minus_rate, c.opening_balance, c.opening_balance_type, c.group_id, g.name AS group_name
                 FROM customers c
                 LEFT JOIN groups g ON g.id=c.group_id
                 ORDER BY c.name`;
        params = [];
      }
    } else {
      // Supervisor: lookup group_id if missing in token
      let gid = req.user.group_id;
      if (!gid) {
        const u = await pool.query('SELECT group_id FROM users WHERE id=$1', [req.user.id]);
        gid = u.rows[0]?.group_id;
      }
      query = `SELECT c.id, c.name, c.minus_rate, c.opening_balance, c.opening_balance_type, c.group_id, g.name AS group_name
               FROM customers c
               LEFT JOIN groups g ON g.id=c.group_id
               WHERE c.group_id=$1 ORDER BY c.name`;
      params = [gid];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/customers – Create customer (supervisor auto-assigned; admin chooses or defaults)
router.post('/customers', verifySupervisor, async (req, res) => {
  const { name, minus_rate, opening_balance, opening_balance_type, group_id } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Customer name required' });
  try {
    let targetGroupId = req.user.role === 'ADMIN' ? group_id : req.user.group_id;
    if (!targetGroupId && req.user.role !== 'ADMIN') {
      const u = await pool.query('SELECT group_id FROM users WHERE id=$1', [req.user.id]);
      targetGroupId = u.rows[0]?.group_id;
    }
    if (!targetGroupId) {
      const g = await pool.query('SELECT id FROM groups ORDER BY name LIMIT 1');
      targetGroupId = g.rows[0]?.id;
      if (targetGroupId && req.user.role !== 'ADMIN') {
        await pool.query('UPDATE users SET group_id=$1 WHERE id=$2', [targetGroupId, req.user.id]);
      }
    }
    if (!targetGroupId) {
      return res.status(400).json({ error: 'No group found in system. Please seed groups first.' });
    }
    const { rows } = await pool.query(
      `INSERT INTO customers (name, group_id, minus_rate, opening_balance, opening_balance_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        name.trim(),
        targetGroupId,
        minus_rate !== undefined ? parseFloat(minus_rate) : 0,
        opening_balance !== undefined ? parseFloat(opening_balance) : 0,
        opening_balance_type === 'CR' ? 'CR' : 'DR'
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Customer name already exists in this group' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/customers/:id – Update customer
router.put('/customers/:id', verifySupervisor, async (req, res) => {
  const { name, minus_rate, opening_balance, opening_balance_type } = req.body;
  try {
    let query, params;
    if (req.user.role === 'ADMIN') {
      query = `UPDATE customers SET
                 name = COALESCE($1, name),
                 minus_rate = COALESCE($2, minus_rate),
                 opening_balance = COALESCE($3, opening_balance),
                 opening_balance_type = COALESCE($4, opening_balance_type)
               WHERE id = $5 RETURNING *`;
      params = [
        name ? name.trim() : null,
        minus_rate !== undefined ? parseFloat(minus_rate) : null,
        opening_balance !== undefined ? parseFloat(opening_balance) : null,
        opening_balance_type ? (opening_balance_type === 'CR' ? 'CR' : 'DR') : null,
        req.params.id
      ];
    } else {
      let gid = req.user.group_id;
      if (!gid) {
        const u = await pool.query('SELECT group_id FROM users WHERE id=$1', [req.user.id]);
        gid = u.rows[0]?.group_id;
      }
      query = `UPDATE customers SET
                 name = COALESCE($1, name),
                 minus_rate = COALESCE($2, minus_rate),
                 opening_balance = COALESCE($3, opening_balance),
                 opening_balance_type = COALESCE($4, opening_balance_type)
               WHERE id = $5 AND group_id = $6 RETURNING *`;
      params = [
        name ? name.trim() : null,
        minus_rate !== undefined ? parseFloat(minus_rate) : null,
        opening_balance !== undefined ? parseFloat(opening_balance) : null,
        opening_balance_type ? (opening_balance_type === 'CR' ? 'CR' : 'DR') : null,
        req.params.id,
        gid
      ];
    }
    const { rows } = await pool.query(query, params);
    if (!rows.length) return res.status(404).json({ error: 'Customer not found or access denied' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Customer name already exists in this group' });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/customers/:id – Delete customer
router.delete('/customers/:id', verifySupervisor, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'ADMIN') {
      query = `DELETE FROM customers WHERE id = $1 RETURNING *`;
      params = [req.params.id];
    } else {
      let gid = req.user.group_id;
      if (!gid) {
        const u = await pool.query('SELECT group_id FROM users WHERE id=$1', [req.user.id]);
        gid = u.rows[0]?.group_id;
      }
      query = `DELETE FROM customers WHERE id = $1 AND group_id = $2 RETURNING *`;
      params = [req.params.id, gid];
    }
    const { rows } = await pool.query(query, params);
    if (!rows.length) return res.status(404).json({ error: 'Customer not found or access denied' });
    res.json({ message: 'Customer deleted', customer: rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete customer: they already have recorded orders or payments in the system.' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orders – Submit a new order
router.post('/orders', verifySupervisor, async (req, res) => {
  const { customer_id, daily_farm_id, farm_id, boxes, weight_kg, date, notes } = req.body;
  const effectiveFarmId = daily_farm_id || farm_id;

  if (!customer_id || !weight_kg) {
    return res.status(400).json({ error: 'customer_id and weight_kg are required' });
  }
  if (!effectiveFarmId) {
    return res.status(400).json({ error: 'Please select a Daily Farm for this order' });
  }

  const orderDate = date || new Date().toISOString().split('T')[0];
  const orderBoxes = parseInt(boxes, 10) || 1;
  const orderWeight = parseFloat(weight_kg);

  try {
    // 1. Check paper rate exists for date
    const { rows: rateRows } = await pool.query(
      'SELECT * FROM daily_rates WHERE date=$1', [orderDate]
    );
    if (!rateRows.length) {
      return res.status(400).json({ error: `Paper Rate has not been set for ${orderDate}. Please set the rate first.` });
    }
    const paperRate = parseFloat(rateRows[0].paper_rate);

    // 2. Check farm exists
    const farmCheck = await pool.query('SELECT * FROM daily_farms WHERE id=$1', [effectiveFarmId]);
    if (!farmCheck.rows.length) {
      return res.status(404).json({ error: 'Selected daily farm was not found. Please refresh.' });
    }

    // 3. Get customer minus rate and group (verify access)
    let custQuery, custParams;
    if (req.user.role === 'ADMIN') {
      custQuery = 'SELECT * FROM customers WHERE id=$1';
      custParams = [customer_id];
    } else {
      let gid = req.user.group_id;
      if (!gid) {
        const u = await pool.query('SELECT group_id FROM users WHERE id=$1', [req.user.id]);
        gid = u.rows[0]?.group_id;
      }
      custQuery = 'SELECT * FROM customers WHERE id=$1 AND group_id=$2';
      custParams = [customer_id, gid];
    }
    const { rows: custRows } = await pool.query(custQuery, custParams);
    if (!custRows.length) {
      return res.status(404).json({ error: 'Customer not found or access denied' });
    }
    const minusRate = parseFloat(custRows[0].minus_rate) || 0;
    const customerGroupId = custRows[0].group_id;

    // 4. Insert order (voucher_no from sequence, final_rate & total_amount calculated by DB)
    const { rows } = await pool.query(
      `INSERT INTO orders (date, customer_id, group_id, supervisor_id, daily_farm_id, boxes, weight_kg, applied_paper_rate, applied_minus_rate, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [orderDate, customer_id, customerGroupId, req.user.id, effectiveFarmId, orderBoxes, orderWeight, paperRate, minusRate, notes || null]
    );

    // Join details to return full order
    const fullOrder = await pool.query(
      `SELECT o.*, c.name AS customer_name, df.farm_name, df.vehicle_no, g.name AS group_name, u.name AS supervisor_name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN daily_farms df ON df.id = o.daily_farm_id
       JOIN groups g ON g.id = o.group_id
       JOIN users u ON u.id = o.supervisor_id
       WHERE o.id = $1`,
      [rows[0].id]
    );

    res.status(201).json(fullOrder.rows[0]);
  } catch (err) {
    console.error('[ORDER POST ERROR]', err);
    res.status(500).json({ error: 'Failed to record order' });
  }
});

// GET /api/orders – Orders list (filtered by date, group, or supervisor)
router.get('/orders', verifySupervisor, async (req, res) => {
  const { date } = req.query;
  const orderDate = date || new Date().toISOString().split('T')[0];
  try {
    let query, params;
    if (req.user.role === 'ADMIN') {
      if (req.query.group_id) {
        query = `SELECT o.*, c.name AS customer_name, c.group_id, g.name AS group_name, df.farm_name, df.vehicle_no, u.name AS supervisor_name
                 FROM orders o
                 JOIN customers c ON c.id=o.customer_id
                 LEFT JOIN groups g ON g.id=o.group_id
                 LEFT JOIN daily_farms df ON df.id=o.daily_farm_id
                 JOIN users u ON u.id=o.supervisor_id
                 WHERE o.date=$1 AND o.group_id=$2 
                 ORDER BY o.voucher_no DESC, o.created_at DESC`;
        params = [orderDate, req.query.group_id];
      } else {
        query = `SELECT o.*, c.name AS customer_name, c.group_id, g.name AS group_name, df.farm_name, df.vehicle_no, u.name AS supervisor_name
                 FROM orders o
                 JOIN customers c ON c.id=o.customer_id
                 LEFT JOIN groups g ON g.id=o.group_id
                 LEFT JOIN daily_farms df ON df.id=o.daily_farm_id
                 JOIN users u ON u.id=o.supervisor_id
                 WHERE o.date=$1 
                 ORDER BY o.voucher_no DESC, o.created_at DESC`;
        params = [orderDate];
      }
    } else {
      let gid = req.user.group_id;
      if (!gid) {
        const u = await pool.query('SELECT group_id FROM users WHERE id=$1', [req.user.id]);
        gid = u.rows[0]?.group_id;
      }
      query = `SELECT o.*, c.name AS customer_name, c.group_id, g.name AS group_name, df.farm_name, df.vehicle_no
               FROM orders o
               JOIN customers c ON c.id=o.customer_id
               LEFT JOIN groups g ON g.id=o.group_id
               LEFT JOIN daily_farms df ON df.id=o.daily_farm_id
               WHERE o.date=$1 AND o.group_id=$2
               ORDER BY o.voucher_no DESC, o.created_at DESC`;
      params = [orderDate, gid];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[ORDERS GET ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/orders/:id – Update an existing order (boxes, weight, daily_farm_id, notes)
router.put('/orders/:id', verifySupervisor, async (req, res) => {
  const { boxes, weight_kg, daily_farm_id, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE orders SET
         boxes = COALESCE($1, boxes),
         weight_kg = COALESCE($2, weight_kg),
         daily_farm_id = COALESCE($3, daily_farm_id),
         notes = COALESCE($4, notes)
       WHERE id = $5
       RETURNING *`,
      [
        boxes !== undefined ? parseInt(boxes, 10) : null,
        weight_kg !== undefined ? parseFloat(weight_kg) : null,
        daily_farm_id || null,
        notes !== undefined ? notes : null,
        req.params.id
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[ORDER PUT ERROR]', err);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// DELETE /api/orders/:id – Cancel / Delete an order
router.delete('/orders/:id', verifySupervisor, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order deleted successfully', order: rows[0] });
  } catch (err) {
    console.error('[ORDER DELETE ERROR]', err);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

module.exports = router;