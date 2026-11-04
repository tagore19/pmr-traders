const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    req.user = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function verifyAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

function verifySupervisor(req, res, next) {
  verifyToken(req, res, () => {
    if (!['ADMIN', 'SUPERVISOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Supervisor access required' });
    }
    next();
  });
}

module.exports = { verifyToken, verifyAdmin, verifySupervisor };
