const express = require('express');
const pool = require('../db');
const { verifySupervisor } = require('../middleware/auth');
const { isValidDateString, isValidUUID } = require('../middleware/security');

const router = express.Router();

// GET /api/sheets/daily – Get daily distribution sheet grouped by farm
// Query params: date (YYYY-MM-DD), group_id (optional for admin)
router.get('/daily', verifySupervisor, async (req, res) => {
  const { date, group_id } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  if (!isValidDateString(targetDate)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' });
  }

  try {
    // Determine effective group
    let targetGroupId = null;
    let groupName = 'All Groups';

    if (req.user.role === 'ADMIN') {
      if (group_id && isValidUUID(group_id)) {
        targetGroupId = group_id;
        const g = await pool.query('SELECT name FROM groups WHERE id = $1', [group_id]);
        if (g.rows.length) groupName = g.rows[0].name;
      }
    } else {
      // Supervisor can only view their own group
      targetGroupId = req.user.group_id;
      if (!targetGroupId) {
        const u = await pool.query('SELECT group_id FROM users WHERE id = $1', [req.user.id]);
        targetGroupId = u.rows[0]?.group_id;
      }
      if (targetGroupId) {
        const g = await pool.query('SELECT name FROM groups WHERE id = $1', [targetGroupId]);
        if (g.rows.length) groupName = g.rows[0].name;
      }
    }

    // Get today's paper rate
    const rateResult = await pool.query('SELECT paper_rate FROM daily_rates WHERE date = $1', [targetDate]);
    const paperRate = rateResult.rows.length ? parseFloat(rateResult.rows[0].paper_rate) : null;

    // Fetch all orders for this date and group, joined with daily_farms, customers, and users
    let ordersQuery = `
      SELECT 
        o.id,
        o.voucher_no,
        o.date,
        o.boxes,
        o.weight_kg,
        o.applied_paper_rate,
        o.applied_minus_rate,
        o.final_rate,
        o.total_amount,
        o.notes,
        o.created_at,
        c.id AS customer_id,
        c.name AS customer_name,
        df.id AS farm_id,
        df.farm_name,
        df.vehicle_no,
        df.total_weight_kg AS farm_intake_kg,
        df.total_boxes AS farm_intake_boxes,
        df.weight_loss_kg,
        g.name AS group_name,
        u.name AS supervisor_name
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN daily_farms df ON df.id = o.daily_farm_id
      JOIN groups g ON g.id = o.group_id
      JOIN users u ON u.id = o.supervisor_id
      WHERE o.date = $1
    `;
    const params = [targetDate];

    if (targetGroupId) {
      params.push(targetGroupId);
      ordersQuery += ` AND o.group_id = $${params.length}`;
    }

    ordersQuery += ` ORDER BY df.farm_name ASC, o.voucher_no ASC, o.created_at ASC`;

    const { rows: orderRows } = await pool.query(ordersQuery, params);

    // Group orders farm-wise
    const farmMap = new Map();

    for (const order of orderRows) {
      const fid = order.farm_id;
      if (!farmMap.has(fid)) {
        farmMap.set(fid, {
          farm_id: fid,
          farm_name: order.farm_name,
          vehicle_no: order.vehicle_no || '',
          intake_weight_kg: parseFloat(order.farm_intake_kg) || 0,
          intake_boxes: parseInt(order.farm_intake_boxes, 10) || 0,
          manual_loss_kg: parseFloat(order.weight_loss_kg) || 0,
          orders: [],
          subtotal: {
            boxes: 0,
            weight_kg: 0,
            total_amount: 0,
            avg_rate: 0
          }
        });
      }

      const farmGroup = farmMap.get(fid);
      const boxes = parseInt(order.boxes, 10) || 0;
      const weight = parseFloat(order.weight_kg) || 0;
      const amount = parseFloat(order.total_amount) || 0;
      const rate = parseFloat(order.final_rate) || 0;

      farmGroup.orders.push({
        index: farmGroup.orders.length + 1,
        order_id: order.id,
        voucher_no: order.voucher_no,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        boxes,
        weight_kg: weight,
        rate,
        total_amount: amount,
        notes: order.notes
      });

      farmGroup.subtotal.boxes += boxes;
      farmGroup.subtotal.weight_kg += weight;
      farmGroup.subtotal.total_amount += amount;
    }

    // Compute average rate, reconciliation, and weight loss for each farm
    const farms = Array.from(farmMap.values()).map(f => {
      f.subtotal.avg_rate = f.subtotal.weight_kg > 0 ? (f.subtotal.total_amount / f.subtotal.weight_kg) : 0;

      const intakeWeight = f.intake_weight_kg;
      const intakeBoxes = f.intake_boxes;
      const dispWeight = f.subtotal.weight_kg;
      const dispBoxes = f.subtotal.boxes;
      const remBoxes = Math.max(0, intakeBoxes - dispBoxes);

      let effectiveLoss = f.manual_loss_kg;
      if (effectiveLoss <= 0 && intakeBoxes > 0 && dispBoxes >= intakeBoxes && dispWeight > 0) {
        effectiveLoss = Math.max(0, intakeWeight - dispWeight);
      }

      const lossPct = intakeWeight > 0 ? parseFloat(((effectiveLoss / intakeWeight) * 100).toFixed(2)) : 0;
      const avgIntakeBox = intakeBoxes > 0 ? parseFloat((intakeWeight / intakeBoxes).toFixed(2)) : 0;
      const avgDispBox = dispBoxes > 0 ? parseFloat((dispWeight / dispBoxes).toFixed(2)) : 0;
      const lossPerBox = intakeBoxes > 0 && effectiveLoss > 0 ? parseFloat((effectiveLoss / intakeBoxes).toFixed(2)) : 0;

      f.reconciliation = {
        intake_weight_kg: intakeWeight,
        intake_boxes: intakeBoxes,
        dispatched_weight_kg: dispWeight,
        dispatched_boxes: dispBoxes,
        remaining_boxes: remBoxes,
        weight_loss_kg: effectiveLoss,
        weight_loss_pct: lossPct,
        avg_intake_box_kg: avgIntakeBox,
        avg_dispatched_box_kg: avgDispBox,
        avg_loss_per_box_kg: lossPerBox,
        is_trip_completed: intakeBoxes > 0 && dispBoxes >= intakeBoxes
      };

      return f;
    });

    const grandTotal = {
      boxes: 0,
      weight_kg: 0,
      total_amount: 0,
      avg_rate: 0,
      total_intake_weight_kg: 0,
      total_intake_boxes: 0,
      total_weight_loss_kg: 0,
      overall_loss_pct: 0
    };

    farms.forEach(f => {
      grandTotal.boxes += f.subtotal.boxes;
      grandTotal.weight_kg += f.subtotal.weight_kg;
      grandTotal.total_amount += f.subtotal.total_amount;
      grandTotal.total_intake_weight_kg += f.intake_weight_kg;
      grandTotal.total_intake_boxes += f.intake_boxes;
      grandTotal.total_weight_loss_kg += (f.reconciliation ? f.reconciliation.weight_loss_kg : 0);
    });

    grandTotal.avg_rate = grandTotal.weight_kg > 0 ? parseFloat((grandTotal.total_amount / grandTotal.weight_kg).toFixed(2)) : 0;
    grandTotal.overall_loss_pct = grandTotal.total_intake_weight_kg > 0
      ? parseFloat(((grandTotal.total_weight_loss_kg / grandTotal.total_intake_weight_kg) * 100).toFixed(2))
      : 0;

    res.json({
      date: targetDate,
      group_id: targetGroupId,
      group_name: groupName,
      paper_rate: paperRate,
      generated_by: req.user.name,
      farms,
      grand_total: grandTotal,
      total_orders_count: orderRows.length
    });
  } catch (err) {
    console.error('[DAILY SHEET GET ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to generate daily sheet' });
  }
});

module.exports = router;
