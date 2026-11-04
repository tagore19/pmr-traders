const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../db');

async function initDb(skipExit = false) {
  console.log('[DB-INIT] Applying database schema...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Execute entire schema (creates tables, sequences, extensions, indexes)
  await pool.query(schemaSql);
  console.log('[DB-INIT] Database schema applied successfully.');

  // Seed initial groups
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

  // Seed default Admin user
  const adminHash = await bcrypt.hash('admin123', 10);
  await pool.query(`
    INSERT INTO users (name, role, group_id, credentials)
    VALUES ('Admin Owner', 'ADMIN', NULL, $1)
    ON CONFLICT DO NOTHING
  `, [adminHash]);

  // Seed default Supervisor (Suresh)
  const sureshHash = await bcrypt.hash('suresh123', 10);
  await pool.query(`
    INSERT INTO users (name, role, group_id, credentials)
    VALUES ('Suresh Supervisor', 'SUPERVISOR', $1, $2)
    ON CONFLICT DO NOTHING
  `, [sureshGroupId, sureshHash]);

  // Seed default Supervisor (Sathish)
  const sathishHash = await bcrypt.hash('sathish123', 10);
  await pool.query(`
    INSERT INTO users (name, role, group_id, credentials)
    VALUES ('Sathish Supervisor', 'SUPERVISOR', $1, $2)
    ON CONFLICT DO NOTHING
  `, [sathishGroupId, sathishHash]);

  console.log('[DB-INIT] Default groups and users verified.');
  if (!skipExit) {
    process.exit(0);
  }
}

if (require.main === module) {
  initDb()
    .then(() => {
      console.log('[DB-INIT] All migrations and seeding complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[DB-INIT] Database initialization error:', err);
      process.exit(1);
    });
}

module.exports = initDb;
