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

  // Ensure daily_rates has both column aliases for backwards/forwards compatibility
  await pool.query(`
    ALTER TABLE daily_rates ADD COLUMN IF NOT EXISTS set_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE daily_rates ADD COLUMN IF NOT EXISTS set_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
  `);

  // Ensure performance indexes exist
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_daily_farms_date ON daily_farms(date);
    CREATE INDEX IF NOT EXISTS idx_daily_farms_date_name ON daily_farms(date, farm_name);
    CREATE INDEX IF NOT EXISTS idx_orders_date_group ON orders(date, group_id);
    CREATE INDEX IF NOT EXISTS idx_orders_daily_farm ON orders(daily_farm_id);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_date ON orders(customer_id, date);
    CREATE INDEX IF NOT EXISTS idx_orders_supervisor ON orders(supervisor_id);
    CREATE INDEX IF NOT EXISTS idx_cust_payments_customer ON customer_payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_cust_payments_date ON customer_payments(payment_date);
    CREATE INDEX IF NOT EXISTS idx_cust_payments_cust_date ON customer_payments(customer_id, payment_date);
    CREATE INDEX IF NOT EXISTS idx_cust_payments_group ON customer_payments(group_id);
    CREATE INDEX IF NOT EXISTS idx_credit_notes_customer ON customer_credit_notes(customer_id);
    CREATE INDEX IF NOT EXISTS idx_credit_notes_cust_date ON customer_credit_notes(customer_id, date);
    CREATE INDEX IF NOT EXISTS idx_credit_notes_group ON customer_credit_notes(group_id);
    CREATE INDEX IF NOT EXISTS idx_customers_group ON customers(group_id);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
  `);

  console.log('[DB-INIT] Database schema and performance indexes applied successfully.');

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

