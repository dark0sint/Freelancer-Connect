const jwt = require('jsonwebtoken');
const db = require('../db');

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.users.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Sesi tidak valid, silakan login kembali.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesi telah kedaluwarsa, silakan login kembali.' });
  }
}

function attachUser(req, res, next) {
  const token = getToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = db.users.findById(payload.sub) || null;
  } catch (err) {
    req.user = null;
  }
  next();
}

module.exports = { requireAuth, attachUser };
