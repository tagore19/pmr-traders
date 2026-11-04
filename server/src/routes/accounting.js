const express = require('express');
const pool = require('../db');
const { verifySupervisor } = require('../middleware/auth');

const router = express.Router();

// Helper: check customer access
async function checkCustomerAccess(customerId, user) {
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

  try {
    const customer = await checkCustomerAccess(id, req.user);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found or access denied' });
    }

    const baseOpBal = parseFloat(customer.opening_balance) || 0;
    // Sign convention: positive = Dr (Receivable), negative = Cr (Payable / Advance)
    let runningBalance = customer.opening_balance_type === 'CR' ? -baseOpBal : baseOpBal;

    // If 'from' date is given, adjust opening balance by transactions prior to 'from'
    if (from) {
      const priorDebits = await pool.query(
        'SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE customer_id = $1 AND date < $2',
        [id, from]
      );
      const priorPayments = await pool.query(
        'SELECT COALESCE(SUM(amount_paid), 0) AS total FROM customer_payments WHERE customer_id = $1 AND payment_date < $2',
        [id, from]
      );
      const priorCredits = await pool.query(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM customer_credit_notes WHERE customer_id = $1 AND date < $2',
        [id, from]
      );

      const d = parseFloat(priorDebits.rows[0].total) || 0;
      const p = parseFloat(priorPayments.rows[0].total) || 0;
      const c = parseFloat(priorCredits.rows[0].total) || 0;
      runningBalance += (d - p - c);
    }

    const periodOpeningBalance = runningBalance;

    // Fetch transactions in range
    let ordersFilter = 'WHERE o.customer_id = $1';
    let paymentsFilter = 'WHERE customer_id = $1';
    let creditsFilter = 'WHERE customer_id = $1';
    const params = [id];

    if (from && to) {
      params.push(from, to);
      ordersFilter += ` AND o.date BETWEEN $2 AND $3`;
      paymentsFilter += ` AND payment_date BETWEEN $2 AND $3`;
      creditsFilter += ` AND date BETWEEN $2 AND $3`;
    } else if (from) {
      params.push(from);
      ordersFilter += ` AND o.date >= $2`;
      paymentsFilter += ` AND payment_date >= $2`;
      creditsFilter += ` AND date >= $2`;
    }

    // 1. Orders (Debits)
    const ordersRes = await pool.query(
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
         df.farm_name,
         df.vehicle_no,
         o.notes,
         1 AS sort_order,
         o.created_at
       FROM orders o
       LEFT JOIN daily_farms df ON df.id = o.daily_farm_id
       ${ordersFilter}`,
      params
    );

    // 2. Payments (Credits)
    const paymentsRes = await pool.query(
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
    );

    // 3. Credit Notes (Credits)
    const creditNotesRes = await pool.query(
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
    );

    // Merge and sort chronologically
    const allTransactions = [
      ...ordersRes.rows,
      ...paymentsRes.rows,
      ...creditNotesRes.rows
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
    res.status(500).json({ error: 'Failed to generate customer ledger' });
  }
});

// POST /api/payments – Record customer cash / bank receipt
router.post('/payments', verifySupervisor, async (req, res) => {
  const { customer_id, payment_date, amount_paid, payment_mode, notes } = req.body;

  if (!customer_id || !amount_paid) {
    return res.status(400).json({ error: 'customer_id and amount_paid are required' });
  }

  const date = payment_date || new Date().toISOString().split('T')[0];
  const amount = parseFloat(amount_paid);

  try {
    const customer = await checkCustomerAccess(customer_id, req.user);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found or access denied' });
    }

    const { rows } = await pool.query(
      `INSERT INTO customer_payments (customer_id, group_id, payment_date, amount_paid, payment_mode, notes, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [customer_id, customer.group_id, date, amount, payment_mode || 'CASH', notes || null, req.user.id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[PAYMENT POST ERROR]', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// DELETE /api/payments/:id – Delete a payment receipt
router.delete('/payments/:id', verifySupervisor, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM customer_payments WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Payment not found' });
    res.json({ message: 'Payment deleted', payment: rows[0] });
  } catch (err) {
    console.error('[PAYMENT DELETE ERROR]', err);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// POST /api/credit-notes – Record credit note (sales return / adjustment)
router.post('/credit-notes', verifySupervisor, async (req, res) => {
  const { customer_id, date, boxes, weight_kg, rate_per_kg, reason } = req.body;

  if (!customer_id || !weight_kg || !rate_per_kg) {
    return res.status(400).json({ error: 'customer_id, weight_kg, and rate_per_kg required' });
  }

  const txDate = date || new Date().toISOString().split('T')[0];

  try {
    const customer = await checkCustomerAccess(customer_id, req.user);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found or access denied' });
    }

    const { rows } = await pool.query(
      `INSERT INTO customer_credit_notes (customer_id, group_id, date, boxes, weight_kg, rate_per_kg, reason, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [customer_id, customer.group_id, txDate, parseInt(boxes, 10) || 0, parseFloat(weight_kg), parseFloat(rate_per_kg), reason || null, req.user.id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[CREDIT NOTE POST ERROR]', err);
    res.status(500).json({ error: 'Failed to record credit note' });
  }
});

// DELETE /api/credit-notes/:id – Delete credit note
router.delete('/credit-notes/:id', verifySupervisor, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM customer_credit_notes WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Credit note not found' });
    res.json({ message: 'Credit note deleted', creditNote: rows[0] });
  } catch (err) {
    console.error('[CREDIT NOTE DELETE ERROR]', err);
    res.status(500).json({ error: 'Failed to delete credit note' });
  }
});

// GET /api/reports/group-summary – Monthly Group Summary (Tally-style)
router.get('/reports/group-summary', verifySupervisor, async (req, res) => {
  const { group_id, from, to } = req.query;

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

    const groupRes = await pool.query('SELECT name FROM groups WHERE id = $1', [targetGroupId]);
    const groupName = groupRes.rows[0]?.name || 'Group Summary';

    // Get all customers in this group
    const customersRes = await pool.query(
      'SELECT id, name, minus_rate, opening_balance, opening_balance_type FROM customers WHERE group_id = $1 ORDER BY name ASC',
      [targetGroupId]
    );

    const customers = customersRes.rows;
    const summaryRows = [];

    let grandOpeningBalance = 0;
    let grandDebits = 0;
    let grandCredits = 0;
    let grandClosingBalance = 0;

    for (const c of customers) {
      const baseOpBal = parseFloat(c.opening_balance) || 0;
      let initialBal = c.opening_balance_type === 'CR' ? -baseOpBal : baseOpBal;

      // Prior transactions if 'from' is set
      if (from) {
        const priorDebits = await pool.query(
          'SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE customer_id = $1 AND date < $2',
          [c.id, from]
        );
        const priorPayments = await pool.query(
          'SELECT COALESCE(SUM(amount_paid), 0) AS total FROM customer_payments WHERE customer_id = $1 AND payment_date < $2',
          [c.id, from]
        );
        const priorCredits = await pool.query(
          'SELECT COALESCE(SUM(amount), 0) AS total FROM customer_credit_notes WHERE customer_id = $1 AND date < $2',
          [c.id, from]
        );

        const d = parseFloat(priorDebits.rows[0].total) || 0;
        const p = parseFloat(priorPayments.rows[0].total) || 0;
        const cn = parseFloat(priorCredits.rows[0].total) || 0;
        initialBal += (d - p - cn);
      }

      // Transactions within period
      let ordersFilter = 'WHERE customer_id = $1';
      let paymentsFilter = 'WHERE customer_id = $1';
      let creditsFilter = 'WHERE customer_id = $1';
      const params = [c.id];

      if (from && to) {
        params.push(from, to);
        ordersFilter += ' AND date BETWEEN $2 AND $3';
        paymentsFilter += ' AND payment_date BETWEEN $2 AND $3';
        creditsFilter += ' AND date BETWEEN $2 AND $3';
      } else if (from) {
        params.push(from);
        ordersFilter += ' AND date >= $2';
        paymentsFilter += ' AND payment_date >= $2';
        creditsFilter += ' AND date >= $2';
      }

      const periodDebitsRes = await pool.query(`SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders ${ordersFilter}`, params);
      const periodPaymentsRes = await pool.query(`SELECT COALESCE(SUM(amount_paid), 0) AS total FROM customer_payments ${paymentsFilter}`, params);
      const periodCreditsRes = await pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM customer_credit_notes ${creditsFilter}`, params);

      const periodDebits = parseFloat(periodDebitsRes.rows[0].total) || 0;
      const periodPayments = parseFloat(periodPaymentsRes.rows[0].total) || 0;
      const periodCredits = parseFloat(periodCreditsRes.rows[0].total) || 0;
      const totalPeriodCredits = periodPayments + periodCredits;

      const closingBal = initialBal + periodDebits - totalPeriodCredits;

      grandOpeningBalance += initialBal;
      grandDebits += periodDebits;
      grandCredits += totalPeriodCredits;
      grandClosingBalance += closingBal;

      summaryRows.push({
        id: c.id,
        name: c.name,
        opening_balance: Math.abs(initialBal),
        opening_balance_type: initialBal >= 0 ? 'Dr' : 'Cr',
        debit: periodDebits,
        credit: totalPeriodCredits,
        closing_balance: Math.abs(closingBal),
        closing_balance_type: closingBal >= 0 ? 'Dr' : 'Cr'
      });
    }

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
    res.status(500).json({ error: 'Failed to generate group summary' });
  }
});

module.exports = router;
