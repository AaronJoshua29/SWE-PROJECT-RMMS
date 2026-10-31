'use strict';

/**
 * Central configuration for the Robot Manipulator Management System (RMMS).
 * Values can be overridden through environment variables so the same code
 * runs in development and in a deployed environment without edits.
 */
const path = require('node:path');

module.exports = {
  PORT: Number(process.env.PORT) || 3000,

  // SQLite database file. Lives in /data next to the project root.
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'rmms.db'),

  // Secret used to sign session tokens. MUST be set in production.
  JWT_SECRET: process.env.JWT_SECRET || 'rmms-dev-secret-change-me',

  // Session token lifetime in seconds (8 hours).
  TOKEN_TTL_SECONDS: 8 * 60 * 60,

  // Wear-level thresholds (percentage) used for colour coding and alerts.
  WEAR: {
    WARNING: 70,   // amber: schedule service soon
    CRITICAL: 90   // red: service overdue
  }
};
