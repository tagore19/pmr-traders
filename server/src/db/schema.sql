-- ============================================================
-- PMR Traders – Production Database Schema
-- P M REDDY POULTRY TRADERS (Mahabubabad, Warangal)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sequences for Tally-compatible sequential numbering
CREATE SEQUENCE IF NOT EXISTS order_voucher_seq START WITH 1500;
CREATE SEQUENCE IF NOT EXISTS payment_receipt_seq START WITH 500;
CREATE SEQUENCE IF NOT EXISTS credit_note_seq START WITH 1;

-- ----------------------------------------------------------
-- 1. GROUPS (SURESH GROUP, SATISH GROUP)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 2. USERS (Admin & Supervisors)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  role        VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'SUPERVISOR')),
  group_id    UUID REFERENCES groups(id) ON DELETE SET NULL,
  credentials TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 3. DAILY RATES (Paper Rate set per day)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL UNIQUE,
  paper_rate      DECIMAL(10,2) NOT NULL,
  set_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 4. DAILY FARMS (Procurement Inflow per day)
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- 5. CUSTOMERS (Group-scoped with Opening Balance)
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- 6. ORDERS (Daily Distribution Outflow)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no          INTEGER NOT NULL DEFAULT nextval('order_voucher_seq'),
  date                DATE NOT NULL,
  group_id            UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  supervisor_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  daily_farm_id       UUID NOT NULL REFERENCES daily_farms(id) ON DELETE RESTRICT,
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

-- ----------------------------------------------------------
-- 7. CUSTOMER PAYMENTS (Receipts)
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- 8. CUSTOMER CREDIT NOTES (Sales Returns / Adjustments)
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_daily_farms_date ON daily_farms(date);
CREATE INDEX IF NOT EXISTS idx_orders_date_group ON orders(date, group_id);
CREATE INDEX IF NOT EXISTS idx_orders_daily_farm ON orders(daily_farm_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_supervisor ON orders(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_cust_payments_customer ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_payments_date ON customer_payments(payment_date);