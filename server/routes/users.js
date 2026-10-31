'use strict';

/**
 * User administration routes (admin only): list users, change a user's role,
 * and delete a user. An admin cannot delete or demote their own account, to
 * avoid locking the system out of all administrators.
 */
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

// GET /api/users -> all accounts with a reservation count
router.get('/', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.created_at,
           (SELECT COUNT(*) FROM reservations r WHERE r.user_id = u.id) AS reservation_count
    FROM users u ORDER BY u.created_at DESC
  `).all();
  res.json({ users: rows });
});

// PUT /api/users/:id/role -> promote/demote
router.put('/:id/role', requireAdmin, (req, res) => {
  const { role } = req.body || {};
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'role must be user or admin' });
  if (Number(req.params.id) === req.user.sub && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own administrator rights' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/users/:id
router.delete('/:id', requireAdmin, (req, res) => {
  if (Number(req.params.id) === req.user.sub) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
