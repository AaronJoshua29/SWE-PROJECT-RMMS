# 🤖 Robot Manipulator Management System (RMMS)

A web-based management system to **monitor, reserve and maintain robotic manipulators**
in a shared laboratory. RMMS gives a lab a single dashboard showing every connected
robot, whether each one is **free or in use**, its **wear level** and full technical
details, with separate **user** and **administrator** roles.

> Software Engineering Project — **Aaron Joshua (24BRS1393)**, VIT Chennai.

---

## ✨ Features

- **Live dashboard** — fleet counts (free / in use / maintenance / offline), average wear,
  utilisation, wear distribution, robots by category and a "service priority" list.
- **Robot fleet** — searchable, filterable grid of robots with status pills and wear bars.
- **Robot details** — manufacturer, model, serial, payload, reach, DOF, operating hours,
  service interval, wear level and complete maintenance history.
- **Reservation workflow** — a user reserves a *free* robot (it becomes *in use*), then
  releases it and logs the hours used; the system adds those hours and **recomputes wear**.
- **Maintenance logging (admin)** — record preventive/corrective/calibration work and
  optionally **reset the wear clock**.
- **Role-based access** — standard users browse and reserve; admins manage the fleet and users.
- **Secure auth** — passwords hashed with scrypt + per-user salt; stateless signed session tokens.

## 🧱 Tech stack

| Layer | Technology |
|------|------------|
| Frontend | HTML5, CSS3, vanilla JavaScript (single-page app) |
| Backend | Node.js, Express.js (REST API) |
| Database | SQLite (Node's built-in `node:sqlite` driver) |
| Auth | scrypt password hashing, HMAC-SHA256 signed tokens |
| Testing | Node's built-in test runner (`node:test`) |

No native build tools and only one runtime dependency (Express) — it runs anywhere Node 22.5+ is installed.

## 🚀 Getting started

### Prerequisites
- **Node.js 22.5 or newer** (uses the built-in SQLite module). Check with `node --version`.

### Install & run
```bash
# 1. install dependencies
npm install

# 2. (optional) seed / reset the sample lab fleet
npm run seed

# 3. start the server
npm start
```
Then open **http://localhost:3000** in your browser.

The database is created automatically at `data/rmms.db` and seeded with a sample fleet
on first launch.

### Demo accounts
| Role | Email | Password |
|------|-------|----------|
| Administrator | `admin@rmms.io` | `admin123` |
| User | `aaron@rmms.io` | `aaron123` |

> You can also register a new user account from the login screen.

## 🧪 Testing
```bash
npm test
```
Runs 14 unit + integration tests (wear model, auth, and the REST API including
reserve/release and role-based access control).

## 📡 REST API overview

| Method | Endpoint | Access | Description |
|-------|----------|--------|-------------|
| POST | `/api/auth/register` | public | Create a user account |
| POST | `/api/auth/login` | public | Obtain a session token |
| GET | `/api/auth/me` | auth | Current user profile |
| GET | `/api/robots` | auth | List / filter robots |
| GET | `/api/robots/:id` | auth | Robot + reservations + maintenance |
| POST | `/api/robots` | admin | Add robot |
| PUT | `/api/robots/:id` | admin | Update robot |
| DELETE | `/api/robots/:id` | admin | Delete robot |
| POST | `/api/robots/:id/reserve` | auth | Reserve a free robot |
| POST | `/api/robots/:id/release` | auth | Release & log hours |
| POST | `/api/robots/:id/maintenance` | admin | Log maintenance |
| GET | `/api/reservations?scope=` | auth | My / all reservations |
| GET | `/api/users` | admin | List users |
| PUT | `/api/users/:id/role` | admin | Change a role |
| DELETE | `/api/users/:id` | admin | Delete a user |
| GET | `/api/stats` | auth | Dashboard aggregates |

## 📂 Project structure
```
robot-manipulator-management-system/
├── server/
│   ├── index.js          # Express app entry point
│   ├── config.js         # configuration & thresholds
│   ├── db.js             # SQLite connection + schema
│   ├── auth.js           # hashing, tokens, middleware
│   ├── helpers.js        # wear model + validation
│   ├── seed.js           # sample data
│   └── routes/           # auth, robots, reservations, users, stats
├── public/               # frontend (index.html, css, js)
├── test/                 # automated tests
├── docs/                 # diagrams & screenshots
└── data/                 # SQLite database (created at runtime)
```

## 🧮 How wear is modelled
`wear% = clamp((operating_hours − last_service_hours) / service_interval × 100, 0, 100)`

A robot crosses **Warning** at 70% and **Critical** at 90%. Logging maintenance with
"reset wear" sets `last_service_hours` to the current operating hours, returning wear to 0.

## 📜 License
Released under the MIT License — see [LICENSE](LICENSE).
