'use strict';

/**
 * Robot routes: browsing, CRUD (admin), reservation check-out / check-in,
 * and maintenance logging.
 */
const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { computeWear, wearBand, validateRobotPayload } = require('../helpers');

const router = express.Router();

/** Attach a derived health band to a robot row for the UI. */
function decorate(robot) {
  return robot ? { ...robot, wear_band: wearBand(robot.wear_level) } : robot;
}

// GET /api/robots  -> list with optional filters (?status=&category=&location=&q=)
router.get('/', requireAuth, (req, res) => {
  const { status, category, location, q } = req.query;
  const where = [];
  const params = [];

  if (status) { where.push('status = ?'); params.push(status); }
  if (category) { where.push('category = ?'); params.push(category); }
  if (location) { where.push('location = ?'); params.push(location); }
  if (q) {
    where.push('(name LIKE ? OR model LIKE ? OR manufacturer LIKE ? OR serial_number LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const sql = `SELECT * FROM robots ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name`;
  const rows = db.prepare(sql).all(...params).map(decorate);
  res.json({ robots: rows });
});

// GET /api/robots/:id  -> one robot with its reservation and maintenance history
router.get('/:id', requireAuth, (req, res) => {
  const robot = db.prepare('SELECT * FROM robots WHERE id = ?').get(req.params.id);
  if (!robot) return res.status(404).json({ error: 'Robot not found' });

  const reservations = db.prepare(`
    SELECT r.*, u.name AS user_name
    FROM reservations r JOIN users u ON u.id = r.user_id
    WHERE r.robot_id = ? ORDER BY r.start_time DESC LIMIT 20
  `).all(req.params.id);

  const maintenance = db.prepare(`
    SELECT m.*, u.name AS technician_name
    FROM maintenance_logs m LEFT JOIN users u ON u.id = m.technician_id
    WHERE m.robot_id = ? ORDER BY m.performed_at DESC
  `).all(req.params.id);

  const activeReservation = reservations.find((r) => r.status === 'active') || null;
  res.json({ robot: decorate(robot), reservations, maintenance, activeReservation });
});

// POST /api/robots  (admin) -> create a robot
router.post('/', requireAdmin, (req, res) => {
  const errors = validateRobotPayload(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const b = req.body;
  const duplicate = db.prepare('SELECT id FROM robots WHERE serial_number = ?').get(b.serial_number);
  if (duplicate) return res.status(409).json({ error: 'A robot with that serial number already exists' });

  const totalHours = Number(b.total_operating_hours) || 0;
  const interval = Number(b.service_interval_hours) || 2000;
  const lastService = Number(b.last_service_hours) || 0;
  const wear = computeWear(totalHours, lastService, interval);

  const info = db.prepare(`
    INSERT INTO robots
      (name, model, manufacturer, serial_number, category, location, status,
       payload_kg, reach_mm, dof, installed_date, total_operating_hours,
       service_interval_hours, last_service_hours, wear_level, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    b.name.trim(), b.model.trim(), b.manufacturer.trim(), b.serial_number.trim(),
    b.category, b.location, b.status || 'free',
    Number(b.payload_kg) || 0, Number(b.reach_mm) || 0, Number(b.dof) || 6,
    b.installed_date || null, totalHours, interval, lastService, wear, b.notes || null
  );

  const robot = db.prepare('SELECT * FROM robots WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ robot: decorate(robot) });
});

// PUT /api/robots/:id  (admin) -> update fields
router.put('/:id', requireAdmin, (req, res) => {
  const robot = db.prepare('SELECT * FROM robots WHERE id = ?').get(req.params.id);
  if (!robot) return res.status(404).json({ error: 'Robot not found' });

  const errors = validateRobotPayload(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const fields = ['name', 'model', 'manufacturer', 'category', 'location', 'status',
    'payload_kg', 'reach_mm', 'dof', 'installed_date', 'total_operating_hours',
    'service_interval_hours', 'last_service_hours', 'notes'];
  const merged = { ...robot };
  for (const f of fields) if (req.body[f] !== undefined) merged[f] = req.body[f];

  merged.wear_level = computeWear(
    Number(merged.total_operating_hours), Number(merged.last_service_hours), Number(merged.service_interval_hours)
  );

  db.prepare(`
    UPDATE robots SET name=?, model=?, manufacturer=?, category=?, location=?, status=?,
      payload_kg=?, reach_mm=?, dof=?, installed_date=?, total_operating_hours=?,
      service_interval_hours=?, last_service_hours=?, wear_level=?, notes=?
    WHERE id=?
  `).run(
    merged.name, merged.model, merged.manufacturer, merged.category, merged.location, merged.status,
    Number(merged.payload_kg), Number(merged.reach_mm), Number(merged.dof), merged.installed_date,
    Number(merged.total_operating_hours), Number(merged.service_interval_hours),
    Number(merged.last_service_hours), merged.wear_level, merged.notes, req.params.id
  );

  res.json({ robot: decorate(db.prepare('SELECT * FROM robots WHERE id = ?').get(req.params.id)) });
});

// DELETE /api/robots/:id  (admin)
router.delete('/:id', requireAdmin, (req, res) => {
  const robot = db.prepare('SELECT id FROM robots WHERE id = ?').get(req.params.id);
  if (!robot) return res.status(404).json({ error: 'Robot not found' });
  db.prepare('DELETE FROM robots WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/robots/:id/reserve  -> check a free robot out to the current user
router.post('/:id/reserve', requireAuth, (req, res) => {
  const robot = db.prepare('SELECT * FROM robots WHERE id = ?').get(req.params.id);
  if (!robot) return res.status(404).json({ error: 'Robot not found' });
  if (robot.status !== 'free') {
    return res.status(409).json({ error: `Robot is not available (current status: ${robot.status})` });
  }

  const purpose = (req.body && req.body.purpose) || 'General use';
  const expectedHours = Number(req.body && req.body.expected_hours) || 1;

  const tx = db.prepare('BEGIN');
  try {
    tx.run();
    db.prepare(`
      INSERT INTO reservations (robot_id, user_id, purpose, expected_hours, status)
      VALUES (?, ?, ?, ?, 'active')
    `).run(robot.id, req.user.sub, purpose, expectedHours);
    db.prepare("UPDATE robots SET status = 'in_use' WHERE id = ?").run(robot.id);
    db.prepare('COMMIT').run();
  } catch (err) {
    db.prepare('ROLLBACK').run();
    throw err;
  }

  res.status(201).json({ robot: decorate(db.prepare('SELECT * FROM robots WHERE id = ?').get(robot.id)) });
});

// POST /api/robots/:id/release  -> check a robot back in and log operating hours
router.post('/:id/release', requireAuth, (req, res) => {
  const robot = db.prepare('SELECT * FROM robots WHERE id = ?').get(req.params.id);
  if (!robot) return res.status(404).json({ error: 'Robot not found' });

  const reservation = db.prepare(
    "SELECT * FROM reservations WHERE robot_id = ? AND status = 'active' ORDER BY start_time DESC LIMIT 1"
  ).get(robot.id);
  if (!reservation) return res.status(409).json({ error: 'Robot is not currently in use' });

  // Only the person who reserved it, or an admin, may release it.
  if (reservation.user_id !== req.user.sub && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the user who reserved this robot (or an admin) can release it' });
  }

  const loggedHours = Number(req.body && req.body.logged_hours) || reservation.expected_hours || 1;
  const newTotal = robot.total_operating_hours + loggedHours;
  const newWear = computeWear(newTotal, robot.last_service_hours, robot.service_interval_hours);

  const tx = db.prepare('BEGIN');
  try {
    tx.run();
    db.prepare(`
      UPDATE reservations SET status = 'completed', end_time = datetime('now'), logged_hours = ?
      WHERE id = ?
    `).run(loggedHours, reservation.id);
    db.prepare(`
      UPDATE robots SET status = 'free', total_operating_hours = ?, wear_level = ? WHERE id = ?
    `).run(newTotal, newWear, robot.id);
    db.prepare('COMMIT').run();
  } catch (err) {
    db.prepare('ROLLBACK').run();
    throw err;
  }

  res.json({ robot: decorate(db.prepare('SELECT * FROM robots WHERE id = ?').get(robot.id)) });
});

// POST /api/robots/:id/maintenance  (admin) -> record a maintenance event
router.post('/:id/maintenance', requireAdmin, (req, res) => {
  const robot = db.prepare('SELECT * FROM robots WHERE id = ?').get(req.params.id);
  if (!robot) return res.status(404).json({ error: 'Robot not found' });

  const { type, description, cost } = req.body || {};
  if (!description || String(description).trim() === '') {
    return res.status(400).json({ error: 'description is required' });
  }
  const resetsWear = req.body.resets_wear === undefined ? 1 : (req.body.resets_wear ? 1 : 0);
  const hoursAtService = robot.total_operating_hours;

  const tx = db.prepare('BEGIN');
  try {
    tx.run();
    db.prepare(`
      INSERT INTO maintenance_logs (robot_id, technician_id, type, description, hours_at_service, cost, resets_wear)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(robot.id, req.user.sub, type || 'Preventive', description.trim(), hoursAtService, Number(cost) || 0, resetsWear);

    let lastService = robot.last_service_hours;
    if (resetsWear) lastService = robot.total_operating_hours; // "reset the clock" on wear
    const newWear = computeWear(robot.total_operating_hours, lastService, robot.service_interval_hours);
    // Completing maintenance returns the robot to service.
    const newStatus = robot.status === 'maintenance' ? 'free' : robot.status;
    db.prepare('UPDATE robots SET last_service_hours = ?, wear_level = ?, status = ? WHERE id = ?')
      .run(lastService, newWear, newStatus, robot.id);
    db.prepare('COMMIT').run();
  } catch (err) {
    db.prepare('ROLLBACK').run();
    throw err;
  }

  res.status(201).json({ robot: decorate(db.prepare('SELECT * FROM robots WHERE id = ?').get(robot.id)) });
});

module.exports = router;
