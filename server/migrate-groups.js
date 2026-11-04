require('dotenv').config();
const pool = require('./src/db');
const bcrypt = require('bcryptjs');

async function migrate() {
  console.log('[MIGRATION] Starting multi-group migration...');

  // 1. Enable UUID extension
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  // 2. Create groups table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS groups (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(50) NOT NULL UNIQUE,
      description TEXT,
      created_at  TIMESTAMP   DEFAULT NOW()
    )
  `);
  console.log('✓ groups table ready');

  // 3. Update users table
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL
  `);
  // Ensure unique index on name for safe idempotent seeding
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name ON users(name)
  `);
  console.log('✓ users table updated');

  // 4. Update customers table
  await pool.query(`
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE RESTRICT
  `);
  // Drop old unique constraint on name if it exists
  await pool.query(`
    ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_name_key
  `);
  // Add unique (name, group_id) constraint if not exists
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customers_name_group_key'
      ) THEN
        ALTER TABLE customers ADD CONSTRAINT customers_name_group_key UNIQUE (name, group_id);
      END IF;
    END $$;
  `);
  console.log('✓ customers table updated');

  // 5. Update orders table
  await pool.query(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE RESTRICT
  `);
  console.log('✓ orders table updated');

  // 6. Update customer_payments table
  await pool.query(`
    ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE RESTRICT
  `);
  console.log('✓ customer_payments table updated');

  // 7. Create indexes
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_customers_group_id ON customers(group_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_group_id ON orders(group_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cust_payments_group ON customer_payments(group_id)`);
  console.log('✓ Indexes created');

  // 8. Run Seed (create groups & supervisors)
  console.log('[MIGRATION] Running seed...');
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

  console.log('✓ Groups created/found:', { sureshGroupId, sathishGroupId });

  // Admin user
  const adminHash = await bcrypt.hash('admin123', 10);
  await pool.query(`
    INSERT INTO users (name, role, group_id, credentials)
    VALUES ('Admin Owner', 'ADMIN', NULL, $1)
    ON CONFLICT (name) DO UPDATE SET credentials = EXCLUDED.credentials, role = 'ADMIN'
  `, [adminHash]);

  // Suresh Supervisor
  const sureshHash = await bcrypt.hash('suresh123', 10);
  await pool.query(`
    INSERT INTO users (name, role, group_id, credentials)
    VALUES ('Suresh Supervisor', 'SUPERVISOR', $1, $2)
    ON CONFLICT (name) DO UPDATE SET credentials = EXCLUDED.credentials, group_id = EXCLUDED.group_id
  `, [sureshGroupId, sureshHash]);

  // Sathish Supervisor
  const sathishHash = await bcrypt.hash('sathish123', 10);
  await pool.query(`
    INSERT INTO users (name, role, group_id, credentials)
    VALUES ('Sathish Supervisor', 'SUPERVISOR', $1, $2)
    ON CONFLICT (name) DO UPDATE SET credentials = EXCLUDED.credentials, group_id = EXCLUDED.group_id
  `, [sathishGroupId, sathishHash]);

  console.log('✓ Users seeded successfully:');
  console.log('   - Admin: Admin Owner / admin123');
  console.log('   - Supervisor: Suresh Supervisor / suresh123 (SURESH GROUP)');
  console.log('   - Supervisor: Sathish Supervisor / sathish123 (SATHISH GROUP)');

  console.log('[MIGRATION] Multi-group migration complete!');
  process.exit(0);
}

migrate().catch(e => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
