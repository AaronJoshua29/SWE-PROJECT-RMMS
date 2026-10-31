'use strict';

/**
 * Database layer.
 *
 * Uses Node.js' built-in synchronous SQLite driver (node:sqlite, available
 * from Node 22.5+). The schema is created on first run if it does not exist.
 * A single shared connection is exported for the whole application.
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH } = require('./config');

// Ensure the /data directory exists before opening the file.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

// Enforce referential integrity (OFF by default in SQLite).
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Create every table if it is not already present.
 * Keeping the DDL in one place doubles as living documentation of the schema
 * and matches the ER diagram in the project report.
 */
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      salt          TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS robots (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      name                   TEXT    NOT NULL,
      model                  TEXT    NOT NULL,
      manufacturer           TEXT    NOT NULL,
      serial_number          TEXT    NOT NULL UNIQUE,
      category               TEXT    NOT NULL,
      location               TEXT    NOT NULL,
      status                 TEXT    NOT NULL DEFAULT 'free'
                                     CHECK (status IN ('free', 'in_use', 'maintenance', 'offline')),
      payload_kg             REAL    NOT NULL DEFAULT 0,
      reach_mm               INTEGER NOT NULL DEFAULT 0,
      dof                    INTEGER NOT NULL DEFAULT 6,
      installed_date         TEXT,
      total_operating_hours  REAL    NOT NULL DEFAULT 0,
      service_interval_hours REAL    NOT NULL DEFAULT 2000,
      last_service_hours     REAL    NOT NULL DEFAULT 0,
      wear_level             REAL    NOT NULL DEFAULT 0,
      notes                  TEXT,
      created_at             TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      robot_id       INTEGER NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
      user_id        INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
      purpose        TEXT,
      start_time     TEXT    NOT NULL DEFAULT (datetime('now')),
      end_time       TEXT,
      expected_hours REAL    NOT NULL DEFAULT 1,
      logged_hours   REAL,
      status         TEXT    NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'completed', 'cancelled'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_logs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      robot_id        INTEGER NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
      technician_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      type            TEXT    NOT NULL DEFAULT 'Preventive'
                              CHECK (type IN ('Preventive', 'Corrective', 'Calibration', 'Inspection')),
      description     TEXT    NOT NULL,
      performed_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      hours_at_service REAL   NOT NULL DEFAULT 0,
      cost            REAL    NOT NULL DEFAULT 0,
      resets_wear     INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_reservations_robot ON reservations(robot_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_user  ON reservations(user_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_robot  ON maintenance_logs(robot_id);
  `);
}

initSchema();

module.exports = db;
