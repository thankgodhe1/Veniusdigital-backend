const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { roles } = require('./constants');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'development-only-jwt-secret-change-me');
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

const maxAge = 3 * 24 * 60 * 60;

function createToken(id) {
  return jwt.sign({ id: String(id) }, JWT_SECRET, { expiresIn: maxAge });
}

function getTokenFromReq(req) {
  const cookieToken = req.cookies && req.cookies.jwt;
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim() || null;
  return null;
}

async function findUserFromToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  return User.findById(decoded.id).select('-password -resetPasswordToken -resetPasswordExpires');
}

async function requireAuth(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated', success: false, message: 'Unauthorized. Please login.' });
  }

  try {
    const user = await findUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'User not found', success: false, message: 'User not found.' });
    }
    req.user = user;
    res.locals.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token', success: false, message: 'Invalid or expired token.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== roles.admin) {
    return res.status(403).json({ error: 'Not authorized', success: false, message: 'Not authorized' });
  }
  return next();
}

async function checkUser(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) {
    res.locals.user = null;
    return next();
  }
  try {
    const user = await findUserFromToken(token);
    res.locals.user = user || null;
    if (user) req.user = user;
  } catch (_) {
    res.locals.user = null;
  }
  return next();
}

module.exports = { requireAuth, requireAdmin, checkUser, createToken, maxAge, JWT_SECRET, getTokenFromReq };
