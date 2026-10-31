'use strict';

/**
 * Authentication and authorisation helpers.
 *
 * Passwords are hashed with scrypt (built into Node's crypto module) using a
 * per-user random salt. Sessions use a compact, signed, stateless token in the
 * same shape as a JWT (header.payload.signature, HS256) so no server-side
 * session store is required.
 */
const crypto = require('node:crypto');
const { JWT_SECRET, TOKEN_TTL_SECONDS } = require('./config');

// ---------- Password hashing ----------

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  // Constant-time comparison to avoid timing attacks.
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Token signing ----------

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  }));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verify(token) {
  if (!token || token.split('.').length !== 3) return null;
  const [header, body, signature] = token.split('.');
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  // Length-safe comparison.
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

// ---------- Express middleware ----------

/** Populates req.user from the Authorization header when a valid token exists. */
function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  req.user = token ? verify(token) : null;
  next();
}

/** Blocks the request unless a valid session is present. */
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

/** Blocks the request unless the authenticated user is an administrator. */
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required' });
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  sign,
  verify,
  authenticate,
  requireAuth,
  requireAdmin
};
