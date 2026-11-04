require('dotenv').config({ path: 'E:/PMR-Traders/server/.env' });
const pool = require('./src/db');

async function migrate() {
  console.log('[MIGRATION] Starting production schema migration...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Extensions & Sequences
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await client.query(`CREATE SEQUENCE IF NOT EXISTS order_voucher_seq START WITH 1500`);
    await client.query(`CREATE SEQUENCE IF NOT EXISTS payment_receipt_seq START WITH 500`);
    await client.query(`CREATE SEQUENCE IF NOT EXISTS credit_note_seq START WITH 1`);
    console.log('✓ Extensions & sequences verified');

    // 2. Groups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ Groups table verified');

    // 3. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) NOT NULL UNIQUE,
        role        VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'SUPERVISOR')),
        group_id    UUID REFERENCES groups(id) ON DELETE SET NULL,
        credentials TEXT NOT NULL,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ Users table verified');

    // 4. Daily Rates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_rates (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date            DATE NOT NULL UNIQUE,
        paper_rate      DECIMAL(10,2) NOT NULL,
        set_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ Daily rates table verified');

    // 5. Daily Farms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_farms (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date            DATE NOT NULL,
        farm_name       VARCHAR(100) NOT NULL,
        vehicle_no      VARCHAR(50),
        total_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_boxes     INTEGER NOT NULL DEFAULT 0,
        rate_per_kg     DECIMAL(10,2) DEFAULT 0.00,
        weight_loss_kg  DECIMAL(10,2) DEFAULT 0.00,
        added_by_id     UUID REFERENCES users(id) ON DELETE SET NULL,
        notes           TEXT,
        created_at      TIMESTAMP DEFAULT NOW(),
        UNIQUE (date, farm_name)
      );
    `);
    console.log('✓ Daily farms table verified');

    // 6. Customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name                 VARCHAR(100) NOT NULL,
        group_id             UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
        minus_rate           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        opening_balance      DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        opening_balance_type VARCHAR(2) NOT NULL DEFAULT 'DR' CHECK (opening_balance_type IN ('DR', 'CR')),
        created_at           TIMESTAMP DEFAULT NOW(),
        UNIQUE (name, group_id)
      );
    `);

    // Ensure opening balance columns exist on customers if table already existed
    await client.query(`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS opening_balance_type VARCHAR(2) NOT NULL DEFAULT 'DR';
    `);
    // Drop is_active / status column if present
    await client.query(`
      ALTER TABLE customers DROP COLUMN IF EXISTS is_active;
      ALTER TABLE customers DROP COLUMN IF EXISTS status;
    `);
    console.log('✓ Customers table verified & updated');

    // 7. Orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voucher_no          INTEGER NOT NULL DEFAULT nextval('order_voucher_seq'),
        date                DATE NOT NULL,
        group_id            UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
        supervisor_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        daily_farm_id       UUID REFERENCES daily_farms(id) ON DELETE RESTRICT,
        boxes               INTEGER NOT NULL DEFAULT 1,
        weight_kg           DECIMAL(10,2) NOT NULL,
        applied_paper_rate  DECIMAL(10,2) NOT NULL,
        applied_minus_rate  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        final_rate          DECIMAL(10,2) GENERATED ALWAYS AS 
                              (applied_paper_rate - applied_minus_rate) STORED,
        total_amount        DECIMAL(14,2) GENERATED ALWAYS AS 
                              ((applied_paper_rate - applied_minus_rate) * weight_kg) STORED,
        notes               TEXT,
        created_at          TIMESTAMP DEFAULT NOW()
      );
    `);

    // Ensure columns exist on orders if table already existed
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS voucher_no INTEGER NOT NULL DEFAULT nextval('order_voucher_seq'),
      ADD COLUMN IF NOT EXISTS daily_farm_id UUID REFERENCES daily_farms(id) ON DELETE RESTRICT,
      ADD COLUMN IF NOT EXISTS boxes INTEGER NOT NULL DEFAULT 1;
    `);
    console.log('✓ Orders table verified & updated');

    // 8. Customer Payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_payments (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_no    INTEGER NOT NULL DEFAULT nextval('payment_receipt_seq'),
        customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
        payment_date  DATE NOT NULL,
        amount_paid   DECIMAL(14,2) NOT NULL,
        payment_mode  VARCHAR(30) DEFAULT 'CASH' CHECK (payment_mode IN ('CASH', 'UPI', 'NEFT', 'CHEQUE')),
        notes         TEXT,
        recorded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at    TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE customer_payments
      ADD COLUMN IF NOT EXISTS receipt_no INTEGER NOT NULL DEFAULT nextval('payment_receipt_seq'),
      ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(30) DEFAULT 'CASH';
    `);
    console.log('✓ Customer payments table verified');

    // 9. Customer Credit Notes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_credit_notes (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        credit_no     INTEGER NOT NULL DEFAULT nextval('credit_note_seq'),
        customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
        date          DATE NOT NULL,
        boxes         INTEGER DEFAULT 0,
        weight_kg     DECIMAL(10,2) NOT NULL,
        rate_per_kg   DECIMAL(10,2) NOT NULL,
        amount        DECIMAL(14,2) GENERATED ALWAYS AS (weight_kg * rate_per_kg) STORED,
        reason        TEXT,
        recorded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at    TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ Customer credit notes table verified');

    // 10. Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_daily_farms_date ON daily_farms(date);
      CREATE INDEX IF NOT EXISTS idx_orders_date_group ON orders(date, group_id);
      CREATE INDEX IF NOT EXISTS idx_orders_daily_farm ON orders(daily_farm_id);
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_supervisor ON orders(supervisor_id);
      CREATE INDEX IF NOT EXISTS idx_cust_payments_customer ON customer_payments(customer_id);
      CREATE INDEX IF NOT EXISTS idx_cust_payments_date ON customer_payments(payment_date);
    `);
    console.log('✓ Indexes verified');

    await client.query('COMMIT');
    console.log('[MIGRATION] SUCCESS! Database schema is completely up to date.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[MIGRATION ERROR]', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
