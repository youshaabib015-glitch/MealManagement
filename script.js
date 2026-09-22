'use strict';

/* =========================================================
   MessPro — Bangladeshi Mess Management System
   script.js  ·  Vanilla JS + LocalStorage (no backend)
   ========================================================= */

/* ---------------- Helpers ---------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeId = v => String(v ?? '').replace(/[^\w-]/g, '');

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const monthOf   = iso => (iso || '').slice(0, 7);
const thisMonth = () => monthOf(todayISO());
function monthLabel(mk) {
  if (!mk || mk === 'all') return 'All Time';
  const [y, m] = mk.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function daysInMonth(mk) {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
function prevMonthKey(mk, n = 1) {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const inScope = (dateStr, scope) => scope === 'all' || monthOf(dateStr) === scope;

/* ---------------- Constants ---------------- */
const CATEGORIES = ['Rice', 'Oil', 'Chicken', 'Fish', 'Vegetables', 'Utilities', 'Others'];
const CAT_BN = { Rice: 'চাল', Oil: 'তেল', Chicken: 'মুরগি', Fish: 'মাছ', Vegetables: 'সবজি', Utilities: 'ইউটিলিটি', Others: 'অন্যান্য' };
const CAT_IC = { Rice: '🍚', Oil: '🛢️', Chicken: '🍗', Fish: '🐟', Vegetables: '🥦', Utilities: '💡', Others: '📦' };
const CAT_COLORS = ['#4f8cff', '#f59e0b', '#ef4444', '#22d3ee', '#22c55e', '#a78bfa', '#94a3b8'];
const PAGE_SIZE = 8;
const DB_KEY = 'messpro_db_v1';
const AUTH_KEY = 'messpro_auth_v1';
const PAGE_TITLES = {
  dashboard: 'Dashboard', members: 'Member Management', meals: 'Meal Entry', guests: 'Guest Meals',
  deposits: 'Deposits', expenses: 'Expenses', reports: 'Reports', settings: 'Settings'
};

/* ---------------- Database ---------------- */
function defaultDB() {
  return {
    settings: { messName: 'My Mess', managerName: 'Manager', password: 'admin123', theme: 'dark', currency: '৳' },
    members: [], meals: [], guestMeals: [], deposits: [], expenses: []
  };
}
let db = defaultDB();

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const base = defaultDB();
      db = {
        ...base, ...parsed,
        settings: { ...base.settings, ...(parsed.settings || {}) },
        members: parsed.members || [], meals: parsed.meals || [],
        guestMeals: parsed.guestMeals || [], deposits: parsed.deposits || [], expenses: parsed.expenses || []
      };
    }
  } catch (e) { db = defaultDB(); }
}
function saveDB() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    flashSaved();
    updateStorageInfo();
  } catch (e) { toast('Storage failed — data is full?', 'error'); }
}

/* ---------------- UI state ---------------- */
const ui = {
  page: 'dashboard',
  members:   { search: '', status: 'all', page: 1 },
  meals:     { date: todayISO(), view: 'daily', month: thisMonth() },
  guests:    { search: '', month: '', page: 1 },
  deposits:  { search: '', member: 'all', month: '', page: 1 },
  expenses:  { search: '', category: 'all', month: '', page: 1 },
  reports:   { type: 'monthly', scope: thisMonth() }
};
let lastReport = null;
let confirmResolver = null;

/* ---------------- Theme ---------------- */
function applyTheme() {
  document.documentElement.dataset.theme = db.settings.theme === 'light' ? 'light' : 'dark';
  const icon = $('#themeIcon');
  if (icon) icon.innerHTML = db.settings.theme === 'light'
    ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
    : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  const t = $('#settingsDarkToggle');
  if (t) t.checked = db.settings.theme !== 'light';
}
function toggleTheme() {
  db.settings.theme = db.settings.theme === 'light' ? 'dark' : 'light';
  applyTheme(); saveDB();
  if (ui.page === 'dashboard') renderDashboard();
}

/* ---------------- Flash / toast / confirm / modal ---------------- */
let flashTimer = null;
function flashSaved() {
  const el = $('#savedFlash');
  if (!el) return;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 1300);
}
function toast(msg, type = 'success') {
  const box = $('#toastContainer');
  if (!box) return;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="t-ic">${icons[type] || 'ℹ'}</span><span>${esc(msg)}</span>`;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 3000);
}
function openModal(id) { const m = $('#' + id); if (m) { m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); } }
function closeModal(id) {
  const m = $('#' + id);
  if (m) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); }
  if (id === 'confirmModal' && confirmResolver) { confirmResolver(false); confirmResolver = null; }
}
function confirmDialog(message, title = 'Are you sure?') {
  return new Promise(resolve => {
    $('#confirmTitle').textContent = title;
    $('#confirmMessage').textContent = message;
    confirmResolver = resolve;
    openModal('confirmModal');
  });
}

/* ---------------- Auth ---------------- */
function isAuthed() { return localStorage.getItem(AUTH_KEY) === '1' || sessionStorage.getItem(AUTH_KEY) === '1'; }
function showLogin() {
  $('#loginScreen').classList.remove('hidden');
  $('#app').classList.add('hidden');
  $('#defaultHint').classList.toggle('hidden', db.settings.password !== 'admin123');
  setTimeout(() => $('#loginPassword')?.focus(), 120);
}
function enterApp() {
  $('#loginScreen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  const name = db.settings.managerName || 'Manager';
  $('#managerNameTop').textContent = name;
  $('#avatarLetter').textContent = (name.trim()[0] || 'M').toUpperCase();
  $('#sideMessName').textContent = db.settings.messName || 'My Mess';
  go('dashboard');
}
function logout(ask = true) {
  const doIt = () => {
    localStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(AUTH_KEY);
    $('#loginPassword').value = '';
    showLogin(); toast('Logged out', 'info');
  };
  if (!ask) return doIt();
  confirmDialog('You will be returned to the login screen.', 'Logout?').then(ok => ok && doIt());
}
function changePassword(current, next) {
  if (current !== db.settings.password) return 'Current password is incorrect.';
  if (!next || next.length < 4) return 'New password must be at least 4 characters.';
  db.settings.password = next; saveDB();
  return null;
}

/* ---------------- Lookups ---------------- */
const memberById = id => db.members.find(m => m.id === id);
const memberName = id => (memberById(id) || {}).name || '(removed member)';
const activeMembers = () => db.members.filter(m => m.status === 'active');

function mealCountOf(rec) { return rec ? num(rec.breakfast) + num(rec.lunch) + num(rec.dinner) : 0; }
function memberMeals(id, scope = 'all') {
  return db.meals.filter(m => m.memberId === id && inScope(m.date, scope)).reduce((s, m) => s + mealCountOf(m), 0);
}
function memberMealParts(id, scope) {
  return db.meals.filter(m => m.memberId === id && inScope(m.date, scope))
    .reduce((a, m) => ({ b: a.b + num(m.breakfast), l: a.l + num(m.lunch), d: a.d + num(m.dinner) }),
            { b: 0, l: 0, d: 0 });
}
function memberGuestMeals(id, scope = 'all') {
  return db.guestMeals.filter(g => g.memberId === id && inScope(g.date, scope)).reduce((s, g) => s + num(g.count), 0);
}
function memberDeposits(id, scope = 'all') {
  return db.deposits.filter(d => d.memberId === id && inScope(d.date, scope)).reduce((s, d) => s + num(d.amount), 0);
}
function monthsInScope(scope) {
  if (scope !== 'all') return 1;
  const set = new Set();
  [...db.meals.map(x => x.date), ...db.deposits.map(x => x.date), ...db.expenses.map(x => x.date), ...db.guestMeals.map(x => x.date)]
    .forEach(d => d && set.add(monthOf(d)));
  if (!set.size) db.members.forEach(m => m.joined && set.add(monthOf(m.joined)));
  return Math.max(1, set.size);
}
function allMonths() {
  const set = new Set();
  [...db.meals.map(x => x.date), ...db.deposits.map(x => x.date), ...db.expenses.map(x => x.date), ...db.guestMeals.map(x => x.date)]
    .forEach(d => d && set.add(monthOf(d)));
  set.add(thisMonth());
  return Array.from(set).sort().reverse();
}

/* ---------------- Core calculations ---------------- */
function computeStats(scope = 'all') {
  const meals = db.meals.filter(m => inScope(m.date, scope));
  const memberMealsTotal = meals.reduce((s, m) => s + mealCountOf(m), 0);
  const guests = db.guestMeals.filter(g => inScope(g.date, scope));
  const guestMealsTotal = guests.reduce((s, g) => s + num(g.count), 0);
  const expenses = db.expenses.filter(e => inScope(e.date, scope));
  const totalExpenses = expenses.reduce((s, e) => s + num(e.amount), 0);
  const deposits = db.deposits.filter(d => inScope(d.date, scope));
  const totalDeposits = deposits.reduce((s, d) => s + num(d.amount), 0);
  const totalMeals = memberMealsTotal + guestMealsTotal;
  const rate = totalMeals > 0 ? totalExpenses / totalMeals : 0;
  return {
    memberMeals: memberMealsTotal, guestMeals: guestMealsTotal, totalMeals,
    totalExpenses, totalDeposits, rate,
    balance: totalDeposits - totalExpenses,
    expenseCount: expenses.length, depositCount: deposits.length, guestCount: guests.length
  };
}
function money(n) {
  const c = db.settings.currency || '৳';
  const v = num(n);
  const neg = v < -0.004;
  const abs = Math.abs(v);
  const dec = Math.abs(abs % 1) > 0.004 ? 2 : 0;
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return `${neg ? '-' : ''}${c} ${s}`;
}
const rateMoney = n => `${db.settings.currency || '৳'} ${num(n).toFixed(2)}`;

/* ---------------- Router ---------------- */
function go(page) {
  ui.page = page;
  $$('.page').forEach(p => p.classList.add('hidden'));
  const el = $('#page-' + page);
  if (el) el.classList.remove('hidden');
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  $('#pageTitle').textContent = PAGE_TITLES[page] || page;
  closeSidebar();
  renderPage(page);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderPage(page = ui.page) {
  ({
    dashboard: renderDashboard, members: renderMembers, meals: renderMeals, guests: renderGuests,
    deposits: renderDeposits, expenses: renderExpenses, reports: renderReports, settings: renderSettings
  }[page] || (() => {}))();
}
function refresh() { saveDB(); renderPage(); }

/* ---------------- Pagination ---------------- */
function pageSlice(arr, page) {
  const pages = Math.max(1, Math.ceil(arr.length / PAGE_SIZE));
  const p = Math.min(Math.max(1, page), pages);
  return { slice: arr.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE), page: p, pages, total: arr.length };
}
function paginationHTML(key, page, pages) {
  if (pages <= 1) return '';
  const nums = [];
  for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
  let h = `<button class="pg-btn" data-pgkey="${key}" data-pg="${page - 1}" ${page === 1 ? 'disabled' : ''}>‹</button>`;
  nums.forEach((n, k) => {
    if (k > 0 && n - nums[k - 1] > 1) h += `<span class="pg-dots">…</span>`;
    h += `<button class="pg-btn ${n === page ? 'active' : ''}" data-pgkey="${key}" data-pg="${n}">${n}</button>`;
  });
  h += `<button class="pg-btn" data-pgkey="${key}" data-pg="${page + 1}" ${page === pages ? 'disabled' : ''}>›</button>`;
  return h;
}
function footInfo(from, to, total) { return total ? `Showing ${from}–${to} of ${total}` : 'No records found'; }
const emptyRow = (cols, msg) => `<tr><td colspan="${cols}"><div class="empty-note">${msg}</div></td></tr>`;

/* ---------------- Select options ---------------- */
function memberOptions(selected = '', includeAll = false) {
  let h = includeAll ? '<option value="all">All Members</option>' : '';
  if (!includeAll && !db.members.length) h += '<option value="" disabled selected>Add a member first</option>';
  db.members.forEach(m => {
    h += `<option value="${m.id}" ${m.id === selected ? 'selected' : ''}>${esc(m.name)}${m.room ? ' · Room ' + esc(m.room) : ''}</option>`;
  });
  return h;
}
function fillMemberSelects() {
  const gm = $('#guestMember'); if (gm) { const v = gm.value; gm.innerHTML = memberOptions(v || (db.members[0] || {}).id); }
  const dm = $('#depositMember'); if (dm) { const v = dm.value; dm.innerHTML = memberOptions(v || (db.members[0] || {}).id); }
  const df = $('#depositMemberFilter'); if (df) { const v = df.value || 'all'; df.innerHTML = memberOptions(v, true); }
}
function fillCategorySelects() {
  const cats = Array.from(new Set([...CATEGORIES, ...db.expenses.map(e => e.category).filter(Boolean)]));
  const ef = $('#expenseCategoryFilter');
  if (ef) { const v = ef.value || 'all'; ef.innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join(''); ef.value = v; }
  const ec = $('#expenseCategory');
  if (ec) { const v = ec.value; ec.innerHTML = cats.map(c => `<option value="${esc(c)}">${esc(c)} — ${CAT_BN[c] || ''}</option>`).join(''); if (v) ec.value = v; }
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function statCard(o) {
  return `<div class="stat-card ${o.cls || ''}">
    <span class="ic">${o.icon}</span>
    <div class="lbl">${o.label}</div>
    <div class="bn">${o.bn || ''}</div>
    <div class="val">${o.value}</div>
    ${o.delta ? `<div class="delta">${o.delta}</div>` : ''}
  </div>`;
}
function renderDashboard() {
  const all = computeStats('all');
  const mk = thisMonth();
  const mon = computeStats(mk);

  $('#dashMonthLabel').textContent = monthLabel(mk);
  $('#navMembersCount').textContent = db.members.length;
  $('#sideBalance').textContent = money(all.balance);

  $('#mainStats').innerHTML = [
    statCard({ icon: '👥', label: 'Total Members', bn: 'মোট সদস্য', value: db.members.length, cls: 'c-accent', delta: `${activeMembers().length} active · ${db.members.length - activeMembers().length} inactive` }),
    statCard({ icon: '🍚', label: 'Total Meals', bn: 'মোট মিল', value: all.memberMeals.toLocaleString('en-US'), cls: 'c-cyan', delta: `${all.totalMeals.toLocaleString('en-US')} incl. guests` }),
    statCard({ icon: '🍗', label: 'Guest Meals', bn: 'গেস্ট মিল', value: all.guestMeals.toLocaleString('en-US'), cls: 'c-purple', delta: `${all.guestCount} guest entries` }),
    statCard({ icon: '💰', label: 'Total Deposits', bn: 'মোট ডিপোজিট', value: money(all.totalDeposits), cls: 'c-green', delta: `${all.depositCount} transactions` }),
    statCard({ icon: '🧾', label: 'Total Expenses', bn: 'মোট খরচ', value: money(all.totalExpenses), cls: 'c-red', delta: `${all.expenseCount} expense entries` }),
    statCard({ icon: '🍽️', label: 'Current Meal Rate', bn: 'বর্তমান মিল রেট', value: rateMoney(all.rate), cls: 'c-amber', delta: 'Expenses ÷ Total Meals' }),
    statCard({ icon: '📊', label: 'Current Balance', bn: 'বর্তমান ব্যালেন্স', value: money(all.balance), cls: all.balance >= 0 ? 'c-green' : 'c-red', delta: 'Deposits − Expenses' })
  ].join('');

  $('#monthStats').innerHTML = [
    statCard({ icon: '🍚', label: 'Meals This Month', bn: 'এ মাসের মিল', value: mon.memberMeals.toLocaleString('en-US'), cls: 'c-cyan' }),
    statCard({ icon: '🍗', label: 'Guest Meals', bn: 'গেস্ট মিল', value: mon.guestMeals, cls: 'c-purple' }),
    statCard({ icon: '💰', label: 'Deposits', bn: 'ডিপোজিট', value: money(mon.totalDeposits), cls: 'c-green' }),
    statCard({ icon: '🧾', label: 'Expenses', bn: 'খরচ', value: money(mon.totalExpenses), cls: 'c-red' }),
    statCard({ icon: '🍽️', label: 'Monthly Meal Rate', bn: 'মাসিক মিল রেট', value: rateMoney(mon.rate), cls: 'c-amber' }),
    statCard({ icon: '📈', label: 'Net This Month', bn: 'এ মাসের নেট', value: money(mon.balance), cls: mon.balance >= 0 ? 'c-green' : 'c-red' })
  ].join('');

  renderActivity();
  if (ui.page === 'dashboard') renderCharts();
}

function renderActivity() {
  const items = [
    ...db.deposits.map(d => ({ date: d.date, icon: '💰', title: memberName(d.memberId), sub: 'Deposit', amt: money(d.amount), cls: 'pos' })),
    ...db.expenses.map(e => ({ date: e.date, icon: CAT_IC[e.category] || '🧾', title: e.category + (e.note ? ' · ' + e.note : ''), sub: 'Expense', amt: money(e.amount), cls: 'neg' })),
    ...db.guestMeals.map(g => ({ date: g.date, icon: '🍗', title: g.guestName + ' (' + g.count + ' meals)', sub: 'Guest · ' + memberName(g.memberId), amt: '', cls: '' }))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 7);

  $('#recentActivity').innerHTML = items.length ? items.map(i => `
    <div class="activity-row">
      <span class="a-ic">${i.icon}</span>
      <div class="a-main"><b>${esc(i.title)}</b><small>${esc(i.sub)} · ${fmtDate(i.date)}</small></div>
      <span class="a-amt amount ${i.cls}">${i.amt}</span>
    </div>`).join('') : '<div class="empty-note">No activity yet. Add members, meals, deposits or expenses to get started.</div>';
}

/* ---------------- Charts ---------------- */
let charts = { meals: null, money: null, expense: null };
function lastMonths(n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(prevMonthKey(thisMonth(), i)); return out; }
function shortLabel(mk) {
  const [y, m] = mk.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'short' }) + ' ' + y.slice(2);
}
function showChartFallback(show) {
  $$('.chart-box').forEach(box => {
    const c = box.querySelector('canvas'), f = box.querySelector('.chart-fallback');
    if (c) c.classList.toggle('hidden', show);
    if (f) f.classList.toggle('hidden', !show);
  });
}
function renderCharts() {
  if (typeof Chart === 'undefined') { showChartFallback(true); return; }
  showChartFallback(false);
  Chart.defaults.color = 'rgba(160,172,205,.9)';
  Chart.defaults.borderColor = 'rgba(150,165,205,.14)';
  Chart.defaults.font.family = "'Segoe UI', Inter, system-ui, sans-serif";

  const months = lastMonths(6);
  const labels = months.map(shortLabel);

  const mealData = months.map(mk => computeStats(mk).memberMeals);
  const guestData = months.map(mk => computeStats(mk).guestMeals);
  const depData = months.map(mk => computeStats(mk).totalDeposits);
  const expData = months.map(mk => computeStats(mk).totalExpenses);

  Object.values(charts).forEach(c => { try { c && c.destroy(); } catch (e) {} });

  charts.meals = new Chart($('#chartMeals'), {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Member Meals', data: mealData, backgroundColor: 'rgba(79,140,255,.85)', borderRadius: 7, maxBarThickness: 34 },
      { label: 'Guest Meals', data: guestData, backgroundColor: 'rgba(167,139,250,.85)', borderRadius: 7, maxBarThickness: 34 }
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }
  });

  charts.money = new Chart($('#chartMoney'), {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Deposits', data: depData, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.16)', fill: true, tension: .38, pointRadius: 4, pointBackgroundColor: '#22c55e' },
      { label: 'Expenses', data: expData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.14)', fill: true, tension: .38, pointRadius: 4, pointBackgroundColor: '#ef4444' }
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true }, x: { grid: { display: false } } } }
  });

  const totals = CATEGORIES.map(c => db.expenses.filter(e => e.category === c).reduce((s, e) => s + num(e.amount), 0));
  const extras = Array.from(new Set(db.expenses.map(e => e.category).filter(c => c && !CATEGORIES.includes(c))));
  const extraTotals = extras.map(c => db.expenses.filter(e => e.category === c).reduce((s, e) => s + num(e.amount), 0));
  const doughLabels = [...CATEGORIES, ...extras];
  const doughData = [...totals, ...extraTotals];
  const anyExpense = doughData.some(v => v > 0);

  charts.expense = new Chart($('#chartExpense'), {
    type: 'doughnut',
    data: { labels: doughLabels, datasets: [{ data: doughData, backgroundColor: [...CAT_COLORS, ...extras.map((_, i) => CAT_COLORS[i % CAT_COLORS.length])], borderWidth: 0, hoverOffset: 10 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'right' },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${money(ctx.parsed)}` } }
      }
    },
    plugins: [{
      id: 'emptyCenter',
      afterDraw(chart) {
        if (anyExpense) return;
        const { ctx, chartArea } = chart;
        ctx.save();
        ctx.fillStyle = 'rgba(160,172,205,.85)';
        ctx.font = '600 14px Segoe UI'; ctx.textAlign = 'center';
        ctx.fillText('No expenses yet', (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2);
        ctx.restore();
      }
    }]
  });
}

/* =========================================================
   MEMBERS
   ========================================================= */
function filteredMembers() {
  const s = ui.members.search.toLowerCase().trim();
  const st = ui.members.status;
  return db.members.filter(m => {
    const hay = `${m.name} ${m.phone} ${m.room}`.toLowerCase();
    return (!s || hay.includes(s)) && (st === 'all' || m.status === st);
  });
}
function renderMembers() {
  fillMemberSelects();
  $('#navMembersCount').textContent = db.members.length;
  const list = filteredMembers();
  const { slice, page, pages, total } = pageSlice(list, ui.members.page);
  ui.members.page = page;

  $('#memberCountChip').textContent = `${total} member${total === 1 ? '' : 's'}`;
  $('#membersBody').innerHTML = total ? slice.map((m, i) => `
    <tr>
      <td>${(page - 1) * PAGE_SIZE + i + 1}</td>
      <td class="name-cell"><b>${esc(m.name)}</b><small>Joined ${fmtDate(m.joined)}</small></td>
      <td>${esc(m.phone || '—')}</td>
      <td>${esc(m.room || '—')}</td>
      <td class="amount">${money(m.seatRent)}</td>
      <td class="amount pos">${money(memberDeposits(m.id))}</td>
      <td>${memberMeals(m.id)}</td>
      <td>${m.status === 'active' ? '<span class="badge badge-ok">Active</span>' : '<span class="badge badge-off">Inactive</span>'}</td>
      <td class="no-print"><div class="row-actions">
        <button class="mini-btn" onclick="openMemberModal('${safeId(m.id)}')">Edit</button>
        <button class="mini-btn danger" onclick="deleteMember('${safeId(m.id)}')">Delete</button>
      </div></td>
    </tr>`).join('') : emptyRow(9, 'No members found. Click “+ Add Member” to create one.');

  $('#membersInfo').textContent = footInfo(total ? (page - 1) * PAGE_SIZE + 1 : 0, Math.min(page * PAGE_SIZE, total), total);
  $('#membersPagination').innerHTML = paginationHTML('members', page, pages);
}
function openMemberModal(id) {
  $('#memberForm').reset();
  $$('#memberForm input').forEach(i => i.classList.remove('invalid'));
  const m = id ? memberById(id) : null;
  $('#memberModalTitle').textContent = m ? 'Edit Member' : 'Add Member';
  $('#memberId').value = m ? m.id : '';
  $('#memberName').value = m ? m.name : '';
  $('#memberPhone').value = m ? (m.phone || '') : '';
  $('#memberRoom').value = m ? (m.room || '') : '';
  $('#memberSeatRent').value = m ? m.seatRent : '';
  $('#memberDeposit').value = m ? memberDeposits(m.id) : '';
  $('#memberJoined').value = m ? (m.joined || todayISO()) : todayISO();
  $('#memberStatus').value = m ? m.status : 'active';
  openModal('memberModal');
  setTimeout(() => $('#memberName').focus(), 120);
}
function saveMember(e) {
  e.preventDefault();
  const name = $('#memberName'), rent = $('#memberSeatRent');
  name.classList.toggle('invalid', !name.value.trim());
  rent.classList.toggle('invalid', num(rent.value) < 0 || rent.value === '');
  if (!name.value.trim()) { toast('Member name is required', 'error'); name.focus(); return; }
  if (rent.value === '' || num(rent.value) < 0) { toast('Enter a valid seat rent', 'error'); rent.focus(); return; }

  const id = $('#memberId').value;
  const data = {
    name: name.value.trim(), phone: $('#memberPhone').value.trim(), room: $('#memberRoom').value.trim(),
    seatRent: num(rent.value), status: $('#memberStatus').value, joined: $('#memberJoined').value || todayISO()
  };

  if (id) {
    const m = memberById(id);
    Object.assign(m, data);
    const desired = num($('#memberDeposit').value);
    const current = memberDeposits(id);
    if (Math.abs(desired - current) > 0.004) {
      db.deposits.push({ id: uid('dep'), memberId: id, amount: desired - current, date: todayISO(), note: 'Adjustment from member edit' });
    }
    toast('Member updated');
  } else {
    const nm = { id: uid('mem'), ...data };
    db.members.push(nm);
    const opening = num($('#memberDeposit').value);
    if (opening > 0) db.deposits.push({ id: uid('dep'), memberId: nm.id, amount: opening, date: nm.joined, note: 'Opening deposit' });
    toast('Member added');
  }
  closeModal('memberModal');
  refresh();
}
function deleteMember(id) {
  const m = memberById(id);
  if (!m) return;
  confirmDialog(`Delete “${m.name}”? Their meals, guest entries and deposits will also be removed.`, 'Delete member?')
    .then(ok => {
      if (!ok) return;
      db.members = db.members.filter(x => x.id !== id);
      db.meals = db.meals.filter(x => x.memberId !== id);
      db.deposits = db.deposits.filter(x => x.memberId !== id);
      db.guestMeals = db.guestMeals.filter(x => x.memberId !== id);
      toast('Member deleted', 'info');
      refresh();
    });
}

/* =========================================================
   MEALS
   ========================================================= */
function getMealRecord(memberId, date) { return db.meals.find(m => m.memberId === memberId && m.date === date); }
function setMealValue(memberId, date, type, val) {
  let rec = getMealRecord(memberId, date);
  if (!rec) {
    rec = { id: uid('meal'), memberId, date, breakfast: 0, lunch: 0, dinner: 0 };
    db.meals.push(rec);
  }
  rec[type] = val ? 1 : 0;
  const total = mealCountOf(rec);
  if (total === 0) db.meals = db.meals.filter(m => m !== rec);
  return rec;
}
function renderMeals() {
  $('#mealRateChip').textContent = `Meal Rate: ${rateMoney(computeStats('all').rate)}`;
  $('#mealDate').value = ui.meals.date;
  $('#mealMonth').value = ui.meals.month;
  $$('.tabs .tab[data-view]').forEach(t => t.classList.toggle('active', t.dataset.view === ui.meals.view));
  $('#mealsDaily').classList.toggle('hidden', ui.meals.view !== 'daily');
  $('#mealsMonthly').classList.toggle('hidden', ui.meals.view !== 'monthly');
  if (ui.meals.view === 'daily') renderDailyMeals(); else renderMonthlyMeals();
}
function renderDailyMeals() {
  const date = ui.meals.date;
  const rows = db.members.filter(m => m.status === 'active' || getMealRecord(m.id, date));
  $('#dailyBody').innerHTML = rows.length ? rows.map((m, i) => {
    const rec = getMealRecord(m.id, date);
    const b = rec ? num(rec.breakfast) : 0, l = rec ? num(rec.lunch) : 0, d = rec ? num(rec.dinner) : 0;
    return `<tr data-mid="${m.id}">
      <td>${i + 1}</td>
      <td class="name-cell"><b>${esc(m.name)}</b><small>${m.status === 'active' ? 'Active' : 'Inactive'}</small></td>
      <td>${esc(m.room || '—')}</td>
      <td class="col-center"><label class="check-pill"><input type="checkbox" data-type="breakfast" ${b ? 'checked' : ''}><span>Yes</span></label></td>
      <td class="col-center"><label class="check-pill"><input type="checkbox" data-type="lunch" ${l ? 'checked' : ''}><span>Yes</span></label></td>
      <td class="col-center"><label class="check-pill"><input type="checkbox" data-type="dinner" ${d ? 'checked' : ''}><span>Yes</span></label></td>
      <td class="row-total amount">${b + l + d}</td>
    </tr>`;
  }).join('') : emptyRow(7, 'No active members. Add members first to take meal entries.');
  $('#dailyInfo').textContent = `Entries for ${fmtDate(date)} — changes auto-save.`;
  updateDailyChip();
}
function updateDailyChip() {
  let total = 0;
  $$('#dailyBody .row-total').forEach(td => total += num(td.textContent));
  $('#dailyTotalChip').textContent = `${total} meal${total === 1 ? '' : 's'} this day`;
}
function onDailyToggle(e) {
  const cb = e.target.closest('input[type="checkbox"]');
  if (!cb) return;
  const tr = cb.closest('tr');
  const memberId = tr.dataset.mid;
  const type = cb.dataset.type;
  setMealValue(memberId, ui.meals.date, type, cb.checked);
  const rec = getMealRecord(memberId, ui.meals.date);
  tr.querySelector('.row-total').textContent = rec ? mealCountOf(rec) : 0;
  updateDailyChip();
  saveDB();
}
function saveDailyMeals() {
  toast('Meal entries saved');
  renderMeals();
}
function shiftDay(delta) {
  const [y, m, d] = ui.meals.date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  ui.meals.date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  renderMeals();
}
function renderMonthlyMeals() {
  const mk = ui.meals.month;
  const stats = computeStats(mk);
  $('#monthlyRateChip').textContent = `Rate: ${rateMoney(stats.rate)}`;
  const rows = db.members.filter(m => m.status === 'active' || memberMeals(m.id, mk) > 0);
  let tb = 0, tl = 0, td = 0, tg = 0, tt = 0, tc = 0;
  $('#monthlyBody').innerHTML = rows.length ? rows.map((m, i) => {
    const p = memberMealParts(m.id, mk);
    const g = memberGuestMeals(m.id, mk);
    const total = p.b + p.l + p.d;
    const cost = total * stats.rate;
    tb += p.b; tl += p.l; td += p.d; tg += g; tt += total; tc += cost;
    return `<tr>
      <td>${i + 1}</td>
      <td class="name-cell"><b>${esc(m.name)}</b><small>${money(m.seatRent)} seat rent</small></td>
      <td>${esc(m.room || '—')}</td>
      <td>${p.b}</td><td>${p.l}</td><td>${p.d}</td>
      <td>${g}</td>
      <td class="amount">${total}</td>
      <td class="amount">${money(cost)}</td>
    </tr>`;
  }).join('') : emptyRow(9, 'No meal entries for this month.');

  $('#monthlyInfo').innerHTML = rows.length
    ? `Totals — Breakfast: <b>${tb}</b> · Lunch: <b>${tl}</b> · Dinner: <b>${td}</b> · Guest: <b>${tg}</b> · Total meals: <b>${tt}</b> · Meal cost: <b>${money(tc)}</b> · Rate: <b>${rateMoney(stats.rate)}</b>`
    : '';
}
function printMonthly() { window.print(); }

/* =========================================================
   GUEST MEALS
   ========================================================= */
function filteredGuests() {
  const s = ui.guests.search.toLowerCase().trim();
  return db.guestMeals
    .filter(g => inScope(g.date, ui.guests.month || 'all'))
    .filter(g => !s || `${g.guestName} ${memberName(g.memberId)}`.toLowerCase().includes(s))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
function renderGuests() {
  fillMemberSelects();
  const list = filteredGuests();
  const { slice, page, pages, total } = pageSlice(list, ui.guests.page);
  ui.guests.page = page;
  const totalMealsInFilter = list.reduce((s, g) => s + num(g.count), 0);

  $('#guestTotalChip').textContent = `${totalMealsInFilter} guest meal${totalMealsInFilter === 1 ? '' : 's'}`;
  $('#guestBody').innerHTML = total ? slice.map((g, i) => `
    <tr>
      <td>${(page - 1) * PAGE_SIZE + i + 1}</td>
      <td>${fmtDate(g.date)}</td>
      <td class="name-cell"><b>${esc(g.guestName)}</b></td>
      <td>${esc(memberName(g.memberId))}</td>
      <td class="amount">${num(g.count)}</td>
      <td class="no-print"><div class="row-actions">
        <button class="mini-btn" onclick="openGuestModal('${safeId(g.id)}')">Edit</button>
        <button class="mini-btn danger" onclick="deleteGuest('${safeId(g.id)}')">Delete</button>
      </div></td>
    </tr>`).join('') : emptyRow(6, 'No guest meals recorded. Click “+ Add Guest Meal”.');

  $('#guestInfo').textContent = footInfo(total ? (page - 1) * PAGE_SIZE + 1 : 0, Math.min(page * PAGE_SIZE, total), total);
  $('#guestPagination').innerHTML = paginationHTML('guests', page, pages);
}
function openGuestModal(id) {
  $('#guestForm').reset();
  fillMemberSelects();
  const g = id ? db.guestMeals.find(x => x.id === id) : null;
  $('#guestModalTitle').textContent = g ? 'Edit Guest Meal' : 'Add Guest Meal';
  $('#guestId').value = g ? g.id : '';
  $('#guestName').value = g ? g.guestName : '';
  $('#guestMember').value = g ? g.memberId : ((db.members[0] || {}).id || '');
  $('#guestCount').value = g ? g.count : 1;
  $('#guestDate').value = g ? g.date : ui.meals.date;
  openModal('guestModal');
  setTimeout(() => $('#guestName').focus(), 120);
}
function saveGuest(e) {
  e.preventDefault();
  const name = $('#guestName'), count = $('#guestCount'), member = $('#guestMember');
  name.classList.toggle('invalid', !name.value.trim());
  if (!name.value.trim()) { toast('Guest name is required', 'error'); name.focus(); return; }
  if (!member.value) { toast('Add a member first — guests need a reference', 'error'); return; }
  if (num(count.value) < 1) { toast('Guest meal count must be at least 1', 'error'); count.focus(); return; }

  const id = $('#guestId').value;
  const data = {
    guestName: name.value.trim(), memberId: member.value,
    count: Math.round(num(count.value)), date: $('#guestDate').value || todayISO()
  };
  if (id) { Object.assign(db.guestMeals.find(x => x.id === id), data); toast('Guest meal updated'); }
  else { db.guestMeals.push({ id: uid('gst'), ...data }); toast('Guest meal added'); }
  closeModal('guestModal');
  refresh();
}
function deleteGuest(id) {
  confirmDialog('Remove this guest meal entry?', 'Delete guest meal?').then(ok => {
    if (!ok) return;
    db.guestMeals = db.guestMeals.filter(x => x.id !== id);
    toast('Guest meal deleted', 'info');
    refresh();
  });
}

/* =========================================================
   DEPOSITS
   ========================================================= */
function filteredDeposits() {
  const s = ui.deposits.search.toLowerCase().trim();
  return db.deposits
    .filter(d => inScope(d.date, ui.deposits.month || 'all'))
    .filter(d => ui.deposits.member === 'all' || d.memberId === ui.deposits.member)
    .filter(d => !s || `${memberName(d.memberId)} ${d.note || ''}`.toLowerCase().includes(s))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
function renderDeposits() {
  fillMemberSelects();
  const list = filteredDeposits();
  const { slice, page, pages, total } = pageSlice(list, ui.deposits.page);
  ui.deposits.page = page;
  const sum = list.reduce((s, d) => s + num(d.amount), 0);

  $('#depositTotalChip').textContent = `Total: ${money(sum)}`;
  $('#depositBody').innerHTML = total ? slice.map((d, i) => `
    <tr>
      <td>${(page - 1) * PAGE_SIZE + i + 1}</td>
      <td>${fmtDate(d.date)}</td>
      <td class="name-cell"><b>${esc(memberName(d.memberId))}</b></td>
      <td class="amount ${num(d.amount) >= 0 ? 'pos' : 'neg'}">${money(d.amount)}</td>
      <td>${esc(d.note || '—')}</td>
      <td class="no-print"><div class="row-actions">
        <button class="mini-btn" onclick="openDepositModal('${safeId(d.id)}')">Edit</button>
        <button class="mini-btn danger" onclick="deleteDeposit('${safeId(d.id)}')">Delete</button>
      </div></td>
    </tr>`).join('') : emptyRow(6, 'No deposits found. Click “+ Add Deposit”.');

  $('#depositInfo').textContent = footInfo(total ? (page - 1) * PAGE_SIZE + 1 : 0, Math.min(page * PAGE_SIZE, total), total);
  $('#depositPagination').innerHTML = paginationHTML('deposits', page, pages);
}
function openDepositModal(id) {
  $('#depositForm').reset();
  fillMemberSelects();
  const d = id ? db.deposits.find(x => x.id === id) : null;
  $('#depositModalTitle').textContent = d ? 'Edit Deposit' : 'Add Deposit';
  $('#depositId').value = d ? d.id : '';
  $('#depositMember').value = d ? d.memberId : ((db.members[0] || {}).id || '');
  $('#depositAmount').value = d ? d.amount : '';
  $('#depositDate').value = d ? d.date : todayISO();
  $('#depositNote').value = d ? (d.note || '') : '';
  openModal('depositModal');
  setTimeout(() => $('#depositAmount').focus(), 120);
}
function saveDeposit(e) {
  e.preventDefault();
  const amt = $('#depositAmount'), member = $('#depositMember');
  if (!member.value) { toast('Select a member', 'error'); return; }
  amt.classList.toggle('invalid', num(amt.value) === 0 || amt.value === '');
  if (amt.value === '' || num(amt.value) === 0) { toast('Enter a valid amount', 'error'); amt.focus(); return; }

  const id = $('#depositId').value;
  const data = {
    memberId: member.value, amount: num(amt.value),
    date: $('#depositDate').value || todayISO(), note: $('#depositNote').value.trim()
  };
  if (id) { Object.assign(db.deposits.find(x => x.id === id), data); toast('Deposit updated'); }
  else { db.deposits.push({ id: uid('dep'), ...data }); toast('Deposit added'); }
  closeModal('depositModal');
  refresh();
}
function deleteDeposit(id) {
  confirmDialog('This deposit will be removed from the member’s balance.', 'Delete deposit?').then(ok => {
    if (!ok) return;
    db.deposits = db.deposits.filter(x => x.id !== id);
    toast('Deposit deleted', 'info');
    refresh();
  });
}

/* =========================================================
   EXPENSES
   ========================================================= */
function filteredExpenses() {
  const s = ui.expenses.search.toLowerCase().trim();
  return db.expenses
    .filter(e => inScope(e.date, ui.expenses.month || 'all'))
    .filter(e => ui.expenses.category === 'all' || e.category === ui.expenses.category)
    .filter(e => !s || `${e.category} ${e.note || ''}`.toLowerCase().includes(s))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
function renderExpenses() {
  fillCategorySelects();
  const list = filteredExpenses();
  const { slice, page, pages, total } = pageSlice(list, ui.expenses.page);
  ui.expenses.page = page;
  const sum = list.reduce((s, e) => s + num(e.amount), 0);

  $('#expenseTotalChip').textContent = `Total: ${money(sum)}`;
  $('#expenseBody').innerHTML = total ? slice.map((e, i) => `
    <tr>
      <td>${(page - 1) * PAGE_SIZE + i + 1}</td>
      <td>${fmtDate(e.date)}</td>
      <td><span class="badge badge-info">${CAT_IC[e.category] || '🧾'} ${esc(e.category)}</span></td>
      <td class="amount neg">${money(e.amount)}</td>
      <td>${esc(e.note || '—')}</td>
      <td class="no-print"><div class="row-actions">
        <button class="mini-btn" onclick="openExpenseModal('${safeId(e.id)}')">Edit</button>
        <button class="mini-btn danger" onclick="deleteExpense('${safeId(e.id)}')">Delete</button>
      </div></td>
    </tr>`).join('') : emptyRow(6, 'No expenses found. Click “+ Add Expense”.');

  $('#expenseInfo').textContent = footInfo(total ? (page - 1) * PAGE_SIZE + 1 : 0, Math.min(page * PAGE_SIZE, total), total);
  $('#expensePagination').innerHTML = paginationHTML('expenses', page, pages);

  // Category mini-stats (current month)
  const mk = thisMonth();
  $('#categoryStats').innerHTML = CATEGORIES.map((c, i) => {
    const v = db.expenses.filter(e => e.category === c && monthOf(e.date) === mk).reduce((s, e) => s + num(e.amount), 0);
    return `<div class="stat-card"><span class="ic">${CAT_IC[c]}</span><div class="lbl">${c}</div><div class="bn">${CAT_BN[c]}</div><div class="val" style="color:${CAT_COLORS[i]}">${money(v)}</div></div>`;
  }).join('');
}
function openExpenseModal(id) {
  $('#expenseForm').reset();
  fillCategorySelects();
  const e = id ? db.expenses.find(x => x.id === id) : null;
  $('#expenseModalTitle').textContent = e ? 'Edit Expense' : 'Add Expense';
  $('#expenseId').value = e ? e.id : '';
  $('#expenseCategory').value = e ? e.category : 'Rice';
  $('#expenseAmount').value = e ? e.amount : '';
  $('#expenseDate').value = e ? e.date : todayISO();
  $('#expenseNote').value = e ? (e.note || '') : '';
  openModal('expenseModal');
  setTimeout(() => $('#expenseAmount').focus(), 120);
}
function saveExpense(e) {
  e.preventDefault();
  const amt = $('#expenseAmount');
  amt.classList.toggle('invalid', amt.value === '' || num(amt.value) <= 0);
  if (amt.value === '' || num(amt.value) <= 0) { toast('Enter a valid expense amount', 'error'); amt.focus(); return; }

  const id = $('#expenseId').value;
  const data = {
    category: $('#expenseCategory').value, amount: num(amt.value),
    date: $('#expenseDate').value || todayISO(), note: $('#expenseNote').value.trim()
  };
  if (id) { Object.assign(db.expenses.find(x => x.id === id), data); toast('Expense updated'); }
  else { db.expenses.push({ id: uid('exp'), ...data }); toast('Expense added'); }
  closeModal('expenseModal');
  refresh();
}
function deleteExpense(id) {
  confirmDialog('This expense will be removed from the meal-rate calculation.', 'Delete expense?').then(ok => {
    if (!ok) return;
    db.expenses = db.expenses.filter(x => x.id !== id);
    toast('Expense deleted', 'info');
    refresh();
  });
}

/* =========================================================
   REPORTS
   ========================================================= */
function reportTitle(type) {
  return { monthly: 'Monthly Report', members: 'Member Wise Report', guests: 'Guest Report', expenses: 'Expense Report', deposits: 'Deposit Report' }[type] || 'Report';
}
function buildReport() {
  const type = ui.reports.type, scope = ui.reports.scope;
  const st = computeStats(scope);
  const seatMonths = monthsInScope(scope);
  let headers = [], rows = [], summary = [];

  if (type === 'monthly') {
    const months = scope === 'all' ? allMonths() : [scope];
    headers = ['Month', 'Member Meals', 'Guest Meals', 'Total Meals', 'Expenses', 'Deposits', 'Meal Rate', 'Balance'];
    rows = months.map(mk => {
      const s = computeStats(mk);
      return [monthLabel(mk), s.memberMeals, s.guestMeals, s.totalMeals, money(s.totalExpenses), money(s.totalDeposits), rateMoney(s.rate), money(s.balance)];
    });
    summary = [
      ['Total Meals', st.totalMeals.toLocaleString('en-US')], ['Guest Meals', st.guestMeals],
      ['Expenses', money(st.totalExpenses)], ['Deposits', money(st.totalDeposits)],
      ['Meal Rate', rateMoney(st.rate)], ['Balance', money(st.balance)]
    ];
  }

  if (type === 'members') {
    headers = ['Member', 'Room', 'Phone', 'Breakfast', 'Lunch', 'Dinner', 'Guest Meals', 'Total Meals', 'Meal Cost', 'Seat Rent', 'Total Cost', 'Deposit', 'Balance'];
    let totalCost = 0, totalDep = 0, totalDue = 0;
    rows = db.members.map(m => {
      const p = memberMealParts(m.id, scope);
      const total = p.b + p.l + p.d;
      const mealCost = total * st.rate;
      const rent = num(m.seatRent) * seatMonths;
      const cost = mealCost + rent;
      const dep = memberDeposits(m.id, scope);
      const bal = dep - cost;
      totalCost += cost; totalDep += dep; if (bal < 0) totalDue += Math.abs(bal);
      return [m.name, m.room || '—', m.phone || '—', p.b, p.l, p.d, memberGuestMeals(m.id, scope), total,
        money(mealCost), money(rent), money(cost), money(dep), `${money(bal)}${bal < 0 ? ' (Due)' : ''}`];
    });
    summary = [
      ['Members', db.members.length], ['Meal Rate', rateMoney(st.rate)],
      ['Seat Rent Months', seatMonths], ['Total Cost', money(totalCost)],
      ['Total Deposits', money(totalDep)], ['Total Due', money(totalDue)]
    ];
  }

  if (type === 'guests') {
    const list = db.guestMeals.filter(g => inScope(g.date, scope)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    headers = ['Date', 'Guest Name', 'Reference Member', 'Meals'];
    rows = list.map(g => [fmtDate(g.date), g.guestName, memberName(g.memberId), num(g.count)]);
    const totalG = list.reduce((s, g) => s + num(g.count), 0);
    summary = [['Guest Entries', list.length], ['Guest Meals', totalG], ['Guest Cost at Rate', money(totalG * st.rate)], ['Meal Rate', rateMoney(st.rate)]];
  }

  if (type === 'expenses') {
    const list = db.expenses.filter(e => inScope(e.date, scope)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    headers = ['Date', 'Category', 'Amount', 'Note'];
    rows = list.map(e => [fmtDate(e.date), e.category, money(e.amount), e.note || '—']);
    const cats = Array.from(new Set([...CATEGORIES, ...list.map(e => e.category).filter(c => c && !CATEGORIES.includes(c))]));
    summary = cats.map(c => [c, money(list.filter(e => e.category === c).reduce((s, e) => s + num(e.amount), 0))])
      .concat([['Total Expenses', money(st.totalExpenses)], ['Entries', list.length]]);
  }

  if (type === 'deposits') {
    const list = db.deposits.filter(d => inScope(d.date, scope)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    headers = ['Date', 'Member', 'Amount', 'Note'];
    rows = list.map(d => [fmtDate(d.date), memberName(d.memberId), money(d.amount), d.note || '—']);
    const total = list.reduce((s, d) => s + num(d.amount), 0);
    summary = [['Total Deposits', money(total)], ['Transactions', list.length],
      ['Average', list.length ? money(total / list.length) : money(0)], ['Balance', money(st.balance)]];
  }

  return {
    type, scope, title: reportTitle(type),
    scopeLabel: scope === 'all' ? 'All Time' : monthLabel(scope),
    generated: new Date().toLocaleString('en-US'),
    headers, rows, summary
  };
}
function renderReports() {
  $$('.tabs .tab[data-report]').forEach(t => t.classList.toggle('active', t.dataset.report === ui.reports.type));

  const months = allMonths();
  const sel = $('#reportScope');
  const wanted = ui.reports.scope;
  sel.innerHTML = `<option value="all">All Time</option>` + months.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
  sel.value = months.includes(wanted) || wanted === 'all' ? wanted : months[0];
  ui.reports.scope = sel.value;

  const r = buildReport();
  lastReport = r;
  $('#reportMessName').textContent = db.settings.messName || 'My Mess';
  $('#reportTitleLine').textContent = r.title;
  $('#reportScopeLabel').textContent = 'Period: ' + r.scopeLabel;
  $('#reportGenDate').textContent = 'Generated: ' + r.generated;
  $('#reportSummary').innerHTML = r.summary.map(([l, v]) => `<div class="rs"><small>${esc(l)}</small><strong>${esc(String(v))}</strong></div>`).join('');
  $('#reportHead').innerHTML = `<tr>${r.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`;
  $('#reportBody').innerHTML = r.rows.length
    ? r.rows.map(row => `<tr>${row.map(c => `<td>${esc(String(c))}</td>`).join('')}</tr>`).join('')
    : emptyRow(r.headers.length, 'No data available for this period.');
  $('#reportFoot').textContent = `${r.title} · ${r.scopeLabel} · Generated by MessPro — Bangladeshi Mess Management System`;
}

/* =========================================================
   SETTINGS
   ========================================================= */
function storageBytes() { try { return (localStorage.getItem(DB_KEY) || '').length; } catch (e) { return 0; } }
function updateStorageInfo() {
  const bytes = storageBytes();
  const kb = (bytes / 1024).toFixed(1);
  const badge = $('#storageBadge'), info = $('#storageInfo');
  if (badge) badge.textContent = `${kb} KB`;
  if (info) info.textContent = `${kb} KB used in LocalStorage (${((bytes / (5 * 1024 * 1024)) * 100).toFixed(3)}% of the ~5 MB browser quota)`;
}
function renderSettings() {
  $('#settingsMessName').value = db.settings.messName || '';
  $('#settingsManager').value = db.settings.managerName || '';
  $('#settingsCurrency').value = db.settings.currency || '৳';
  $('#settingsDarkToggle').checked = db.settings.theme !== 'light';
  updateStorageInfo();
  $('#settingsStats').innerHTML = [
    ['Members', db.members.length], ['Meal Entries', db.meals.length], ['Guest Entries', db.guestMeals.length],
    ['Deposits', db.deposits.length], ['Expenses', db.expenses.length]
  ].map(([l, v]) => `<span class="chip">${l}: <b>${v}</b></span>`).join('');
}
function saveProfile(e) {
  e.preventDefault();
  const name = $('#settingsMessName');
  name.classList.toggle('invalid', !name.value.trim());
  if (!name.value.trim()) { toast('Mess name is required', 'error'); name.focus(); return; }
  db.settings.messName = name.value.trim();
  db.settings.managerName = $('#settingsManager').value.trim() || 'Manager';
  db.settings.currency = $('#settingsCurrency').value.trim() || '৳';
  $('#sideMessName').textContent = db.settings.messName;
  $('#managerNameTop').textContent = db.settings.managerName;
  $('#avatarLetter').textContent = (db.settings.managerName[0] || 'M').toUpperCase();
  saveDB(); toast('Profile saved');
  renderSettings();
}
function saveSettingsPassword(e) {
  e.preventDefault();
  if ($('#setPwNew').value !== $('#setPwConfirm').value) { toast('New passwords do not match', 'error'); return; }
  const err = changePassword($('#setPwCurrent').value, $('#setPwNew').value);
  if (err) { toast(err, 'error'); return; }
  $('#settingsPasswordForm').reset();
  toast('Password updated');
}

/* =========================================================
   EXPORT / BACKUP
   ========================================================= */
function download(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const fileStamp = () => todayISO();
function exportJSON() {
  download(JSON.stringify(db, null, 2), `mess-backup-${fileStamp()}.json`, 'application/json');
  toast('JSON export downloaded');
}
function backupJSON() {
  const payload = { app: 'MessPro', version: 1, exportedAt: new Date().toISOString(), data: db };
  download(JSON.stringify(payload, null, 2), `mess-backup-${fileStamp()}.json`, 'application/json');
  toast('Backup created');
}
function exportExcel() {
  if (!lastReport) return;
  const head = lastReport.headers.map(h => `<th>${esc(h)}</th>`).join('');
  const body = lastReport.rows.map(r => `<tr>${r.map(c => `<td>${esc(String(c))}</td>`).join('')}</tr>`).join('');
  const summary = lastReport.summary.map(([l, v]) => `<tr><td><b>${esc(l)}</b></td><td>${esc(String(v))}</td></tr>`).join('');
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
    <table><tr><td colspan="${lastReport.headers.length}"><h3>${esc(db.settings.messName)} — ${esc(lastReport.title)}</h3></td></tr>
    <tr><td colspan="${lastReport.headers.length}">Period: ${esc(lastReport.scopeLabel)} | Generated: ${esc(lastReport.generated)}</td></tr></table><br>
    <table border="1">${summary}</table><br>
    <table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </body></html>`;
  download(html, `${lastReport.type}-report-${fileStamp()}.xls`, 'application/vnd.ms-excel;charset=utf-8');
  toast('Excel file downloaded');
}
function exportReportJSON() {
  if (!lastReport) return;
  download(JSON.stringify({ app: 'MessPro', ...lastReport }, null, 2), `${lastReport.type}-report-${fileStamp()}.json`, 'application/json');
  toast('Report JSON downloaded');
}
function printReport() { window.print(); }

function restoreJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const incoming = parsed && parsed.data ? parsed.data : parsed;
      if (!incoming || !Array.isArray(incoming.members)) throw new Error('bad format');
      confirmDialog('Current data will be replaced by the backup file. Continue?', 'Restore backup?').then(ok => {
        if (!ok) return;
        const base = defaultDB();
        db = {
          ...base, ...incoming,
          settings: { ...base.settings, ...(incoming.settings || {}) },
          members: incoming.members || [], meals: incoming.meals || [],
          guestMeals: incoming.guestMeals || [], deposits: incoming.deposits || [], expenses: incoming.expenses || []
        };
        applyTheme(); saveDB();
        toast('Backup restored');
        go('dashboard');
      });
    } catch (e) { toast('Invalid backup file', 'error'); }
  };
  reader.readAsText(file);
}

/* ---------------- Sample data ---------------- */
function loadSampleData() {
  const names = [
    ['Rahim Uddin', '01711000001', '101', 3500],
    ['Karim Hossain', '01711000002', '102', 3500],
    ['Jabbar Mia', '01711000003', '103', 4000],
    ['Mobarak Ali', '01711000004', '104', 4000],
    ['Shafiqul Islam', '01711000005', '105', 3500],
    ['Nazrul Islam', '01711000006', '106', 4500]
  ];
  const mk = thisMonth();
  const today = todayISO();
  const day = Number(today.slice(8, 10));

  db.members = names.map(([name, phone, room, rent], i) => ({
    id: 'mem_s' + i, name, phone, room, seatRent: rent, status: 'active',
    joined: `${prevMonthKey(mk)}-01`
  }));
  db.deposits = db.members.map((m, i) => ({
    id: 'dep_s' + i, memberId: m.id, amount: 5000 + i * 500, date: `${mk}-01`, note: 'Monthly deposit'
  }));
  db.meals = [];
  db.members.forEach(m => {
    for (let d = 1; d <= day; d++) {
      const date = `${mk}-${String(d).padStart(2, '0')}`;
      const b = d % 5 === 0 ? 0 : 1, l = 1, dn = d % 7 === 0 ? 0 : 1;
      db.meals.push({ id: `meal_${m.id}_${d}`, memberId: m.id, date, breakfast: b, lunch: l, dinner: dn });
    }
  });
  db.guestMeals = [
    { id: 'gst_s1', guestName: 'Sohel Rana', memberId: db.members[0].id, count: 2, date: `${mk}-05` },
    { id: 'gst_s2', guestName: 'Masud Rana', memberId: db.members[2].id, count: 1, date: `${mk}-12` }
  ];
  db.expenses = [
    { id: 'exp_s1', category: 'Rice', amount: 9500, date: `${mk}-02`, note: '100kg miniket rice' },
    { id: 'exp_s2', category: 'Oil', amount: 3200, date: `${mk}-03`, note: 'Soybean oil 5L x2' },
    { id: 'exp_s3', category: 'Chicken', amount: 4800, date: `${mk}-07`, note: 'Chicken 12kg' },
    { id: 'exp_s4', category: 'Fish', amount: 3600, date: `${mk}-10`, note: 'Rui fish' },
    { id: 'exp_s5', category: 'Vegetables', amount: 2400, date: `${mk}-14`, note: 'Weekly bazaar' },
    { id: 'exp_s6', category: 'Utilities', amount: 4200, date: `${mk}-15`, note: 'Gas + internet' },
    { id: 'exp_s7', category: 'Others', amount: 1500, date: `${mk}-16`, note: 'Masala & spice' }
  ];
  saveDB();
  toast('Sample data loaded');
  go('dashboard');
}
async function resetAllData() {
  const ok = await confirmDialog('Every member, meal, deposit, expense and setting will be erased. This cannot be undone.', 'Reset all data?');
  if (!ok) return;
  db = defaultDB();
  try { localStorage.removeItem(DB_KEY); } catch (e) {}
  saveDB(); applyTheme();
  toast('All data has been reset', 'info');
  go('dashboard');
}

/* =========================================================
   SIDEBAR / STATIC EVENTS
   ========================================================= */
const isDrawerNav = () => window.innerWidth <= 1024;
function openSidebar() { $('#sidebar').classList.add('open'); $('#sidebarOverlay').classList.add('show'); }
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#sidebarOverlay').classList.remove('show'); }
const sidebarIsOpen = () => $('#sidebar').classList.contains('open');
function toggleSidebar() {
  if (isDrawerNav()) {
    if (sidebarIsOpen()) closeSidebar(); else openSidebar();
  } else {
    closeSidebar();                              // clear any drawer state
    $('#app').classList.toggle('side-hidden');   // desktop: dock / collapse
  }
}
function syncSidebar() {
  if (isDrawerNav()) $('#app').classList.remove('side-hidden');
  else closeSidebar();
}

function bindEvents() {
  /* Auth */
  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const val = $('#loginPassword').value;
    if (val === db.settings.password) {
      if ($('#rememberMe').checked) localStorage.setItem(AUTH_KEY, '1');
      else sessionStorage.setItem(AUTH_KEY, '1');
      $('#loginPassword').value = '';
      enterApp();
      toast('Welcome back, ' + (db.settings.managerName || 'Manager'));
    } else {
      const card = $('.login-card');
      card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      toast('Incorrect password', 'error');
    }
  });
  $('#logoutBtn').addEventListener('click', () => logout(true));
  $('#openPasswordModal').addEventListener('click', () => { $('#loginPasswordForm').reset(); openModal('passwordModal'); });
  $('#loginPasswordForm').addEventListener('submit', e => {
    e.preventDefault();
    const next = $('#pwNew').value;
    if (next !== $('#pwConfirm').value) { toast('New passwords do not match', 'error'); return; }
    const err = changePassword($('#pwCurrent').value, next);
    if (err) { toast(err, 'error'); return; }
    closeModal('passwordModal');
    $('#loginPasswordForm').reset();
    $('#defaultHint').classList.add('hidden');
    toast('Password updated — login with your new password');
  });

  /* Navigation */
  $$('.nav-item').forEach(n => n.addEventListener('click', () => go(n.dataset.page)));
  $('#menuBtn').addEventListener('click', toggleSidebar);
  $('#sidebarOverlay').addEventListener('click', closeSidebar);
  $('#themeBtn').addEventListener('click', toggleTheme);
  $('#settingsDarkToggle').addEventListener('change', toggleTheme);

  /* Quick actions */
  $('#btnQuickMeal').addEventListener('click', () => { ui.meals.view = 'daily'; go('meals'); });
  $('#btnQuickDeposit').addEventListener('click', () => { go('deposits'); openDepositModal(null); });

  /* Members */
  $('#btnAddMember').addEventListener('click', () => openMemberModal(null));
  $('#memberForm').addEventListener('submit', saveMember);
  $('#memberSearch').addEventListener('input', e => { ui.members.search = e.target.value; ui.members.page = 1; renderMembers(); });
  $('#memberStatusFilter').addEventListener('change', e => { ui.members.status = e.target.value; ui.members.page = 1; renderMembers(); });

  /* Meals */
  $$('.tabs .tab[data-view]').forEach(t => t.addEventListener('click', () => { ui.meals.view = t.dataset.view; renderMeals(); }));
  $('#mealDate').addEventListener('change', e => { if (e.target.value) { ui.meals.date = e.target.value; renderDailyMeals(); } });
  $('#mealPrevDay').addEventListener('click', () => shiftDay(-1));
  $('#mealNextDay').addEventListener('click', () => shiftDay(1));
  $('#mealToday').addEventListener('click', () => { ui.meals.date = todayISO(); renderMeals(); });
  $('#dailyBody').addEventListener('change', onDailyToggle);
  $('#btnSaveMeals').addEventListener('click', saveDailyMeals);
  $('#mealMonth').addEventListener('change', e => { if (e.target.value) { ui.meals.month = e.target.value; renderMonthlyMeals(); } });
  $('#btnPrintMonthly').addEventListener('click', printMonthly);

  /* Guests */
  $('#btnAddGuest').addEventListener('click', () => openGuestModal(null));
  $('#guestForm').addEventListener('submit', saveGuest);
  $('#guestSearch').addEventListener('input', e => { ui.guests.search = e.target.value; ui.guests.page = 1; renderGuests(); });
  $('#guestMonthFilter').addEventListener('change', e => { ui.guests.month = e.target.value; ui.guests.page = 1; renderGuests(); });

  /* Deposits */
  $('#btnAddDeposit').addEventListener('click', () => openDepositModal(null));
  $('#depositForm').addEventListener('submit', saveDeposit);
  $('#depositSearch').addEventListener('input', e => { ui.deposits.search = e.target.value; ui.deposits.page = 1; renderDeposits(); });
  $('#depositMemberFilter').addEventListener('change', e => { ui.deposits.member = e.target.value; ui.deposits.page = 1; renderDeposits(); });
  $('#depositMonthFilter').addEventListener('change', e => { ui.deposits.month = e.target.value; ui.deposits.page = 1; renderDeposits(); });

  /* Expenses */
  $('#btnAddExpense').addEventListener('click', () => openExpenseModal(null));
  $('#expenseForm').addEventListener('submit', saveExpense);
  $('#expenseSearch').addEventListener('input', e => { ui.expenses.search = e.target.value; ui.expenses.page = 1; renderExpenses(); });
  $('#expenseCategoryFilter').addEventListener('change', e => { ui.expenses.category = e.target.value; ui.expenses.page = 1; renderExpenses(); });
  $('#expenseMonthFilter').addEventListener('change', e => { ui.expenses.month = e.target.value; ui.expenses.page = 1; renderExpenses(); });

  /* Reports */
  $$('.tabs .tab[data-report]').forEach(t => t.addEventListener('click', () => { ui.reports.type = t.dataset.report; renderReports(); }));
  $('#reportScope').addEventListener('change', e => { ui.reports.scope = e.target.value; renderReports(); });
  $('#btnPrintReport').addEventListener('click', printReport);
  $('#btnExportExcel').addEventListener('click', exportExcel);
  $('#btnExportJson').addEventListener('click', exportReportJSON);
  $('#btnExportPdf').addEventListener('click', () => {
    toast('Choose “Save as PDF” as the destination in the print dialog', 'info');
    setTimeout(() => window.print(), 500);
  });

  /* Settings */
  $('#profileForm').addEventListener('submit', saveProfile);
  $('#settingsPasswordForm').addEventListener('submit', saveSettingsPassword);
  $('#btnBackup').addEventListener('click', backupJSON);
  $('#btnRestore').addEventListener('click', () => $('#restoreFile').click());
  $('#restoreFile').addEventListener('change', e => { if (e.target.files[0]) restoreJSON(e.target.files[0]); e.target.value = ''; });
  $('#btnSample').addEventListener('click', async () => {
    if (db.members.length) {
      const ok = await confirmDialog('Existing data will be replaced by sample data.', 'Load sample data?');
      if (!ok) return;
    }
    loadSampleData();
  });
  $('#btnReset').addEventListener('click', resetAllData);

  /* Modals */
  document.addEventListener('click', e => {
    const closer = e.target.closest('[data-close]');
    if (closer) { closeModal(closer.dataset.close); return; }
    if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const openModalEl = document.querySelector('.modal-overlay.open');
      if (openModalEl) { closeModal(openModalEl.id); return; }
      if (isDrawerNav() && sidebarIsOpen()) closeSidebar();
    }
  });
  $('#confirmCancelBtn').addEventListener('click', () => closeModal('confirmModal'));
  $('#confirmOkBtn').addEventListener('click', () => {
    const r = confirmResolver;
    confirmResolver = null;
    closeModal('confirmModal');
    if (r) r(true);
  });

  /* Pagination delegation */
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-pg]');
    if (!btn || btn.disabled) return;
    const key = btn.dataset.pgkey;
    ui[key].page = Number(btn.dataset.pg);
    renderPage(key === 'members' ? 'members' : key);
  });

  /* Clear invalid state while typing */
  document.addEventListener('input', e => { if (e.target.classList) e.target.classList.remove('invalid'); });

  /* Keep charts crisp on resize + keep sidebar state valid across breakpoints */
  let rt = null;
  window.addEventListener('resize', () => {
    syncSidebar();
    clearTimeout(rt);
    rt = setTimeout(() => { if (ui.page === 'dashboard') renderCharts(); }, 250);
  });
}

/* ---------------- Init ---------------- */
function init() {
  loadDB();
  applyTheme();
  bindEvents();
  $('#todayLabel').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  fillMemberSelects();
  fillCategorySelects();
  updateStorageInfo();
  if (isAuthed()) enterApp(); else showLogin();
}
document.addEventListener('DOMContentLoaded', init);
