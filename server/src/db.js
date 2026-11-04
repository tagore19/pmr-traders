const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();
const { Pool } = require('pg');

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const poolMax = parseInt(process.env.DB_POOL_MAX || '15', 10);
const idleTimeoutMillis = parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10);
const connectionTimeoutMillis = parseInt(process.env.DB_CONNECT_TIMEOUT || '5000', 10);

// Support cloud PostgreSQL (Render, Neon, Supabase, Railway) via DATABASE_URL
// or traditional local environment variables (DB_HOST, DB_USER, etc.)
const poolConfig = hasDatabaseUrl
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: poolMax,
      idleTimeoutMillis,
      connectionTimeoutMillis,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'pmr_traders',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: poolMax,
      idleTimeoutMillis,
      connectionTimeoutMillis,
    };

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  // Connected client
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

/**
 * Execute an ACID database transaction.
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and client release.
 *
 * @param {Function} callback - Async function receiving (client)
 * @returns {Promise<any>} Result of the callback
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[DB] Error during transaction rollback:', rbErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

pool.withTransaction = withTransaction;

module.exports = pool;
