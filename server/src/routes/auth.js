const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');
const { authLimiter, sanitizeString } = require('../middleware/security');

const router = express.Router();

// POST /api/auth/login - User authentication with rate limiting
router.post('/login', authLimiter, async (req, res) => {
  const rawName = sanitizeString(req.body.name, 100);
  const rawPass = (req.body.password || '').trim();

  if (!rawName || !rawPass) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    // Match exact (case-insensitive) or prefix match (e.g. "admin" for "Admin Owner", "suresh" for "Suresh Supervisor")
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.role, u.group_id, u.credentials, g.name AS group_name
       FROM users u
       LEFT JOIN groups g ON g.id = u.group_id
       WHERE LOWER(TRIM(u.name)) = LOWER($1)
          OR LOWER(TRIM(u.name)) LIKE LOWER($1 || ' %')
       ORDER BY 
         CASE WHEN LOWER(TRIM(u.name)) = LOWER($1) THEN 1 ELSE 2 END
       LIMIT 1`,
      [rawName]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Username not found. Try "Admin Owner", "Suresh", or "Sathish".' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(rawPass, user.credentials);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role, group_id: user.group_id },
      process.env.JWT_SECRET || 'pmr_traders_fallback_secret_change_in_production_2026',
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        group_id: user.group_id,
        group_name: user.group_name || null
      }
    });
  } catch (err) {
    console.error('[AUTH LOGIN ERROR]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/auth/me - Verify active session and return user profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.role, u.group_id, g.name AS group_name
       FROM users u
       LEFT JOIN groups g ON g.id = u.group_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User no longer exists' });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    console.error('[AUTH ME ERROR]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
