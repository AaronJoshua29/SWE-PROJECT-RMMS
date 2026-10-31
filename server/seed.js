'use strict';

/**
 * Seed script. Populates the database with a representative laboratory fleet,
 * a set of accounts, and some reservation / maintenance history so the system
 * is demonstrable immediately.
 *
 *   node server/seed.js --reset     (wipe existing data, then seed)
 *
 * seedDatabase() is also called automatically by the server on first launch
 * when the database is empty.
 */
const db = require('./db');
const { hashPassword } = require('./auth');
const { computeWear } = require('./helpers');

const USERS = [
  { name: 'Lab Administrator', email: 'admin@rmms.io', password: 'admin123', role: 'admin' },
  { name: 'Aaron Joshua',      email: 'aaron@rmms.io', password: 'aaron123', role: 'user' },
  { name: 'Priya Nair',        email: 'priya@rmms.io', password: 'user123',  role: 'user' },
  { name: 'Karthik Reddy',     email: 'karthik@rmms.io', password: 'user123', role: 'user' }
];

// installed_date, total/last service hours chosen to spread wear across bands.
const ROBOTS = [
  { name: 'Lab Arm Alpha',  model: 'KR 6 R900 sixx', manufacturer: 'KUKA', serial_number: 'KUKA-KR6-0001',
    category: '6-DOF Articulated', location: 'Bay A1', status: 'free',
    payload_kg: 6, reach_mm: 901, dof: 6, installed_date: '2022-01-15',
    total_operating_hours: 1420, service_interval_hours: 2000, last_service_hours: 0 },

  { name: 'Lab Arm Beta', model: 'IRB 120', manufacturer: 'ABB', serial_number: 'ABB-IRB120-0002',
    category: '6-DOF Articulated', location: 'Bay A2', status: 'in_use',
    payload_kg: 3, reach_mm: 580, dof: 6, installed_date: '2021-09-10',
    total_operating_hours: 3680, service_interval_hours: 2000, last_service_hours: 2000 },

  { name: 'Pick Station 1', model: 'LR Mate 200iD', manufacturer: 'FANUC', serial_number: 'FANUC-LR200-0003',
    category: '6-DOF Articulated', location: 'Bay B1', status: 'free',
    payload_kg: 7, reach_mm: 717, dof: 6, installed_date: '2023-03-20',
    total_operating_hours: 640, service_interval_hours: 2000, last_service_hours: 0 },

  { name: 'Cobot UR5e', model: 'UR5e', manufacturer: 'Universal Robots', serial_number: 'UR-UR5E-0004',
    category: 'Collaborative', location: 'Bay B2', status: 'in_use',
    payload_kg: 5, reach_mm: 850, dof: 6, installed_date: '2022-11-05',
    total_operating_hours: 2550, service_interval_hours: 2000, last_service_hours: 1200 },

  { name: 'Cobot UR10e', model: 'UR10e', manufacturer: 'Universal Robots', serial_number: 'UR-UR10E-0005',
    category: 'Collaborative', location: 'Bay C1', status: 'maintenance',
    payload_kg: 12.5, reach_mm: 1300, dof: 6, installed_date: '2020-06-18',
    total_operating_hours: 5120, service_interval_hours: 2000, last_service_hours: 3200 },

  { name: 'Welding Arm GP8', model: 'Motoman GP8', manufacturer: 'Yaskawa', serial_number: 'YAS-GP8-0006',
    category: '6-DOF Articulated', location: 'Bay C2', status: 'free',
    payload_kg: 8, reach_mm: 727, dof: 6, installed_date: '2021-02-01',
    total_operating_hours: 3900, service_interval_hours: 2000, last_service_hours: 2200 },

  { name: 'Assembly SCARA', model: 'LS6-B', manufacturer: 'Epson', serial_number: 'EPS-LS6B-0007',
    category: 'SCARA', location: 'Bay D1', status: 'free',
    payload_kg: 6, reach_mm: 600, dof: 4, installed_date: '2023-07-12',
    total_operating_hours: 300, service_interval_hours: 1500, last_service_hours: 0 },

  { name: 'Sorting SCARA', model: 'i4-650H', manufacturer: 'Omron', serial_number: 'OMR-I4-0008',
    category: 'SCARA', location: 'Bay D2', status: 'offline',
    payload_kg: 5, reach_mm: 650, dof: 4, installed_date: '2022-05-30',
    total_operating_hours: 2760, service_interval_hours: 1500, last_service_hours: 1500 },

  { name: 'FlexPicker Delta', model: 'IRB 360', manufacturer: 'ABB', serial_number: 'ABB-IRB360-0009',
    category: 'Delta', location: 'Bay E1', status: 'free',
    payload_kg: 1, reach_mm: 1130, dof: 4, installed_date: '2023-01-25',
    total_operating_hours: 980, service_interval_hours: 2500, last_service_hours: 0 },

  { name: 'Lab Arm Gamma', model: 'KR 10 R1100', manufacturer: 'KUKA', serial_number: 'KUKA-KR10-0010',
    category: '6-DOF Articulated', location: 'Bay E2', status: 'in_use',
    payload_kg: 10, reach_mm: 1101, dof: 6, installed_date: '2021-12-03',
    total_operating_hours: 1760, service_interval_hours: 2000, last_service_hours: 0 },

  { name: 'Cobot Doosan', model: 'M0609', manufacturer: 'Doosan', serial_number: 'DSN-M0609-0011',
    category: 'Collaborative', location: 'Bay F1', status: 'free',
    payload_kg: 6, reach_mm: 900, dof: 6, installed_date: '2023-09-14',
    total_operating_hours: 210, service_interval_hours: 2000, last_service_hours: 0 },

  { name: 'Gantry Cartesian', model: 'XY-GANTRY-500', manufacturer: 'Igus', serial_number: 'IGS-GAN500-0012',
    category: 'Cartesian/Gantry', location: 'Bay F2', status: 'free',
    payload_kg: 4, reach_mm: 500, dof: 3, installed_date: '2022-08-22',
    total_operating_hours: 1540, service_interval_hours: 3000, last_service_hours: 0 }
];

function wipe() {
  db.exec(`
    DELETE FROM maintenance_logs;
    DELETE FROM reservations;
    DELETE FROM robots;
    DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);
}

function seedDatabase({ reset = false } = {}) {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (existing > 0 && !reset) return false; // already populated
  if (reset) wipe();

  // --- users ---
  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)'
  );
  const userIds = {};
  for (const u of USERS) {
    const { salt, hash } = hashPassword(u.password);
    const info = insertUser.run(u.name, u.email, hash, salt, u.role);
    userIds[u.email] = Number(info.lastInsertRowid);
  }

  // --- robots ---
  const insertRobot = db.prepare(`
    INSERT INTO robots
      (name, model, manufacturer, serial_number, category, location, status,
       payload_kg, reach_mm, dof, installed_date, total_operating_hours,
       service_interval_hours, last_service_hours, wear_level, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const robotIds = {};
  for (const r of ROBOTS) {
    const wear = computeWear(r.total_operating_hours, r.last_service_hours, r.service_interval_hours);
    const info = insertRobot.run(
      r.name, r.model, r.manufacturer, r.serial_number, r.category, r.location, r.status,
      r.payload_kg, r.reach_mm, r.dof, r.installed_date, r.total_operating_hours,
      r.service_interval_hours, r.last_service_hours, wear, null
    );
    robotIds[r.serial_number] = Number(info.lastInsertRowid);
  }

  // --- active reservations for the robots marked in_use ---
  const insertRes = db.prepare(`
    INSERT INTO reservations (robot_id, user_id, purpose, expected_hours, status, start_time)
    VALUES (?, ?, ?, ?, ?, datetime('now', ?))
  `);
  insertRes.run(robotIds['ABB-IRB120-0002'], userIds['aaron@rmms.io'],
    'Pick-and-place lab experiment', 2, 'active', '-1 hours');
  insertRes.run(robotIds['UR-UR5E-0004'], userIds['priya@rmms.io'],
    'Human-robot collaboration study', 3, 'active', '-30 minutes');
  insertRes.run(robotIds['KUKA-KR10-0010'], userIds['karthik@rmms.io'],
    'Trajectory planning coursework', 1.5, 'active', '-2 hours');

  // --- a few completed reservations (history) ---
  insertRes.run(robotIds['KUKA-KR6-0001'], userIds['aaron@rmms.io'],
    'Gripper calibration', 1, 'completed', '-3 days');
  insertRes.run(robotIds['FANUC-LR200-0003'], userIds['priya@rmms.io'],
    'Vision-guided sorting', 2, 'completed', '-5 days');

  // --- maintenance history ---
  const insertMaint = db.prepare(`
    INSERT INTO maintenance_logs (robot_id, technician_id, type, description, hours_at_service, cost, resets_wear, performed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);
  const adminId = userIds['admin@rmms.io'];
  insertMaint.run(robotIds['UR-UR10E-0005'], adminId, 'Corrective',
    'Replaced joint 3 harmonic drive; robot taken offline pending calibration.', 5120, 18500, 0, '-1 days');
  insertMaint.run(robotIds['ABB-IRB120-0002'], adminId, 'Preventive',
    'Scheduled 2000-hour service: lubrication and belt tension check.', 2000, 4200, 1, '-40 days');
  insertMaint.run(robotIds['YAS-GP8-0006'], adminId, 'Calibration',
    'TCP recalibration after tool change.', 2200, 1500, 1, '-20 days');

  return true;
}

module.exports = { seedDatabase };

// Allow running as a standalone script.
if (require.main === module) {
  const reset = process.argv.includes('--reset');
  const did = seedDatabase({ reset });
  console.log(did ? `Database seeded${reset ? ' (reset)' : ''}.` : 'Database already contains data — use --reset to overwrite.');
}
