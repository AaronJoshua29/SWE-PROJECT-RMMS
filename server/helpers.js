'use strict';

/**
 * Small pure helpers shared across routes and the seed script.
 */
const { WEAR } = require('./config');

/**
 * Wear level is modelled as how far a robot has run since its last service,
 * as a percentage of its service interval, capped at 100%.
 *
 *   wear% = clamp( (operatingHours - lastServiceHours) / serviceInterval * 100, 0, 100 )
 */
function computeWear(totalHours, lastServiceHours, serviceIntervalHours) {
  if (!serviceIntervalHours || serviceIntervalHours <= 0) return 0;
  const used = totalHours - lastServiceHours;
  const pct = (used / serviceIntervalHours) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

/** Maps a wear percentage to a human-readable health band. */
function wearBand(wear) {
  if (wear >= WEAR.CRITICAL) return 'critical';
  if (wear >= WEAR.WARNING) return 'warning';
  return 'healthy';
}

/** Basic server-side validators used by the robot endpoints. */
function validateRobotPayload(body, { partial = false } = {}) {
  const errors = [];
  const required = ['name', 'model', 'manufacturer', 'serial_number', 'category', 'location'];
  if (!partial) {
    for (const field of required) {
      if (!body[field] || String(body[field]).trim() === '') {
        errors.push(`${field} is required`);
      }
    }
  }
  if (body.status && !['free', 'in_use', 'maintenance', 'offline'].includes(body.status)) {
    errors.push('status must be one of free, in_use, maintenance, offline');
  }
  if (body.payload_kg != null && Number(body.payload_kg) < 0) errors.push('payload_kg cannot be negative');
  if (body.dof != null && (Number(body.dof) < 1 || Number(body.dof) > 12)) errors.push('dof must be between 1 and 12');
  return errors;
}

module.exports = { computeWear, wearBand, validateRobotPayload };
