'use strict';

/**
 * Authentication routes: register, login and "who am I".
 */
const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword, sign, requireAuth } = require('../auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register  -> create a standard user account
router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email address' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const { salt, hash } = hashPassword(password);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), email.toLowerCase().trim(), hash, salt, 'user');

  const user = { id: Number(info.lastInsertRowid), name: name.trim(), email: email.toLowerCase().trim(), role: 'user' };
  const token = sign({ sub: user.id, role: user.role, name: user.name });
  res.status(201).json({ token, user });
});

// POST /api/auth/login  -> exchange credentials for a session token
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
  if (!row || !verifyPassword(password, row.salt, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  const token = sign({ sub: user.id, role: user.role, name: user.name });
  res.json({ token, user });
});

// GET /api/auth/me  -> current user profile (used to restore a session)
router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.sub);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json({ user: row });
});

module.exports = router;
