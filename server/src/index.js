const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./db');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'pmr_traders_fallback_secret_change_in_production_2026';
}

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const supervisorRoutes = require('./routes/supervisor');
const dailyFarmsRoutes = require('./routes/dailyFarms');
const dailySheetsRoutes = require('./routes/dailySheets');
const accountingRoutes = require('./routes/accounting');
const initDb = require('./db/initDb');
const { securityHeaders, apiLimiter } = require('./middleware/security');

const app = express();

// Trust reverse proxy (Render, Cloudflare, Railway) for accurate IP-based rate limiting
app.set('trust proxy', 1);

// Security Headers & Payload Boundaries
app.use(securityHeaders);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '100kb' }));

// Global API Rate Limiter
app.use('/api', apiLimiter);

// Comprehensive Deep Health Check (Uptime & PostgreSQL connectivity)
app.get('/api/health', async (_, res) => {
  const startTime = Date.now();
  try {
    const dbRes = await pool.query('SELECT 1 AS healthy');
    const dbLatencyMs = Date.now() - startTime;
    res.json({
      status: 'ok',
      database: dbRes.rows.length ? 'connected' : 'unreachable',
      latency_ms: dbLatencyMs,
      time: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime())
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      database: 'error',
      error: err.message,
      time: new Date().toISOString()
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/daily-farms', dailyFarmsRoutes);
app.use('/api/sheets', dailySheetsRoutes);
app.use('/api', accountingRoutes);
app.use('/api', supervisorRoutes);

// In production or when the client build is present, serve the frontend directly
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const hasClientDist = fs.existsSync(clientDistPath);

if (hasClientDist) {
  console.log(`[SERVER] Serving frontend build from ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  // SPA fallback for frontend client routing (compatible with Express 5)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
} else {
  // Root info when running as standalone API without client build
  app.get('/', (_, res) => res.json({
    message: 'PMR Traders Backend API is running! 🚀',
    frontend: process.env.CLIENT_URL || 'http://localhost:5173',
    health: '/api/health'
  }));
}

// 404 handler for API routes
app.use('/api', (_, res) => res.status(404).json({ error: 'API route not found' }));

// General 404 handler if no client dist
app.use((_, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[SERVER ERROR]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    status
  });
});

const PORT = process.env.PORT || 4000;
let serverInstance = null;

async function startServer() {
  // If AUTO_MIGRATE is set, apply database schema, indexes & seeds on boot
  if (process.env.AUTO_MIGRATE === 'true') {
    try {
      console.log('[SERVER] AUTO_MIGRATE is true. Initializing database schema...');
      await initDb(true);
    } catch (err) {
      console.error('[SERVER] Database migration error on boot:', err.message);
    }
  }

  serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] PMR Traders API running on http://0.0.0.0:${PORT}`);
  });

  return serverInstance;
}

// Graceful Shutdown Handler
function gracefulShutdown(signal) {
  console.log(`[SERVER] Received ${signal}. Starting graceful shutdown...`);
  if (serverInstance) {
    serverInstance.close(async () => {
      console.log('[SERVER] HTTP server closed.');
      try {
        await pool.end();
        console.log('[DB] PostgreSQL pool drained.');
      } catch (err) {
        console.error('[DB] Error closing pool:', err.message);
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
