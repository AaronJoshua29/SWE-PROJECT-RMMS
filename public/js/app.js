/* ============================================================
   RMMS frontend controller.
   Handles authentication, view routing, rendering and actions.
   ============================================================ */

const state = { user: null, lastRobotFilters: {} };

/* ---------- small utilities ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const STATUS_LABEL = { free: 'Free', in_use: 'In Use', maintenance: 'Maintenance', offline: 'Offline' };
const STATUS_COLOR = { free: 'var(--free)', in_use: 'var(--in-use)', maintenance: 'var(--maint)', offline: 'var(--offline)' };
const WEAR_COLOR = { healthy: 'var(--healthy)', warning: 'var(--warning)', critical: 'var(--critical)' };

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return esc(s);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function fmtDay(s) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? esc(s) : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function toast(msg, type = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = type === 'err' ? 'err show' : 'ok show';
  setTimeout(() => { t.className = t.className.replace('show', '').trim(); }, 3200);
}

/* ---------- modal ---------- */
function openModal(title, bodyHTML, footButtons = []) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHTML;
  const foot = $('#modalFoot');
  foot.innerHTML = '';
  footButtons.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = `btn ${b.class || ''}`;
    btn.textContent = b.label;
    btn.onclick = b.onClick;
    foot.appendChild(btn);
  });
  $('#modalBackdrop').classList.add('active');
}
function closeModal() { $('#modalBackdrop').classList.remove('active'); }

/* ============================================================
   Authentication
   ============================================================ */
let authMode = 'login';

function setAuthMode(mode) {
  authMode = mode;
  $('#tabLogin').classList.toggle('active', mode === 'login');
  $('#tabRegister').classList.toggle('active', mode === 'register');
  $('#nameField').style.display = mode === 'register' ? 'block' : 'none';
  $('#authSubmit').textContent = mode === 'register' ? 'Create account' : 'Sign in';
  $('#authError').textContent = '';
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  $('#authError').textContent = '';
  const email = $('#email').value.trim();
  const password = $('#password').value;
  const name = $('#name').value.trim();

  try {
    const payload = authMode === 'register' ? { name, email, password } : { email, password };
    const path = authMode === 'register' ? '/auth/register' : '/auth/login';
    const data = await API.post(path, payload);
    API.setToken(data.token);
    state.user = data.user;
    enterApp();
  } catch (err) {
    $('#authError').textContent = err.message;
  }
}

function enterApp() {
  $('#loginView').style.display = 'none';
  $('#appView').classList.add('active');

  const u = state.user;
  $('#userName').textContent = u.name;
  $('#userRole').textContent = u.role;
  $('#userRole').className = 'role-tag' + (u.role === 'admin' ? ' admin' : '');
  $('#userAvatar').textContent = (u.name || '?').charAt(0).toUpperCase();
  $('#adminNav').style.display = u.role === 'admin' ? 'block' : 'none';

  switchView('dashboard');
}

function logout() {
  API.setToken(null);
  state.user = null;
  $('#appView').classList.remove('active');
  $('#loginView').style.display = 'grid';
}

/* ============================================================
   Navigation
   ============================================================ */
const VIEW_TITLES = {
  dashboard: 'Dashboard', robots: 'Robot Fleet', reservations: 'Reservations',
  manage: 'Manage Fleet', users: 'User Management'
};

function switchView(name) {
  $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === name));
  $$('.view').forEach((v) => v.classList.remove('active'));
  $(`#view-${name}`).classList.add('active');
  $('#viewTitle').textContent = VIEW_TITLES[name] || name;

  if (name === 'dashboard') renderDashboard();
  if (name === 'robots') renderRobots();
  if (name === 'reservations') renderReservations();
  if (name === 'manage') renderManage();
  if (name === 'users') renderUsers();
}

/* ============================================================
   Dashboard
   ============================================================ */
async function renderDashboard() {
  const el = $('#view-dashboard');
  el.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const s = await API.get('/stats');
    const total = s.total || 1;
    const seg = ['free', 'in_use', 'maintenance', 'offline']
      .map((k) => `<span style="width:${(s.byStatus[k] / total) * 100}%; background:${STATUS_COLOR[k]}" title="${STATUS_LABEL[k]}: ${s.byStatus[k]}"></span>`)
      .join('');
    const legend = ['free', 'in_use', 'maintenance', 'offline']
      .map((k) => `<span><span class="dot" style="background:${STATUS_COLOR[k]}"></span>${STATUS_LABEL[k]} (${s.byStatus[k]})</span>`)
      .join('');

    const wearMax = Math.max(1, s.wearBands.healthy, s.wearBands.warning, s.wearBands.critical);
    const wearRows = [
      ['Healthy (<70%)', s.wearBands.healthy, 'var(--healthy)'],
      ['Warning (70–90%)', s.wearBands.warning, 'var(--warning)'],
      ['Critical (>90%)', s.wearBands.critical, 'var(--critical)']
    ].map(([label, val, color]) => `
      <div class="bar-row">
        <div>${label}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(val / wearMax) * 100}%; background:${color}"></div></div>
        <div style="text-align:right">${val}</div>
      </div>`).join('');

    const catMax = Math.max(1, ...s.byCategory.map((c) => c.c));
    const catRows = s.byCategory.map((c) => `
      <div class="bar-row">
        <div>${esc(c.category)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(c.c / catMax) * 100}%"></div></div>
        <div style="text-align:right">${c.c}</div>
      </div>`).join('');

    const topWear = s.topWear.map((r) => `
      <tr data-robot="${r.id}" style="cursor:pointer">
        <td>${esc(r.name)}<div style="color:var(--muted);font-size:12px">${esc(r.model)}</div></td>
        <td><span class="pill ${r.status}">${STATUS_LABEL[r.status]}</span></td>
        <td style="width:160px">
          <div class="bar-track"><div class="bar-fill" style="width:${r.wear_level}%; background:${r.wear_level >= 90 ? 'var(--critical)' : r.wear_level >= 70 ? 'var(--warning)' : 'var(--healthy)'}"></div></div>
        </td>
        <td style="text-align:right">${r.wear_level}%</td>
      </tr>`).join('');

    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat"><div class="label">Total Robots</div><div class="value">${s.total}</div><div class="accent"></div></div>
        <div class="stat"><div class="label">Available Now</div><div class="value" style="color:var(--free)">${s.byStatus.free}</div><div class="accent" style="background:var(--free)"></div></div>
        <div class="stat"><div class="label">In Use</div><div class="value" style="color:var(--in-use)">${s.byStatus.in_use}</div><div class="accent" style="background:var(--in-use)"></div></div>
        <div class="stat"><div class="label">Under Maintenance</div><div class="value" style="color:var(--maint)">${s.byStatus.maintenance}</div><div class="accent" style="background:var(--maint)"></div></div>
        <div class="stat"><div class="label">Avg. Wear</div><div class="value">${s.avgWear}<small>%</small></div><div class="accent" style="background:var(--warning)"></div></div>
        <div class="stat"><div class="label">Fleet Utilisation</div><div class="value">${s.utilisation}<small>%</small></div><div class="accent"></div></div>
      </div>

      <div class="panel">
        <h3>Fleet status</h3>
        <div class="segbar">${seg}</div>
        <div class="legend">${legend}</div>
      </div>

      <div class="panel-row">
        <div class="panel"><h3>Wear distribution</h3><div class="barchart">${wearRows}</div></div>
        <div class="panel"><h3>Robots by category</h3><div class="barchart">${catRows}</div></div>
      </div>

      <div class="panel">
        <h3>Service priority — highest wear</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Robot</th><th>Status</th><th>Wear</th><th style="text-align:right">%</th></tr></thead>
            <tbody>${topWear}</tbody>
          </table>
        </div>
      </div>`;

    $$('#view-dashboard tbody tr[data-robot]').forEach((tr) =>
      tr.addEventListener('click', () => openRobotDetail(tr.dataset.robot)));
  } catch (err) {
    el.innerHTML = `<div class="empty">Could not load dashboard: ${esc(err.message)}</div>`;
  }
}

/* ============================================================
   Robot fleet (browse)
   ============================================================ */
async function renderRobots() {
  const el = $('#view-robots');
  el.innerHTML = `
    <div class="toolbar">
      <input id="rSearch" type="text" placeholder="Search name, model, serial…" />
      <select id="rStatus">
        <option value="">All statuses</option>
        <option value="free">Free</option>
        <option value="in_use">In Use</option>
        <option value="maintenance">Maintenance</option>
        <option value="offline">Offline</option>
      </select>
      <select id="rCategory">
        <option value="">All categories</option>
        <option>6-DOF Articulated</option>
        <option>Collaborative</option>
        <option>SCARA</option>
        <option>Delta</option>
        <option>Cartesian/Gantry</option>
      </select>
      <div class="spacer"></div>
      <button class="btn" id="rExport">⬇ Export CSV</button>
    </div>
    <div id="robotGrid" class="robot-grid"></div>`;

  const run = () => loadRobotGrid({
    q: $('#rSearch').value.trim(),
    status: $('#rStatus').value,
    category: $('#rCategory').value
  });

  $('#rSearch').addEventListener('input', debounce(run, 250));
  $('#rStatus').addEventListener('change', run);
  $('#rCategory').addEventListener('change', run);
  $('#rExport').addEventListener('click', exportRobotsCSV);
  run();
}

/** Download the currently filtered fleet as a CSV file (client-side). */
function exportRobotsCSV() {
  const rows = state.lastRobots || [];
  if (!rows.length) { toast('No robots to export.', 'err'); return; }
  const cols = ['id', 'name', 'model', 'manufacturer', 'serial_number', 'category', 'location', 'status', 'wear_level'];
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'rmms-robots.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast(`Exported ${rows.length} robots to CSV.`);
}

function debounce(fn, ms) {
  let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}

async function loadRobotGrid(filters) {
  const grid = $('#robotGrid');
  grid.innerHTML = '<div class="empty">Loading…</div>';
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  try {
    const { robots } = await API.get(`/robots${qs ? '?' + qs : ''}`);
    state.lastRobots = robots;
    if (!robots.length) { grid.innerHTML = '<div class="empty">No robots match your filters.</div>'; return; }
    grid.innerHTML = robots.map(robotCardHTML).join('');
    $$('.robot-card', grid).forEach((c) => c.addEventListener('click', () => openRobotDetail(c.dataset.id)));
  } catch (err) {
    grid.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

function robotCardHTML(r) {
  const color = WEAR_COLOR[r.wear_band];
  return `
    <div class="robot-card" data-id="${r.id}">
      <div class="rc-head">
        <div>
          <div class="rc-name">${esc(r.name)}</div>
          <div class="rc-model">${esc(r.manufacturer)} · ${esc(r.model)}</div>
        </div>
        <span class="pill ${r.status}">${STATUS_LABEL[r.status]}</span>
      </div>
      <div class="rc-meta">
        <span>📍 ${esc(r.location)}</span>
        <span>🔧 ${esc(r.category)}</span>
      </div>
      <div class="wear">
        <div class="wlabel"><span>Wear</span><span>${r.wear_level}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${r.wear_level}%; background:${color}"></div></div>
      </div>
    </div>`;
}

/* ============================================================
   Robot detail modal (+ actions)
   ============================================================ */
async function openRobotDetail(id) {
  try {
    const data = await API.get(`/robots/${id}`);
    const r = data.robot;
    const isAdmin = state.user.role === 'admin';
    const active = data.activeReservation;
    // The button is a convenience; the server independently enforces that only
    // the reserving user or an admin may release a robot.
    const canRelease = active && (isAdmin || active.user_name === state.user.name);

    const details = `
      <div class="detail-grid">
        <div><div class="k">Manufacturer</div><div class="v">${esc(r.manufacturer)}</div></div>
        <div><div class="k">Model</div><div class="v">${esc(r.model)}</div></div>
        <div><div class="k">Serial number</div><div class="v">${esc(r.serial_number)}</div></div>
        <div><div class="k">Category</div><div class="v">${esc(r.category)}</div></div>
        <div><div class="k">Location</div><div class="v">${esc(r.location)}</div></div>
        <div><div class="k">Status</div><div class="v"><span class="pill ${r.status}">${STATUS_LABEL[r.status]}</span></div></div>
        <div><div class="k">Payload</div><div class="v">${r.payload_kg} kg</div></div>
        <div><div class="k">Reach</div><div class="v">${r.reach_mm} mm</div></div>
        <div><div class="k">Degrees of freedom</div><div class="v">${r.dof}</div></div>
        <div><div class="k">Installed</div><div class="v">${fmtDay(r.installed_date)}</div></div>
        <div><div class="k">Operating hours</div><div class="v">${r.total_operating_hours} h</div></div>
        <div><div class="k">Service interval</div><div class="v">${r.service_interval_hours} h</div></div>
      </div>
      <div class="k">Wear level — ${r.wear_level}% (${r.wear_band})</div>
      <div class="bar-track" style="margin-top:6px"><div class="bar-fill" style="width:${r.wear_level}%; background:${WEAR_COLOR[r.wear_band]}"></div></div>
      ${active ? `<p style="margin-top:14px;color:var(--muted);font-size:13px">In use by <b style="color:var(--text)">${esc(active.user_name)}</b> for “${esc(active.purpose)}” since ${fmtDate(active.start_time)}.</p>` : ''}

      <div class="section-title">Maintenance history (${data.maintenance.length})</div>
      ${data.maintenance.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Cost</th></tr></thead>
        <tbody>${data.maintenance.map((m) => `<tr>
          <td>${fmtDay(m.performed_at)}</td><td>${esc(m.type)}</td>
          <td>${esc(m.description)}</td><td>₹${Number(m.cost).toLocaleString()}</td>
        </tr>`).join('')}</tbody></table></div>` : '<div class="empty" style="padding:16px">No maintenance recorded.</div>'}`;

    const buttons = [];
    if (r.status === 'free') buttons.push({ label: '📥 Reserve', class: 'primary', onClick: () => reservePrompt(r) });
    if (canRelease) buttons.push({ label: '📤 Release', class: 'primary', onClick: () => releaseRobot(r) });
    if (isAdmin) {
      buttons.push({ label: '🔧 Log maintenance', class: '', onClick: () => maintenancePrompt(r) });
      buttons.push({ label: '✏️ Edit', class: '', onClick: () => robotFormModal(r) });
    }
    buttons.push({ label: 'Close', class: '', onClick: closeModal });

    openModal(`${r.name} — ${r.model}`, details, buttons);
  } catch (err) {
    toast(err.message, 'err');
  }
}

function reservePrompt(r) {
  const body = `
    <p style="color:var(--muted);font-size:13px;margin-top:0">Reserve <b style="color:var(--text)">${esc(r.name)}</b> and mark it as in use.</p>
    <label for="rvPurpose">Purpose</label>
    <input id="rvPurpose" type="text" placeholder="e.g. Pick-and-place experiment" />
    <label for="rvHours">Expected usage (hours)</label>
    <input id="rvHours" type="number" min="0.5" step="0.5" value="1" />`;
  openModal('Reserve robot', body, [
    { label: 'Cancel', onClick: closeModal },
    { label: 'Confirm reservation', class: 'primary', onClick: async () => {
      try {
        await API.post(`/robots/${r.id}/reserve`, {
          purpose: $('#rvPurpose').value.trim() || 'General use',
          expected_hours: Number($('#rvHours').value) || 1
        });
        closeModal(); toast('Robot reserved.'); refreshCurrentView();
      } catch (err) { toast(err.message, 'err'); }
    } }
  ]);
}

async function releaseRobot(r) {
  const body = `
    <p style="color:var(--muted);font-size:13px;margin-top:0">Check <b style="color:var(--text)">${esc(r.name)}</b> back in. The hours you log are added to its operating time and wear.</p>
    <label for="rlHours">Actual hours used</label>
    <input id="rlHours" type="number" min="0" step="0.5" value="1" />`;
  openModal('Release robot', body, [
    { label: 'Cancel', onClick: closeModal },
    { label: 'Confirm release', class: 'primary', onClick: async () => {
      try {
        await API.post(`/robots/${r.id}/release`, { logged_hours: Number($('#rlHours').value) || 0 });
        closeModal(); toast('Robot released.'); refreshCurrentView();
      } catch (err) { toast(err.message, 'err'); }
    } }
  ]);
}

function maintenancePrompt(r) {
  const body = `
    <label for="mtType">Type</label>
    <select id="mtType">
      <option>Preventive</option><option>Corrective</option>
      <option>Calibration</option><option>Inspection</option>
    </select>
    <label for="mtDesc">Description</label>
    <textarea id="mtDesc" placeholder="Work performed…"></textarea>
    <div class="form-row">
      <div><label for="mtCost">Cost (₹)</label><input id="mtCost" type="number" min="0" value="0" /></div>
      <div><label for="mtReset">Reset wear clock?</label>
        <select id="mtReset"><option value="1">Yes — service done</option><option value="0">No — inspection only</option></select>
      </div>
    </div>`;
  openModal(`Log maintenance — ${esc(r.name)}`, body, [
    { label: 'Cancel', onClick: closeModal },
    { label: 'Save log', class: 'primary', onClick: async () => {
      const description = $('#mtDesc').value.trim();
      if (!description) return toast('Description is required.', 'err');
      try {
        await API.post(`/robots/${r.id}/maintenance`, {
          type: $('#mtType').value, description,
          cost: Number($('#mtCost').value) || 0, resets_wear: $('#mtReset').value === '1'
        });
        closeModal(); toast('Maintenance logged.'); refreshCurrentView();
      } catch (err) { toast(err.message, 'err'); }
    } }
  ]);
}

/* ============================================================
   Reservations
   ============================================================ */
async function renderReservations() {
  const el = $('#view-reservations');
  const isAdmin = state.user.role === 'admin';
  el.innerHTML = `
    <div class="toolbar">
      ${isAdmin ? `<select id="resScope"><option value="mine">My reservations</option><option value="all">All reservations</option></select>` : ''}
      <div class="spacer"></div>
    </div>
    <div id="resTable"></div>`;
  const load = async () => {
    const scope = isAdmin ? $('#resScope').value : 'mine';
    const wrap = $('#resTable');
    wrap.innerHTML = '<div class="empty">Loading…</div>';
    try {
      const { reservations } = await API.get(`/reservations?scope=${scope}`);
      if (!reservations.length) { wrap.innerHTML = '<div class="empty">No reservations yet.</div>'; return; }
      wrap.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>Robot</th>${scope === 'all' ? '<th>User</th>' : ''}<th>Purpose</th><th>Start</th><th>End</th><th>Hours</th><th>Status</th></tr></thead>
        <tbody>${reservations.map((r) => `<tr>
          <td>${esc(r.robot_name)}<div style="color:var(--muted);font-size:12px">${esc(r.robot_model)}</div></td>
          ${scope === 'all' ? `<td>${esc(r.user_name)}</td>` : ''}
          <td>${esc(r.purpose || '—')}</td>
          <td>${fmtDate(r.start_time)}</td>
          <td>${r.end_time ? fmtDate(r.end_time) : '—'}</td>
          <td>${r.logged_hours != null ? r.logged_hours : r.expected_hours}</td>
          <td><span class="pill ${r.status === 'active' ? 'in_use' : r.status === 'completed' ? 'free' : 'offline'}">${r.status}</span></td>
        </tr>`).join('')}</tbody></table></div>`;
    } catch (err) { wrap.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  };
  if (isAdmin) $('#resScope').addEventListener('change', load);
  load();
}

/* ============================================================
   Admin — manage fleet
   ============================================================ */
async function renderManage() {
  const el = $('#view-manage');
  el.innerHTML = `
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn primary" id="addRobotBtn">➕ Add robot</button>
    </div>
    <div id="manageTable"><div class="empty">Loading…</div></div>`;
  $('#addRobotBtn').addEventListener('click', () => robotFormModal(null));

  try {
    const { robots } = await API.get('/robots');
    $('#manageTable').innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Model</th><th>Serial</th><th>Status</th><th>Wear</th><th>Hours</th><th></th></tr></thead>
      <tbody>${robots.map((r) => `<tr>
        <td>${esc(r.name)}</td><td>${esc(r.manufacturer)} ${esc(r.model)}</td><td>${esc(r.serial_number)}</td>
        <td><span class="pill ${r.status}">${STATUS_LABEL[r.status]}</span></td>
        <td>${r.wear_level}%</td><td>${r.total_operating_hours} h</td>
        <td style="white-space:nowrap;text-align:right">
          <button class="btn small" data-edit="${r.id}">Edit</button>
          <button class="btn small danger" data-del="${r.id}">Delete</button>
        </td>
      </tr>`).join('')}</tbody></table></div>`;

    $$('[data-edit]').forEach((b) => b.addEventListener('click', async () => {
      const { robot } = await API.get(`/robots/${b.dataset.edit}`);
      robotFormModal(robot);
    }));
    $$('[data-del]').forEach((b) => b.addEventListener('click', () => deleteRobot(b.dataset.del)));
  } catch (err) {
    $('#manageTable').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

function robotFormModal(robot) {
  const r = robot || {};
  const isEdit = !!robot;
  const opt = (v, cur) => `<option ${v === cur ? 'selected' : ''}>${v}</option>`;
  const body = `
    <div class="form-row">
      <div><label>Name</label><input id="f_name" value="${esc(r.name || '')}" /></div>
      <div><label>Serial number</label><input id="f_serial" value="${esc(r.serial_number || '')}" ${isEdit ? 'disabled' : ''} /></div>
    </div>
    <div class="form-row">
      <div><label>Manufacturer</label><input id="f_mfr" value="${esc(r.manufacturer || '')}" /></div>
      <div><label>Model</label><input id="f_model" value="${esc(r.model || '')}" /></div>
    </div>
    <div class="form-row">
      <div><label>Category</label><select id="f_cat">
        ${['6-DOF Articulated', 'Collaborative', 'SCARA', 'Delta', 'Cartesian/Gantry'].map((c) => opt(c, r.category)).join('')}
      </select></div>
      <div><label>Location</label><input id="f_loc" value="${esc(r.location || '')}" /></div>
    </div>
    <div class="form-row">
      <div><label>Status</label><select id="f_status">
        ${['free', 'in_use', 'maintenance', 'offline'].map((s) => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
      </select></div>
      <div><label>Payload (kg)</label><input id="f_payload" type="number" step="0.5" value="${r.payload_kg ?? 0}" /></div>
    </div>
    <div class="form-row">
      <div><label>Reach (mm)</label><input id="f_reach" type="number" value="${r.reach_mm ?? 0}" /></div>
      <div><label>Degrees of freedom</label><input id="f_dof" type="number" value="${r.dof ?? 6}" /></div>
    </div>
    <div class="form-row">
      <div><label>Total operating hours</label><input id="f_hours" type="number" value="${r.total_operating_hours ?? 0}" /></div>
      <div><label>Service interval (hours)</label><input id="f_interval" type="number" value="${r.service_interval_hours ?? 2000}" /></div>
    </div>
    <label>Installed date</label><input id="f_installed" type="date" value="${esc((r.installed_date || '').slice(0, 10))}" />`;

  openModal(isEdit ? `Edit ${esc(r.name)}` : 'Add robot', body, [
    { label: 'Cancel', onClick: closeModal },
    { label: isEdit ? 'Save changes' : 'Create robot', class: 'primary', onClick: async () => {
      const payload = {
        name: $('#f_name').value.trim(), model: $('#f_model').value.trim(),
        manufacturer: $('#f_mfr').value.trim(), category: $('#f_cat').value,
        location: $('#f_loc').value.trim(), status: $('#f_status').value,
        payload_kg: Number($('#f_payload').value), reach_mm: Number($('#f_reach').value),
        dof: Number($('#f_dof').value), total_operating_hours: Number($('#f_hours').value),
        service_interval_hours: Number($('#f_interval').value), installed_date: $('#f_installed').value || null
      };
      if (!isEdit) payload.serial_number = $('#f_serial').value.trim();
      try {
        if (isEdit) await API.put(`/robots/${r.id}`, payload);
        else await API.post('/robots', payload);
        closeModal(); toast(isEdit ? 'Robot updated.' : 'Robot added.'); renderManage();
      } catch (err) { toast(err.message, 'err'); }
    } }
  ]);
}

function deleteRobot(id) {
  openModal('Delete robot', '<p>This permanently removes the robot and its history. Continue?</p>', [
    { label: 'Cancel', onClick: closeModal },
    { label: 'Delete', class: 'danger', onClick: async () => {
      try { await API.del(`/robots/${id}`); closeModal(); toast('Robot deleted.'); renderManage(); }
      catch (err) { toast(err.message, 'err'); }
    } }
  ]);
}

/* ============================================================
   Admin — users
   ============================================================ */
async function renderUsers() {
  const el = $('#view-users');
  el.innerHTML = '<div id="usersTable"><div class="empty">Loading…</div></div>';
  try {
    const { users } = await API.get('/users');
    $('#usersTable').innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Reservations</th><th>Joined</th><th></th></tr></thead>
      <tbody>${users.map((u) => `<tr>
        <td>${esc(u.name)}</td><td>${esc(u.email)}</td>
        <td><span class="role-tag ${u.role === 'admin' ? 'admin' : ''}">${u.role}</span></td>
        <td>${u.reservation_count}</td><td>${fmtDay(u.created_at)}</td>
        <td style="white-space:nowrap;text-align:right">
          <button class="btn small" data-role="${u.id}" data-current="${u.role}">${u.role === 'admin' ? 'Make user' : 'Make admin'}</button>
          <button class="btn small danger" data-deluser="${u.id}">Delete</button>
        </td>
      </tr>`).join('')}</tbody></table></div>`;

    $$('[data-role]').forEach((b) => b.addEventListener('click', async () => {
      const newRole = b.dataset.current === 'admin' ? 'user' : 'admin';
      try { await API.put(`/users/${b.dataset.role}/role`, { role: newRole }); toast('Role updated.'); renderUsers(); }
      catch (err) { toast(err.message, 'err'); }
    }));
    $$('[data-deluser]').forEach((b) => b.addEventListener('click', () => {
      openModal('Delete user', '<p>Delete this user and all their reservations?</p>', [
        { label: 'Cancel', onClick: closeModal },
        { label: 'Delete', class: 'danger', onClick: async () => {
          try { await API.del(`/users/${b.dataset.deluser}`); closeModal(); toast('User deleted.'); renderUsers(); }
          catch (err) { toast(err.message, 'err'); }
        } }
      ]);
    }));
  } catch (err) {
    $('#usersTable').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

/* ---------- misc ---------- */
function refreshCurrentView() {
  const active = $('.nav-item.active');
  if (active) switchView(active.dataset.view);
}

/* ============================================================
   Boot
   ============================================================ */
function wireEvents() {
  $('#tabLogin').addEventListener('click', () => setAuthMode('login'));
  $('#tabRegister').addEventListener('click', () => setAuthMode('register'));
  $('#authForm').addEventListener('submit', handleAuthSubmit);
  $('#logoutBtn').addEventListener('click', logout);
  $('#showPwd').addEventListener('change', (e) => { $('#password').type = e.target.checked ? 'text' : 'password'; });
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', (e) => { if (e.target === $('#modalBackdrop')) closeModal(); });
  $$('.nav-item').forEach((n) => n.addEventListener('click', () => switchView(n.dataset.view)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

async function boot() {
  wireEvents();
  const token = API.getToken();
  if (token) {
    try {
      const { user } = await API.get('/auth/me');
      state.user = user;
      enterApp();
      return;
    } catch { API.setToken(null); }
  }
  $('#loginView').style.display = 'grid';
}

boot();
