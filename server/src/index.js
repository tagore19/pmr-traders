const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');

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

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Health check endpoint (always available for monitoring/uptime)
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

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
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

async function startServer() {
  // If AUTO_MIGRATE is set (useful on Render/Railway initial boot), run DB schema & seeds
  if (process.env.AUTO_MIGRATE === 'true') {
    try {
      console.log('[SERVER] AUTO_MIGRATE is true. Initializing database schema...');
      await initDb(true);
    } catch (err) {
      console.error('[SERVER] Database migration error on boot:', err);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] PMR Traders running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
