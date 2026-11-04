const express = require('express');
const pool = require('../db');
const { verifySupervisor } = require('../middleware/auth');
const { isValidDateString, parsePositiveFloat, parsePositiveInt, sanitizeString, isValidUUID } = require('../middleware/security');

const router = express.Router();

// GET /api/daily-farms – Get all procurement farms for a given date with live dispatch stats
router.get('/', verifySupervisor, async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  if (!isValidDateString(targetDate)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' });
  }

  const isAdmin = req.user && req.user.role === 'ADMIN';

  try {
    const { rows } = await pool.query(
      `SELECT 
         df.id,
         df.date,
         df.farm_name,
         df.vehicle_no,
         df.total_weight_kg,
         df.total_boxes,
         df.added_by_id,
         df.notes,
         df.created_at,
         df.rate_per_kg,
         u.name AS added_by_name,
         u.role AS added_by_role,
         COALESCE(SUM(o.weight_kg), 0) AS total_dispatched_kg,
         COALESCE(SUM(o.boxes), 0)     AS total_dispatched_boxes,
         COALESCE(SUM(o.total_amount), 0) AS total_dispatched_revenue,
         (df.total_weight_kg - COALESCE(SUM(o.weight_kg), 0)) AS remaining_kg,
         (df.total_boxes - COALESCE(SUM(o.boxes), 0))         AS remaining_boxes,
         COUNT(o.id)                   AS orders_count
       FROM daily_farms df
       LEFT JOIN users u ON u.id = df.added_by_id
       LEFT JOIN orders o ON o.daily_farm_id = df.id
       WHERE df.date = $1
       GROUP BY df.id, u.name, u.role
       ORDER BY df.created_at ASC`,
      [targetDate]
    );

    const sanitized = rows.map(r => {
      const weight = parseFloat(r.total_weight_kg) || 0;
      const rate = parseFloat(r.rate_per_kg) || 0;
      const totalCost = weight * rate;
      const revenue = parseFloat(r.total_dispatched_revenue) || 0;
      const grossMargin = revenue - totalCost;

      if (!isAdmin) {
        // Strip private admin financial fields for supervisors
        const { rate_per_kg, ...supervisorSafe } = r;
        return {
          ...supervisorSafe,
          rate_per_kg: null,
          total_procurement_cost: null,
          total_dispatched_revenue: null,
          gross_margin: null
        };
      }

      return {
        ...r,
        rate_per_kg: rate,
        total_procurement_cost: totalCost,
        total_dispatched_revenue: revenue,
        gross_margin: grossMargin
      };
    });

    res.json(sanitized);
  } catch (err) {
    console.error('[DAILY FARMS GET ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to fetch daily farms' });
  }
});

// POST /api/daily-farms – Add daily farm (Admin, Supervisor 1, Supervisor 2)
router.post('/', verifySupervisor, async (req, res) => {
  const rawName = sanitizeString(req.body.farm_name, 100);
  const rawVehicle = sanitizeString(req.body.vehicle_no, 50);

  if (!rawName) {
    return res.status(400).json({ error: 'Farm name is required' });
  }

  const targetDate = req.body.date || new Date().toISOString().split('T')[0];
  if (!isValidDateString(targetDate)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' });
  }

  const weight = parsePositiveFloat(req.body.total_weight_kg, 0);
  const boxes = parsePositiveInt(req.body.total_boxes, 0);

  const isAdmin = req.user && req.user.role === 'ADMIN';
  // Only admin can set purchase rate; supervisors default to 0
  const farmRate = isAdmin && req.body.rate_per_kg !== undefined ? parsePositiveFloat(req.body.rate_per_kg, 0) : 0;

  try {
    // Check if farm already exists for this date to provide an explicit, clear error
    const existing = await pool.query(
      `SELECT df.*, u.name as added_by_name 
       FROM daily_farms df 
       LEFT JOIN users u ON u.id = df.added_by_id
       WHERE df.date = $1 AND LOWER(TRIM(df.farm_name)) = LOWER(TRIM($2))`,
      [targetDate, rawName]
    );

    if (existing.rows.length) {
      const addedBy = existing.rows[0].added_by_name || 'Another user';
      const vNo = existing.rows[0].vehicle_no ? ` (${existing.rows[0].vehicle_no})` : '';
      return res.status(409).json({
        error: `Farm "${rawName}" is already added for ${targetDate} by ${addedBy}${vNo}. Please edit the existing entry instead.`
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO daily_farms (date, farm_name, vehicle_no, total_weight_kg, total_boxes, rate_per_kg, added_by_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [targetDate, rawName, rawVehicle || null, weight, boxes, farmRate, req.user.id, sanitizeString(req.body.notes, 500) || null]
    );

    const raw = rows[0];
    const totalCost = weight * farmRate;
    const result = {
      ...raw,
      rate_per_kg: isAdmin ? farmRate : null,
      total_procurement_cost: isAdmin ? totalCost : null,
      added_by_name: req.user.name,
      added_by_role: req.user.role,
      total_dispatched_kg: 0,
      total_dispatched_boxes: 0,
      total_dispatched_revenue: isAdmin ? 0 : null,
      gross_margin: isAdmin ? (0 - totalCost) : null,
      remaining_kg: weight,
      remaining_boxes: boxes,
      orders_count: 0
    };

    res.status(201).json(result);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `Farm "${rawName}" already exists for ${targetDate}.` });
    }
    console.error('[DAILY FARMS POST ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to add daily farm' });
  }
});

// PUT /api/daily-farms/:id – Update farm info
router.put('/:id', verifySupervisor, async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ error: 'Invalid daily farm ID format' });

  const rawName = req.body.farm_name ? sanitizeString(req.body.farm_name, 100) : null;
  const rawVehicle = req.body.vehicle_no !== undefined ? sanitizeString(req.body.vehicle_no, 50) : null;
  const weight = req.body.total_weight_kg !== undefined ? parsePositiveFloat(req.body.total_weight_kg, 0) : null;
  const boxes = req.body.total_boxes !== undefined ? parsePositiveInt(req.body.total_boxes, 0) : null;
  const notes = req.body.notes !== undefined ? sanitizeString(req.body.notes, 500) : null;

  const isAdmin = req.user && req.user.role === 'ADMIN';
  const parsedRate = req.body.rate_per_kg !== undefined ? parsePositiveFloat(req.body.rate_per_kg, 0) : null;

  try {
    const { rows } = await pool.query(
      `UPDATE daily_farms SET
         farm_name = COALESCE($1, farm_name),
         vehicle_no = COALESCE($2, vehicle_no),
         total_weight_kg = COALESCE($3, total_weight_kg),
         total_boxes = COALESCE($4, total_boxes),
         notes = COALESCE($5, notes),
         rate_per_kg = CASE WHEN $7::boolean THEN COALESCE($6, rate_per_kg) ELSE rate_per_kg END
       WHERE id = $8
       RETURNING *`,
      [rawName, rawVehicle, weight, boxes, notes, parsedRate, isAdmin, id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Daily farm not found' });
    }

    const row = rows[0];
    const w = parseFloat(row.total_weight_kg) || 0;
    const r = parseFloat(row.rate_per_kg) || 0;
    const result = {
      ...row,
      rate_per_kg: isAdmin ? r : null,
      total_procurement_cost: isAdmin ? (w * r) : null
    };

    res.json(result);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A farm with this name already exists on this date.' });
    }
    console.error('[DAILY FARMS PUT ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to update daily farm' });
  }
});

// DELETE /api/daily-farms/:id – Delete farm (with safety check on dispatched orders)
router.delete('/:id', verifySupervisor, async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ error: 'Invalid daily farm ID format' });

  try {
    // Check if any orders have been placed using this farm
    const orders = await pool.query('SELECT COUNT(*) FROM orders WHERE daily_farm_id = $1', [id]);
    const count = parseInt(orders.rows[0].count, 10);
    if (count > 0) {
      return res.status(400).json({
        error: `Cannot delete this farm: ${count} customer order(s) have already been dispatched from it today. Cancel those orders first if needed.`
      });
    }

    const { rows } = await pool.query('DELETE FROM daily_farms WHERE id = $1 RETURNING *', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Daily farm not found' });
    }

    res.json({ message: 'Daily farm deleted successfully', farm: rows[0] });
  } catch (err) {
    console.error('[DAILY FARMS DELETE ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to delete daily farm' });
  }
});

module.exports = router;
