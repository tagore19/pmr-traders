const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const rawName = (req.body.name || '').trim();
  const rawPass = (req.body.password || '').trim();
  if (!rawName || !rawPass) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    // Match exact (case-insensitive) or by primary identifier (e.g. "admin", "suresh", "sathish")
    const { rows } = await pool.query(
      `SELECT * FROM users 
       WHERE LOWER(TRIM(name)) = LOWER($1)
          OR LOWER(TRIM(name)) LIKE LOWER($1 || ' %')
          OR LOWER(TRIM(name)) LIKE LOWER('%' || $1 || '%')
       ORDER BY 
         CASE WHEN LOWER(TRIM(name)) = LOWER($1) THEN 1 
              WHEN LOWER(TRIM(name)) LIKE LOWER($1 || ' %') THEN 2 
              ELSE 3 
         END
       LIMIT 1`,
      [rawName]
    );
    if (!rows.length) return res.status(401).json({ error: 'Username not found. Try "Admin Owner", "Suresh", or "Sathish".' });

    const user = rows[0];
    const valid = await bcrypt.compare(rawPass, user.credentials);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role, group_id: user.group_id },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, group_id: user.group_id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
