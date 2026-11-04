const express = require('express');
const pool = require('../db');
const { verifySupervisor } = require('../middleware/auth');
const { isValidDateString, parsePositiveFloat, parsePositiveInt, sanitizeString, isValidUUID } = require('../middleware/security');

const router = express.Router();

// Helper: check customer access and resolve group
async function checkCustomerAccess(customerId, user) {
  if (!isValidUUID(customerId)) return null;

  if (user.role === 'ADMIN') {
    const res = await pool.query(
      `SELECT c.*, g.name AS group_name 
       FROM customers c 
       LEFT JOIN groups g ON g.id = c.group_id 
       WHERE c.id = $1`,
      [customerId]
    );
    return res.rows[0] || null;
  }

  let gid = user.group_id;
  if (!gid) {
    const u = await pool.query('SELECT group_id FROM users WHERE id = $1', [user.id]);
    gid = u.rows[0]?.group_id;
  }
  if (!gid) return null;

  const res = await pool.query(
    `SELECT c.*, g.name AS group_name 
     FROM customers c 
     LEFT JOIN groups g ON g.id = c.group_id 
     WHERE c.id = $1 AND c.group_id = $2`,
    [customerId, gid]
  );
  return res.rows[0] || null;
}

// GET /api/customers/:id/ledger – Complete Tally-style customer ledger account
router.get('/customers/:id/ledger', verifySupervisor, async (req, res) => {
  const { id } = req.params;
  const { from, to } = req.query;

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid customer ID format' });
  }

  if (from && !isValidDateString(from)) {
    return res.status(400).json({ error: 'Invalid "from" date format. Expected YYYY-MM-DD.' });
  }
  if (to && !isValidDateString(to)) {
    return res.status(400).json({ error: 'Invalid "to" date format. Expected YYYY-MM-DD.' });
  }

  try {
    const customer = await checkCustomerAccess(id, req.user);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found or access denied' });
    }

    const baseOpBal = parseFloat(customer.opening_balance) || 0;
    // Sign convention: positive = Dr (Receivable), negative = Cr (Payable / Advance)
    let runningBalance = customer.opening_balance_type === 'CR' ? -baseOpBal : baseOpBal;

    // Parallel fetch for prior transactions if 'from' date is given
    if (from) {
      const [priorDebits, priorPayments, priorCredits] = await Promise.all([
        pool.query(
          'SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE customer_id = $1 AND date < $2',
          [id, from]
        ),
        pool.query(
          'SELECT COALESCE(SUM(amount_paid), 0) AS total FROM customer_payments WHERE customer_id = $1 AND payment_date < $2',
          [id, from]
        ),
        pool.query(
          'SELECT COALESCE(SUM(amount), 0) AS total FROM customer_credit_notes WHERE customer_id = $1 AND date < $2',
          [id, from]
        ),
      ]);

      const d = parseFloat(priorDebits.rows[0].total) || 0;
      const p = parseFloat(priorPayments.rows[0].total) || 0;
      const c = parseFloat(priorCredits.rows[0].total) || 0;
      runningBalance += (d - p - c);
    }

    const periodOpeningBalance = runningBalance;

    // Build filter parameters for period
    let ordersFilter = 'WHERE o.customer_id = $1';
    let paymentsFilter = 'WHERE customer_id = $1';
    let creditsFilter = 'WHERE customer_id = $1';
    const params = [id];

    if (from && to) {
      params.push(from, to);
      ordersFilter += ' AND o.date BETWEEN $2 AND $3';
      paymentsFilter += ' AND payment_date BETWEEN $2 AND $3';
      creditsFilter += ' AND date BETWEEN $2 AND $3';
    } else if (from) {
      params.push(from);
      ordersFilter += ' AND o.date >= $2';
      paymentsFilter += ' AND payment_date >= $2';
      creditsFilter += ' AND date >= $2';
    }

    // Parallel fetch for all transaction types
    const [ordersRes, paymentsRes, creditNotesRes] = await Promise.all([
      pool.query(
        `SELECT 
           o.id,
           o.voucher_no,
           o.date,
           'Sales' AS vch_type,
           'Live Birds' AS particulars,
           o.boxes,
           o.weight_kg,
           o.final_rate AS rate,
           o.total_amount AS debit,
           0.00 AS credit,
           COALESCE(df.farm_name, '') AS farm_name,
           COALESCE(df.vehicle_no, '') AS vehicle_no,
           o.notes,
           1 AS sort_order,
           o.created_at
         FROM orders o
         LEFT JOIN daily_farms df ON df.id = o.daily_farm_id
         ${ordersFilter}`,
        params
      ),
      pool.query(
        `SELECT 
           id,
           receipt_no AS voucher_no,
           payment_date AS date,
           'Receipt' AS vch_type,
           CONCAT('Cash / ', payment_mode) AS particulars,
           0 AS boxes,
           0.00 AS weight_kg,
           0.00 AS rate,
           0.00 AS debit,
           amount_paid AS credit,
           '' AS farm_name,
           '' AS vehicle_no,
           notes,
           2 AS sort_order,
           created_at
         FROM customer_payments
         ${paymentsFilter}`,
        params
      ),
      pool.query(
        `SELECT 
           id,
           credit_no AS voucher_no,
           date,
           'Credit Note' AS vch_type,
           COALESCE(reason, 'Sales Return / Rate Diff') AS particulars,
           boxes,
           weight_kg,
           rate_per_kg AS rate,
           0.00 AS debit,
           amount AS credit,
           '' AS farm_name,
           '' AS vehicle_no,
           reason AS notes,
           3 AS sort_order,
           created_at
         FROM customer_credit_notes
         ${creditsFilter}`,
        params
      ),
    ]);

    // Merge and sort chronologically
    const allTransactions = [
      ...ordersRes.rows,
      ...paymentsRes.rows,
      ...creditNotesRes.rows,
    ].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (da !== db) return da - db;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    let totalDebits = 0;
    let totalCredits = 0;
    let totalKgs = 0;
    let totalBoxes = 0;

    const ledgerRows = allTransactions.map(tx => {
      const debit = parseFloat(tx.debit) || 0;
      const credit = parseFloat(tx.credit) || 0;
      const weight = parseFloat(tx.weight_kg) || 0;
      const boxes = parseInt(tx.boxes, 10) || 0;

      totalDebits += debit;
      totalCredits += credit;
      totalKgs += weight;
      totalBoxes += boxes;

      runningBalance += (debit - credit);

      return {
        id: tx.id,
        voucher_no: tx.voucher_no,
        date: tx.date,
        vch_type: tx.vch_type,
        particulars: tx.particulars,
        farm_name: tx.farm_name,
        vehicle_no: tx.vehicle_no,
        boxes,
        weight_kg: weight,
        rate: parseFloat(tx.rate) || 0,
        debit,
        credit,
        running_balance: Math.abs(runningBalance),
        balance_type: runningBalance >= 0 ? 'Dr' : 'Cr',
        notes: tx.notes
      };
    });

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        group_id: customer.group_id,
        group_name: customer.group_name,
        minus_rate: parseFloat(customer.minus_rate) || 0,
        base_opening_balance: baseOpBal,
        base_opening_balance_type: customer.opening_balance_type
      },
      period: { from: from || null, to: to || null },
      opening_balance: {
        amount: Math.abs(periodOpeningBalance),
        type: periodOpeningBalance >= 0 ? 'Dr' : 'Cr'
      },
      transactions: ledgerRows,
      summary: {
        total_boxes: totalBoxes,
        total_weight_kg: totalKgs,
        total_debits: totalDebits,
        total_credits: totalCredits,
        closing_balance: Math.abs(runningBalance),
        closing_balance_type: runningBalance >= 0 ? 'Dr' : 'Cr'
      }
    });
  } catch (err) {
    console.error('[LEDGER ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to generate customer ledger' });
  }
});

// POST /api/payments – Record customer cash / bank receipt
router.post('/payments', verifySupervisor, async (req, res) => {
  const { customer_id, payment_date, amount_paid, payment_mode, notes } = req.body;

  if (!customer_id || !isValidUUID(customer_id)) {
    return res.status(400).json({ error: 'Valid customer_id is required' });
  }

  const amount = parsePositiveFloat(amount_paid, 0);
  if (amount <= 0) {
    return res.status(400).json({ error: 'amount_paid must be a positive number greater than 0' });
  }

  const date = payment_date || new Date().toISOString().split('T')[0];
  if (!isValidDateString(date)) {
    return res.status(400).json({ error: 'Invalid payment_date. Expected format YYYY-MM-DD.' });
  }

  const mode = ['CASH', 'UPI', 'NEFT', 'CHEQUE'].includes(payment_mode) ? payment_mode : 'CASH';

  try {
    const customer = await checkCustomerAccess(customer_id, req.user);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found or access denied' });
    }

    const { rows } = await pool.query(
      `INSERT INTO customer_payments (customer_id, group_id, payment_date, amount_paid, payment_mode, notes, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [customer_id, customer.group_id, date, amount, mode, sanitizeString(notes, 500) || null, req.user.id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[PAYMENT POST ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to record payment' });
  }
});

// DELETE /api/payments/:id – Delete a payment receipt with IDOR check
router.delete('/payments/:id', verifySupervisor, async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ error: 'Invalid payment ID format' });

  try {
    // Check permission
    const existing = await pool.query('SELECT * FROM customer_payments WHERE id = $1', [id]);
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = existing.rows[0];
    if (req.user.role !== 'ADMIN') {
      let gid = req.user.group_id;
      if (!gid) {
        const u = await pool.query('SELECT group_id FROM users WHERE id = $1', [req.user.id]);
        gid = u.rows[0]?.group_id;
      }
      if (payment.group_id !== gid) {
        return res.status(403).json({ error: 'Access denied: cannot delete payment from another group' });
      }
    }

    const { rows } = await pool.query('DELETE FROM customer_payments WHERE id = $1 RETURNING *', [id]);
    res.json({ message: 'Payment deleted', payment: rows[0] });
  } catch (err) {
    console.error('[PAYMENT DELETE ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to delete payment' });
  }
});

// POST /api/credit-notes – Record credit note (sales return / adjustment)
router.post('/credit-notes', verifySupervisor, async (req, res) => {
  const { customer_id, date, boxes, weight_kg, rate_per_kg, reason } = req.body;

  if (!customer_id || !isValidUUID(customer_id)) {
    return res.status(400).json({ error: 'Valid customer_id is required' });
  }

  const weight = parsePositiveFloat(weight_kg, 0);
  const rate = parsePositiveFloat(rate_per_kg, 0);
  if (weight <= 0 || rate <= 0) {
    return res.status(400).json({ error: 'weight_kg and rate_per_kg must be positive numbers greater than 0' });
  }

  const txDate = date || new Date().toISOString().split('T')[0];
  if (!isValidDateString(txDate)) {
    return res.status(400).json({ error: 'Invalid date. Expected format YYYY-MM-DD.' });
  }

  try {
    const customer = await checkCustomerAccess(customer_id, req.user);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found or access denied' });
    }

    const { rows } = await pool.query(
      `INSERT INTO customer_credit_notes (customer_id, group_id, date, boxes, weight_kg, rate_per_kg, reason, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        customer_id,
        customer.group_id,
        txDate,
        parsePositiveInt(boxes, 0),
        weight,
        rate,
        sanitizeString(reason, 500) || null,
        req.user.id
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[CREDIT NOTE POST ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to record credit note' });
  }
});

// DELETE /api/credit-notes/:id – Delete credit note with IDOR check
router.delete('/credit-notes/:id', verifySupervisor, async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ error: 'Invalid credit note ID format' });

  try {
    const existing = await pool.query('SELECT * FROM customer_credit_notes WHERE id = $1', [id]);
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Credit note not found' });
    }

    const note = existing.rows[0];
    if (req.user.role !== 'ADMIN') {
      let gid = req.user.group_id;
      if (!gid) {
        const u = await pool.query('SELECT group_id FROM users WHERE id = $1', [req.user.id]);
        gid = u.rows[0]?.group_id;
      }
      if (note.group_id !== gid) {
        return res.status(403).json({ error: 'Access denied: cannot delete credit note from another group' });
      }
    }

    const { rows } = await pool.query('DELETE FROM customer_credit_notes WHERE id = $1 RETURNING *', [id]);
    res.json({ message: 'Credit note deleted', creditNote: rows[0] });
  } catch (err) {
    console.error('[CREDIT NOTE DELETE ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to delete credit note' });
  }
});

// GET /api/reports/group-summary – Monthly Group Summary (Optimized: 0 N+1 Queries)
router.get('/reports/group-summary', verifySupervisor, async (req, res) => {
  const { group_id, from, to } = req.query;

  if (from && !isValidDateString(from)) {
    return res.status(400).json({ error: 'Invalid "from" date format. Expected YYYY-MM-DD.' });
  }
  if (to && !isValidDateString(to)) {
    return res.status(400).json({ error: 'Invalid "to" date format. Expected YYYY-MM-DD.' });
  }

  try {
    let targetGroupId = group_id;
    if (req.user.role !== 'ADMIN') {
      targetGroupId = req.user.group_id;
      if (!targetGroupId) {
        const u = await pool.query('SELECT group_id FROM users WHERE id = $1', [req.user.id]);
        targetGroupId = u.rows[0]?.group_id;
      }
    }

    if (!targetGroupId) {
      const g = await pool.query('SELECT id FROM groups ORDER BY name LIMIT 1');
      targetGroupId = g.rows[0]?.id;
    }

    if (!targetGroupId) {
      return res.status(400).json({ error: 'No active group found' });
    }

    const groupRes = await pool.query('SELECT name FROM groups WHERE id = $1', [targetGroupId]);
    const groupName = groupRes.rows[0]?.name || 'Group Summary';

    // 1. Fetch all customers in target group
    const customersRes = await pool.query(
      'SELECT id, name, minus_rate, opening_balance, opening_balance_type FROM customers WHERE group_id = $1 ORDER BY name ASC',
      [targetGroupId]
    );
    const customers = customersRes.rows;

    if (!customers.length) {
      return res.json({
        group_id: targetGroupId,
        group_name: groupName,
        period: { from: from || null, to: to || null },
        rows: [],
        grand_total: {
          opening_balance: 0,
          opening_balance_type: 'Dr',
          debit: 0,
          credit: 0,
          closing_balance: 0,
          closing_balance_type: 'Dr'
        }
      });
    }

    // 2. High-Performance Bulk Aggregations (Replaces 300+ N+1 queries with single parallel calls)
    // Map customer_id -> totals
    const priorDebitsMap = new Map();
    const priorPaymentsMap = new Map();
    const priorCreditsMap = new Map();

    const periodDebitsMap = new Map();
    const periodPaymentsMap = new Map();
    const periodCreditsMap = new Map();

    // Query prior aggregations if 'from' is set
    const promises = [];

    if (from) {
      promises.push(
        pool.query(
          `SELECT customer_id, COALESCE(SUM(total_amount), 0) AS total 
           FROM orders 
           WHERE group_id = $1 AND date < $2 
           GROUP BY customer_id`,
          [targetGroupId, from]
        ).then(r => r.rows.forEach(row => priorDebitsMap.set(row.customer_id, parseFloat(row.total) || 0))),

        pool.query(
          `SELECT customer_id, COALESCE(SUM(amount_paid), 0) AS total 
           FROM customer_payments 
           WHERE group_id = $1 AND payment_date < $2 
           GROUP BY customer_id`,
          [targetGroupId, from]
        ).then(r => r.rows.forEach(row => priorPaymentsMap.set(row.customer_id, parseFloat(row.total) || 0))),

        pool.query(
          `SELECT customer_id, COALESCE(SUM(amount), 0) AS total 
           FROM customer_credit_notes 
           WHERE group_id = $1 AND date < $2 
           GROUP BY customer_id`,
          [targetGroupId, from]
        ).then(r => r.rows.forEach(row => priorCreditsMap.set(row.customer_id, parseFloat(row.total) || 0)))
      );
    }

    // Query period aggregations
    let ordDateClause = '';
    let payDateClause = '';
    let cnDateClause = '';
    const dateParams = [targetGroupId];

    if (from && to) {
      dateParams.push(from, to);
      ordDateClause = ' AND date BETWEEN $2 AND $3';
      payDateClause = ' AND payment_date BETWEEN $2 AND $3';
      cnDateClause = ' AND date BETWEEN $2 AND $3';
    } else if (from) {
      dateParams.push(from);
      ordDateClause = ' AND date >= $2';
      payDateClause = ' AND payment_date >= $2';
      cnDateClause = ' AND date >= $2';
    }

    promises.push(
      pool.query(
        `SELECT customer_id, COALESCE(SUM(total_amount), 0) AS total 
         FROM orders 
         WHERE group_id = $1 ${ordDateClause} 
         GROUP BY customer_id`,
        dateParams
      ).then(r => r.rows.forEach(row => periodDebitsMap.set(row.customer_id, parseFloat(row.total) || 0))),

      pool.query(
        `SELECT customer_id, COALESCE(SUM(amount_paid), 0) AS total 
         FROM customer_payments 
         WHERE group_id = $1 ${payDateClause} 
         GROUP BY customer_id`,
        dateParams
      ).then(r => r.rows.forEach(row => periodPaymentsMap.set(row.customer_id, parseFloat(row.total) || 0))),

      pool.query(
        `SELECT customer_id, COALESCE(SUM(amount), 0) AS total 
         FROM customer_credit_notes 
         WHERE group_id = $1 ${cnDateClause} 
         GROUP BY customer_id`,
        dateParams
      ).then(r => r.rows.forEach(row => periodCreditsMap.set(row.customer_id, parseFloat(row.total) || 0)))
    );

    await Promise.all(promises);

    // 3. Assemble and calculate Tally balances in-memory in O(N)
    let grandOpeningBalance = 0;
    let grandDebits = 0;
    let grandCredits = 0;
    let grandClosingBalance = 0;

    const summaryRows = customers.map(c => {
      const baseOpBal = parseFloat(c.opening_balance) || 0;
      let initialBal = c.opening_balance_type === 'CR' ? -baseOpBal : baseOpBal;

      if (from) {
        const d = priorDebitsMap.get(c.id) || 0;
        const p = priorPaymentsMap.get(c.id) || 0;
        const cn = priorCreditsMap.get(c.id) || 0;
        initialBal += (d - p - cn);
      }

      const periodDebits = periodDebitsMap.get(c.id) || 0;
      const periodPayments = periodPaymentsMap.get(c.id) || 0;
      const periodCredits = periodCreditsMap.get(c.id) || 0;
      const totalPeriodCredits = periodPayments + periodCredits;

      const closingBal = initialBal + periodDebits - totalPeriodCredits;

      grandOpeningBalance += initialBal;
      grandDebits += periodDebits;
      grandCredits += totalPeriodCredits;
      grandClosingBalance += closingBal;

      return {
        id: c.id,
        name: c.name,
        opening_balance: Math.abs(initialBal),
        opening_balance_type: initialBal >= 0 ? 'Dr' : 'Cr',
        debit: periodDebits,
        credit: totalPeriodCredits,
        closing_balance: Math.abs(closingBal),
        closing_balance_type: closingBal >= 0 ? 'Dr' : 'Cr'
      };
    });

    res.json({
      group_id: targetGroupId,
      group_name: groupName,
      period: { from: from || null, to: to || null },
      rows: summaryRows,
      grand_total: {
        opening_balance: Math.abs(grandOpeningBalance),
        opening_balance_type: grandOpeningBalance >= 0 ? 'Dr' : 'Cr',
        debit: grandDebits,
        credit: grandCredits,
        closing_balance: Math.abs(grandClosingBalance),
        closing_balance_type: grandClosingBalance >= 0 ? 'Dr' : 'Cr'
      }
    });
  } catch (err) {
    console.error('[GROUP SUMMARY ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to generate group summary' });
  }
});

module.exports = router;
