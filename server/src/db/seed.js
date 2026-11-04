const pool = require('../db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('[SEED] Running seed...');

  // Create groups
  const sureshGroup = await pool.query(`
    INSERT INTO groups (name, description)
    VALUES ('SURESH GROUP', 'Suresh Group - Team Suresh')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
  const sureshGroupId = sureshGroup.rows[0].id;

  const sathishGroup = await pool.query(`
    INSERT INTO groups (name, description)
    VALUES ('SATHISH GROUP', 'Sathish Group - Team Sathish')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
  const sathishGroupId = sathishGroup.rows[0].id;

  console.log('[SEED] Groups created:', sureshGroupId, sathishGroupId);

  // Create Admin (no group - sees all)
  const adminHash = await bcrypt.hash('admin123', 10);
  await pool.query(`
    INSERT INTO users (name, role, group_id, credentials)
    VALUES ('Admin Owner', 'ADMIN', NULL, $1)
    ON CONFLICT DO NOTHING
  `, [adminHash]);

  // Create Supervisor for SURESH GROUP
  const sureshHash = await bcrypt.hash('suresh123', 10);
  await pool.query(`
    INSERT INTO users (name, role, group_id, credentials)
    VALUES ('Suresh Supervisor', 'SUPERVISOR', $1, $2)
    ON CONFLICT DO NOTHING
  `, [sureshGroupId, sureshHash]);

  // Create Supervisor for SATHISH GROUP
  const sathishHash = await bcrypt.hash('sathish123', 10);
  await pool.query(`
    INSERT INTO users (name, role, group_id, credentials)
    VALUES ('Sathish Supervisor', 'SUPERVISOR', $1, $2)
    ON CONFLICT DO NOTHING
  `, [sathishGroupId, sathishHash]);

  console.log('[SEED] Done.');
  console.log('[SEED] Admin: Admin Owner / admin123');
  console.log('[SEED] Supervisor (SURESH GROUP): Suresh Supervisor / suresh123');
  console.log('[SEED] Supervisor (SATHISH GROUP): Sathish Supervisor / sathish123');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });