const express = require('express');
const pool = require('../db');
const { verifySupervisor } = require('../middleware/auth');
const { isValidDateString, parsePositiveFloat, parsePositiveInt, sanitizeString, isValidUUID } = require('../middleware/security');

const router = express.Router();

// GET /api/daily-farms – Get all procurement farms for a given date with live dispatch & weight loss stats
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
         df.weight_loss_kg,
         df.added_by_id,
         df.notes,
         df.created_at,
         df.rate_per_kg,
         u.name AS added_by_name,
         u.role AS added_by_role,
         COALESCE(SUM(o.weight_kg), 0) AS total_dispatched_kg,
         COALESCE(SUM(o.boxes), 0)     AS total_dispatched_boxes,
         COALESCE(SUM(o.total_amount), 0) AS total_dispatched_revenue,
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
      const intakeWeight = parseFloat(r.total_weight_kg) || 0;
      const intakeBoxes = parseInt(r.total_boxes, 10) || 0;
      const dispWeight = parseFloat(r.total_dispatched_kg) || 0;
      const dispBoxes = parseInt(r.total_dispatched_boxes, 10) || 0;
      const remBoxes = Math.max(0, intakeBoxes - dispBoxes);
      const manualLoss = parseFloat(r.weight_loss_kg) || 0;

      // When all boxes are dispatched, auto-calculate shrinkage if not manually set
      let effectiveLoss = manualLoss;
      if (manualLoss > 0) {
        effectiveLoss = manualLoss;
      } else if (intakeBoxes > 0 && dispBoxes >= intakeBoxes && dispWeight > 0) {
        effectiveLoss = Math.max(0, intakeWeight - dispWeight);
      }

      const weightLossPct = intakeWeight > 0 ? parseFloat(((effectiveLoss / intakeWeight) * 100).toFixed(2)) : 0;
      const avgIntakeBoxKg = intakeBoxes > 0 ? parseFloat((intakeWeight / intakeBoxes).toFixed(2)) : 0;
      const avgDispBoxKg = dispBoxes > 0 ? parseFloat((dispWeight / dispBoxes).toFixed(2)) : 0;
      const avgLossPerBoxKg = intakeBoxes > 0 && effectiveLoss > 0 ? parseFloat((effectiveLoss / intakeBoxes).toFixed(2)) : 0;

      // Real unsold stock remaining (if all boxes are delivered, remaining stock is 0, difference is loss)
      const realRemainingKg = remBoxes > 0 ? Math.max(0, intakeWeight - dispWeight - effectiveLoss) : 0;

      // Admin Financials
      const rate = parseFloat(r.rate_per_kg) || 0;
      const totalCost = intakeWeight * rate;
      const revenue = parseFloat(r.total_dispatched_revenue) || 0;
      const grossMargin = revenue - totalCost;
      const effectiveCostPerKg = (isAdmin && dispWeight > 0 && totalCost > 0) ? parseFloat((totalCost / dispWeight).toFixed(2)) : rate;

      const baseResult = {
        ...r,
        total_weight_kg: intakeWeight,
        total_boxes: intakeBoxes,
        total_dispatched_kg: dispWeight,
        total_dispatched_boxes: dispBoxes,
        remaining_boxes: remBoxes,
        remaining_kg: realRemainingKg,
        weight_loss_kg: effectiveLoss,
        weight_loss_pct: weightLossPct,
        is_manual_loss: manualLoss > 0,
        avg_intake_box_kg: avgIntakeBoxKg,
        avg_dispatched_box_kg: avgDispBoxKg,
        avg_loss_per_box_kg: avgLossPerBoxKg,
        is_trip_completed: intakeBoxes > 0 && dispBoxes >= intakeBoxes
      };

      if (!isAdmin) {
        // Strip private admin financial fields for supervisors
        const { rate_per_kg, total_dispatched_revenue, ...supervisorSafe } = baseResult;
        return {
          ...supervisorSafe,
          rate_per_kg: null,
          total_procurement_cost: null,
          total_dispatched_revenue: null,
          gross_margin: null,
          effective_cost_per_kg: null
        };
      }

      return {
        ...baseResult,
        rate_per_kg: rate,
        total_procurement_cost: totalCost,
        total_dispatched_revenue: revenue,
        gross_margin: grossMargin,
        effective_cost_per_kg: effectiveCostPerKg
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
  const weightLoss = req.body.weight_loss_kg !== undefined ? parsePositiveFloat(req.body.weight_loss_kg, 0) : 0;

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
      `INSERT INTO daily_farms (date, farm_name, vehicle_no, total_weight_kg, total_boxes, rate_per_kg, weight_loss_kg, added_by_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [targetDate, rawName, rawVehicle || null, weight, boxes, farmRate, weightLoss, req.user.id, sanitizeString(req.body.notes, 500) || null]
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
      effective_cost_per_kg: isAdmin ? farmRate : null,
      remaining_kg: Math.max(0, weight - weightLoss),
      remaining_boxes: boxes,
      weight_loss_kg: weightLoss,
      weight_loss_pct: weight > 0 ? (weightLoss / weight) * 100 : 0,
      avg_intake_box_kg: boxes > 0 ? (weight / boxes) : 0,
      avg_dispatched_box_kg: 0,
      avg_loss_per_box_kg: (boxes > 0 && weightLoss > 0) ? (weightLoss / boxes) : 0,
      is_trip_completed: false,
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

// PUT /api/daily-farms/:id – Update farm info (including weight_loss_kg)
router.put('/:id', verifySupervisor, async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ error: 'Invalid daily farm ID format' });

  const rawName = req.body.farm_name ? sanitizeString(req.body.farm_name, 100) : null;
  const rawVehicle = req.body.vehicle_no !== undefined ? sanitizeString(req.body.vehicle_no, 50) : null;
  const weight = req.body.total_weight_kg !== undefined ? parsePositiveFloat(req.body.total_weight_kg, 0) : null;
  const boxes = req.body.total_boxes !== undefined ? parsePositiveInt(req.body.total_boxes, 0) : null;
  const weightLoss = req.body.weight_loss_kg !== undefined ? parsePositiveFloat(req.body.weight_loss_kg, 0) : null;
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
         rate_per_kg = CASE WHEN $7::boolean THEN COALESCE($6, rate_per_kg) ELSE rate_per_kg END,
         weight_loss_kg = COALESCE($8, weight_loss_kg)
       WHERE id = $9
       RETURNING *`,
      [rawName, rawVehicle, weight, boxes, notes, parsedRate, isAdmin, weightLoss, id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Daily farm not found' });
    }

    const row = rows[0];
    const w = parseFloat(row.total_weight_kg) || 0;
    const r = parseFloat(row.rate_per_kg) || 0;
    const wl = parseFloat(row.weight_loss_kg) || 0;
    const result = {
      ...row,
      weight_loss_kg: wl,
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
