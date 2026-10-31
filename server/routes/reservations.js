'use strict';

/**
 * Reservation routes. A normal user sees only their own reservations;
 * an administrator can see every reservation in the lab.
 */
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// GET /api/reservations?scope=mine|all
router.get('/', requireAuth, (req, res) => {
  const scope = req.query.scope === 'all' && req.user.role === 'admin' ? 'all' : 'mine';

  const base = `
    SELECT res.*, r.name AS robot_name, r.model AS robot_model, u.name AS user_name
    FROM reservations res
    JOIN robots r ON r.id = res.robot_id
    JOIN users  u ON u.id = res.user_id
  `;

  const rows = scope === 'all'
    ? db.prepare(`${base} ORDER BY res.start_time DESC LIMIT 100`).all()
    : db.prepare(`${base} WHERE res.user_id = ? ORDER BY res.start_time DESC LIMIT 100`).all(req.user.sub);

  res.json({ reservations: rows, scope });
});

module.exports = router;
