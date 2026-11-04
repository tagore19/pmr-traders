/**
 * Security Middlewares & Input Validation Utilities
 * PMR Traders Backend Architecture
 */

// In-memory sliding window rate limiter
const rateLimitStores = new Map();

/**
 * Creates an in-memory rate limiter middleware.
 * @param {Object} options
 * @param {number} options.windowMs - Time frame in milliseconds
 * @param {number} options.max - Max requests per window per IP
 * @param {string} options.message - Error message returned upon exceeding limit
 */
function createRateLimiter({ windowMs = 60 * 1000, max = 60, message = 'Too many requests, please try again later.' }) {
  const store = new Map();

  // Periodically clean expired buckets every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of store.entries()) {
      if (now > data.resetTime) {
        store.delete(ip);
      }
    }
  }, 5 * 60 * 1000).unref();

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();

    let record = store.get(ip);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      store.set(ip, record);
      return next();
    }

    record.count += 1;
    if (record.count > max) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({ error: message, retryAfter: retryAfterSec });
    }

    next();
  };
}

// Pre-configured rate limiters
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please wait 1 minute before trying again.'
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: 'API rate limit exceeded. Please slow down.'
});

/**
 * Basic security headers middleware (lightweight alternative to helmet)
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
}

/**
 * Validates a YYYY-MM-DD date string
 */
function isValidDateString(str) {
  if (!str || typeof str !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(str)) return false;
  const d = new Date(str + 'T00:00:00Z');
  return !isNaN(d.getTime());
}

/**
 * Validates standard UUID v4 format
 */
function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(str);
}

/**
 * Parses and validates positive numbers
 */
function parsePositiveFloat(val, fallback = 0) {
  const num = parseFloat(val);
  if (isNaN(num) || !isFinite(num) || num < 0) return fallback;
  return num;
}

/**
 * Parses and validates positive integers
 */
function parsePositiveInt(val, fallback = 0) {
  const num = parseInt(val, 10);
  if (isNaN(num) || !isFinite(num) || num < 0) return fallback;
  return num;
}

/**
 * Sanitizes and truncates strings
 */
function sanitizeString(str, maxLen = 255) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

module.exports = {
  createRateLimiter,
  authLimiter,
  apiLimiter,
  securityHeaders,
  isValidDateString,
  isValidUUID,
  parsePositiveFloat,
  parsePositiveInt,
  sanitizeString,
};
