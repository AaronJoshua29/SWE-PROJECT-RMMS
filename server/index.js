'use strict';

/**
 * Application entry point. Wires up middleware, mounts the REST API,
 * serves the static single-page frontend, and starts the HTTP server.
 */
const path = require('node:path');
const express = require('express');
const { PORT } = require('./config');
const { authenticate } = require('./auth');
const { seedDatabase } = require('./seed');

// Populate the database the first time the app runs.
if (seedDatabase()) console.log('First run detected — database seeded with sample lab fleet.');

const app = express();

app.use(express.json());
app.use(authenticate);                 // attaches req.user when a valid token is present

// REST API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/robots', require('./routes/robots'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stats', require('./routes/stats'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'RMMS', time: new Date().toISOString() }));

// Static frontend (served after the API so /api/* is never shadowed).
app.use(express.static(path.join(__dirname, '..', 'public')));

// Unknown API route -> JSON 404 (anything else falls back to the SPA).
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

// Centralised error handler.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the HTTP server only when run directly, so tests can import `app`.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  Robot Manipulator Management System`);
    console.log(`  Running at  http://localhost:${PORT}`);
    console.log(`  Admin login admin@rmms.io / admin123`);
    console.log(`  User  login aaron@rmms.io / aaron123\n`);
  });
}

module.exports = app;
