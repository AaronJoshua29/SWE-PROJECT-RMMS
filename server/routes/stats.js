'use strict';

/**
 * Dashboard statistics: fleet counts by status, wear distribution,
 * utilisation and the robots most in need of service.
 */
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { WEAR } = require('../config');

const router = express.Router();

// GET /api/stats -> aggregated figures for the dashboard summary cards & charts
router.get('/', requireAuth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS c FROM robots').get().c;

  const byStatusRows = db.prepare('SELECT status, COUNT(*) AS c FROM robots GROUP BY status').all();
  const byStatus = { free: 0, in_use: 0, maintenance: 0, offline: 0 };
  for (const r of byStatusRows) byStatus[r.status] = r.c;

  const avgWearRow = db.prepare('SELECT AVG(wear_level) AS avg FROM robots').get();
  const avgWear = Math.round((avgWearRow.avg || 0) * 10) / 10;

  const wearBands = {
    healthy: db.prepare('SELECT COUNT(*) AS c FROM robots WHERE wear_level < ?').get(WEAR.WARNING).c,
    warning: db.prepare('SELECT COUNT(*) AS c FROM robots WHERE wear_level >= ? AND wear_level < ?')
      .get(WEAR.WARNING, WEAR.CRITICAL).c,
    critical: db.prepare('SELECT COUNT(*) AS c FROM robots WHERE wear_level >= ?').get(WEAR.CRITICAL).c
  };

  const totalHoursRow = db.prepare('SELECT SUM(total_operating_hours) AS h FROM robots').get();
  const totalHours = Math.round(totalHoursRow.h || 0);

  // Utilisation = share of the fleet that is currently in use.
  const utilisation = total ? Math.round((byStatus.in_use / total) * 1000) / 10 : 0;

  const topWear = db.prepare(`
    SELECT id, name, model, status, wear_level
    FROM robots ORDER BY wear_level DESC LIMIT 5
  `).all();

  const byCategory = db.prepare('SELECT category, COUNT(*) AS c FROM robots GROUP BY category ORDER BY c DESC').all();

  const activeReservations = db.prepare("SELECT COUNT(*) AS c FROM reservations WHERE status = 'active'").get().c;

  res.json({
    total,
    byStatus,
    avgWear,
    wearBands,
    totalHours,
    utilisation,
    topWear,
    byCategory,
    activeReservations
  });
});

module.exports = router;
