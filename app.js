/* NetOps Hub PWA — single-file app logic */
const API = 'https://netops-pwa-api.gate-of-all-nations-2580.workers.dev';
const COLLECTIONS = ['servers', 'phone', 'ips', 'vcenters', 'rahkaran', 'cheats',
  'tickets', 'ticket_comments', 'ticket_activity', 'sla_policies', 'users', 'audit_log'];

const $app = document.getElementById('app');
const $toast = document.getElementById('toast');

const state = {
  user: null,
  lang: localStorage.getItem('netops.lang') || 'en',
  palette: localStorage.getItem('netops.palette') || 'cyan',
  glass: parseFloat(localStorage.getItem('netops.glass') || '0.29'),
  screen: 'dashboard',
  q: {},
  tab: {},
  category: null,
  article: null,
  ticket: null,
  data: {},
  refs: [],
  favorites: new Set(JSON.parse(localStorage.getItem('netops.favorites') || '[]')),
  notes: JSON.parse(localStorage.getItem('netops.notes') || '[]'),
  release: null,
  online: navigator.onLine,
  userModal: false,
  userTab: 0,
  diagnostics: [],
  problemId: null,
  token: sessionStorage.getItem('netops.token') || '',
  editTarget: null
};

let audioCtx = null;
function beep(kind = 'click') {
  try {
    if (localStorage.getItem('netops.sound') === '0') return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const notes = kind === 'success' ? [660, 990] : kind === 'error' ? [180] : [1200];
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.09 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.11);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(now + i * 0.09); osc.stop(now + i * 0.09 + 0.12);
    });
  } catch (e) { /* audio blocked until first gesture */ }
}

const PALETTES = [
  ['cyan', 'سایبر', 'Cyan'], ['purple', 'بنفش', 'Purple'],
  ['green', 'سبز', 'Green'], ['gold', 'طلایی', 'Gold'], ['blue', 'آبی', 'Blue']
];

const CATEGORIES = [
  ['', 'همه', 'All'], ['network-plus', 'مبانی شبکه', 'Network+'],
  ['cisco-ccna', 'CCNA', 'CCNA'], ['cisco-ccnp', 'CCNP', 'CCNP'],
  ['mcse-windows', 'ویندوز', 'Windows'], ['mikrotik', 'میکروتیک', 'MikroTik'],
  ['fortigate', 'فورتینت', 'FortiGate'], ['hardware-support', 'سختافزار', 'Hardware'],
  ['printer-peripherals', 'پرینتر', 'Printers'], ['cmd-commands', 'دستورات CMD', 'CMD'],
  ['cpl-commands', 'دستورات CPL', 'CPL'], ['keywords', 'واژهنامه', 'Keywords'],
  ['quick-reference', 'چیتشیتها', 'Quick Sheets']
];

const NAV = [
  ['dashboard', '⌂', 'داشبورد', 'Home'],
  ['servers', '▣', 'سرورها', 'Servers'],
  ['academy', '◈', 'آکادمی', 'Academy'],
  ['helpdesk', '◉', 'هلپدسک', 'Helpdesk'],
  ['settings', '⚙', 'تنظیمات', 'Settings']
];

function t(fa, en) { return state.lang === 'fa' ? fa : en; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const FA = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
function num(n) {
  const s = String(n == null ? 0 : n);
  return state.lang === 'fa' ? s.replace(/\d/g, d => FA[+d]) : s;
}
function ago(ms) {
  if (!ms) return '—';
  const d = Math.floor((Date.now() - ms) / 86400000);
  if (d > 0) return t(`${num(d)} روز پیش`, `${d}d ago`);
  const h = Math.floor((Date.now() - ms) / 3600000);
  return h > 0 ? t(`${num(h)} ساعت پیش`, `${h}h ago`) : t('همین حالا', 'just now');
}
function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $toast.classList.remove('show'), 3200);
}
function applyTheme() {
  document.documentElement.dataset.palette = state.palette;
  document.documentElement.style.setProperty('--glass-alpha', String(state.glass));
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'fa' ? 'rtl' : 'ltr';
}
function loadCached() {
  try {
    const raw = localStorage.getItem('netops.data');
    if (raw) {
      const cached = JSON.parse(raw);
      state.data = cached.data || {};
      state.refs = cached.refs || [];
    }
  } catch (e) { /* ignore */ }
  try { state.release = JSON.parse(localStorage.getItem('netops.release') || 'null'); } catch (e) {}
}
async function saveCache() {
  try {
    localStorage.setItem('netops.data', JSON.stringify({ ts: Date.now(), data: state.data, refs: state.refs }));
  } catch (e) { toast(t('حافظهی محلی پر است', 'Local storage full')); }
}
async function api(path, options) {
  const opts = options || {};
  if (state.token) {
    opts.headers = { ...(opts.headers || {}), Authorization: 'Bearer ' + state.token };
  }
  const res = await fetch(API + path, opts);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}
const EDIT_FIELDS = {
  phone: ['name', 'phone', 'extension', 'mobile', 'position', 'notes', 'address'],
  ips: ['site', 'ip', 'computerName', 'location', 'unit', 'userName', 'operator', 'domain', 'os', 'type', 'cpu', 'ram', 'dhcp', 'wifi', 'padvish', 'bit', 'inHost'],
  vcenters: ['name', 'ip', 'vcenter', 'server', 'service', 'rdpPort', 'status', 'date', 'cpu', 'storage'],
  rahkaran: ['companyName', 'ip', 'rdpPort', 'webPort', 'webUrl', 'webUrlAlt', 'notes'],
  servers: ['name', 'ip', 'site', 'service', 'rdpPort', 'status', 'esxiHost', 'vcenter', 'notes']
};

async function writeCollection(name, op, item, id) {
  try {
    const res = await api('/write', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: name, op, item, id })
    });
    toast(res.ok ? t('ذخیره شد و با تیم همگام شد', 'Saved and synced with the team') : (res.error || 'Error'));
    beep(res.ok ? 'success' : 'error');
    if (res.ok) { state.editTarget = null; render(); loadData(); }
  } catch (ex) { toast(ex.message); }
}

function canEditRole() { return ['CREATOR', 'ADMIN', 'EDITOR'].includes(state.user?.role); }
function canAdminRole() { return ['CREATOR', 'ADMIN'].includes(state.user?.role); }

async function loadData() {
  toast(t('دریافت دادهها…', 'Loading data…'));
  try {
    const entries = await Promise.all(COLLECTIONS.map(async name => {
      try { return [name, (await api('/collection/' + name)).items || []]; }
      catch (e) { return [name, state.data[name] || []]; }
    }));
    state.data = Object.fromEntries(entries);
    try { state.refs = await (await fetch('./reference_library.json')).json(); } catch (e) {}
    try { state.diagnostics = await (await fetch('./diagnostics.json')).json(); } catch (e) {}
    try { state.release = await api('/release'); localStorage.setItem('netops.release', JSON.stringify(state.release)); } catch (e) {}
    await saveCache();
    render();
  } catch (e) { toast(e.message); }
}

/* ---------------------------------------------------------------- domain */
function priorityFor(impact, urgency) {
  if (impact === 'high') return urgency === 'high' ? 'P1' : urgency === 'medium' ? 'P2' : 'P3';
  if (impact === 'medium') return urgency === 'high' ? 'P2' : urgency === 'medium' ? 'P3' : 'P4';
  return urgency === 'high' ? 'P3' : 'P4';
}
function slaOf(ticket) {
  const now = Date.now();
  if (['resolved', 'closed'].includes(ticket.status)) return { label: t(' Met', 'Met'), cls: 'ok' };
  const due = ticket.slaDueAt || 0;
  if (!due) return { label: '—', cls: 'dim' };
  const left = due - now;
  if (left <= 0) return { label: t('نقض SLA', 'Breached'), cls: 'bad' };
  const span = Math.max(1, due - (ticket.createdAt || now));
  const hours = Math.floor(left / 3600000);
  const mins = Math.floor((left % 3600000) / 60000);
  const text = hours ? `${num(hours)}h ${num(mins)}m` : `${num(mins)}m`;
  return { label: left / span < 0.2 ? '⚠ ' + text : text, cls: left / span < 0.2 ? 'warn' : 'ok' };
}
function matches(item, q) {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  return Object.values(item).some(v => typeof v === 'string' && v.toLowerCase().includes(s));
}
function catLabel(slug) {
  const c = CATEGORIES.find(x => x[0] === slug);
  return c ? t(c[1], c[2]) : slug;
}

/* ---------------------------------------------------------------- login */
function loginView() {
  $app.innerHTML = `
    <div class="login-wrap">
      <form class="login-box glass card" id="loginForm">
        <div class="row" style="margin-bottom:18px">
          <div class="avatar" style="width:46px;height:46px;font-size:22px">◈</div>
          <div><h1>NetOps Hub</h1><div class="muted">${t('شبکه • آکادمی • هلپدسک', 'Network • Academy • Helpdesk')}</div></div>
        </div>
        <span class="badge">${t('همگام با فضای ابری', 'Cloud connected')}</span>
        <div style="height:18px"></div>
        <input class="field" name="username" placeholder="${t('نام کاربری', 'Username')}" autocomplete="username" required>
        <input class="field" name="password" type="password" placeholder="${t('رمز عبور', 'Password')}" autocomplete="current-password" required>
        <div id="loginErr" class="bad"></div>
        <button class="btn solid" style="width:100%;margin-top:8px" type="submit">${t('ورود', 'Sign in')}</button>
        <div class="footer">${t('سازنده: کوروش محسنی (Kourosh Mohseni)', 'Created by Kourosh Mohseni')}</div>
      </form>
    </div>`;
}

/* ---------------------------------------------------------------- shells */
function appView() {
  const screen = state.screen;
  const head = screen === 'dashboard' ? '' : apkHeader(screen);
  const content = ({
    dashboard: dashboardView, servers: serversView, inventory: inventoryView,
    phonebook: phoneView, academy: academyView, helpdesk: helpdeskView,
    favorites: favoritesView, search: searchView, settings: settingsView, tools: toolsView, users: usersView
  }[screen] || dashboardView)();
  $app.innerHTML = `<div class="app">${head}${content}${footer()}</div>${state.article ? articleModal() : ''}${state.ticket ? ticketModal() : ''}${usersModal()}${problemModal()}${editModal()}`;
}

function apkHeader(screen) {
  const subtitles = {
    servers: t('زیرساخت و سرورها', 'Infrastructure & servers'),
    inventory: t('اطلاعات شرکت', 'Company information'),
    phonebook: t('دفتر تلفن', 'Phone directory'),
    academy: t(' Network+ • CCNA • CCNP', 'Network+ • CCNA • CCNP'),
    helpdesk: t('عیبیابی • تیکت • دانشنامه', 'Diagnostics • tickets • knowledge'),
    favorites: t('یادداشت و دسترسی سریع', 'Saved notes and quick access'),
    search: t('سرورها • سایتها • مقالات • مخاطبین', 'Servers • sites • guides • contacts'),
    settings: t('شخصیسازی • صدا • امنیت', 'Customization • sound • security'),
    tools: t('ماشینحسابهایnetwork', 'Network calculators')
  };
  return `<div class="apk-header">
    <button class="home-btn" data-act="go" data-id="dashboard" title="${t('داشبورد', 'Home')}">⌂</button>
    <div class="titles"><h1>${screenTitle(screen)}</h1><div class="subtitle">${subtitles[screen] || ''}</div></div>
    ${screen === 'settings' ? '' : `<button class="act" data-act="go" data-id="settings" title="${t('تنظیمات', 'Settings')}">⚙</button>`}
  </div>`;
}
function footer() {
  return `<div class="footer">${t('سازنده: کوروش محسنی (Kourosh Mohseni)', 'Created by Kourosh Mohseni')}</div>`;
}
function screenTitle(s) {
  return ({
    servers: t('سرورها و زیرساخت', 'Servers'), inventory: t('اطلاعات شرکت', 'Company'),
    phonebook: t('دفتر تلفن', 'Phone Directory'), academy: t('آکادمی شبکه', 'Academy'),
    helpdesk: t('هلپدسک', 'Helpdesk'), favorites: t('علاقهمندیها', 'Favorites'),
    search: t('جستجو', 'Search'), settings: t('تنظیمات', 'Settings'),
    tools: t('ابزارهای مهندسی', 'Engineering tools'),
    users: t('مدیریت کاربران', 'Users')
  })[s] || t('داشبورد', 'Dashboard');
}
function navBar() {
  return `<nav class="bottom-nav">${NAV.map(([id, ic, fa, en]) => `
    <button class="nav-btn ${state.screen === id ? 'active' : ''}" data-act="go" data-id="${id}">
      <span class="ic">${ic}</span><span>${t(fa, en)}</span>
    </button>`).join('')}</nav>`;
}
function searchInput(key, placeholder) {
  return `<input class="field" data-input="${key}" value="${esc(state.q[key] || '')}" placeholder="${esc(placeholder)}">`;
}
function empty(msg) { return `<div class="empty">${esc(msg)}</div>`; }

/* ---------------------------------------------------------------- screens */
function dashboardView() {
  const d = state.data;
  const servers = d.servers || [], sites = [...new Set(servers.map(x => x.site).filter(Boolean))];
  const companies = d.rahkaran || [], cheats = (d.cheats || []).concat(state.refs);
  const tickets = d.tickets || [];
  const open = tickets.filter(x => !['resolved', 'closed'].includes(x.status)).length;

  const features = [
    ['inventory', '▦', t('اطلاعات شرکت', 'Company Information'),
      t('زیرساخت، سرورها، سایت‌ها، vCenter و Rahkaran ERP', 'Infrastructure, Servers, Sites, vCenter and Rahkaran ERP'),
      [`Servers (${servers.length})`, `${t('سایت‌ها', 'Sites')} (${sites.length})`, 'vCenter', `Rahkaran ERP (${companies.length})`]],
    ['academy', '◈', t('آکادمی شبکه', 'Network Academy'),
      t('نقشههای امنیتی، اینفوگرافیکها، Network+، CCNA، CCNP و راهنماها', 'Cyber maps, infographics, Network+, CCNA, CCNP and guides'),
      [t('نقشههای سایبری', 'Visual Cyber Maps'), 'URL Anatomy', 'Hashing/Encoding']],
    ['helpdesk', '◉', t('هلپدسک عیبیابی', 'Troubleshooting Helpdesk'),
      t('عیبیابی تعاملی NOC، فلوچارت، تریاژ حادثه و رفع سریع', 'Interactive NOC diagnostics, triage and quick resolution'),
      ['NOC Incident Triage', 'LAN Packet Loss', `Tickets (${open})`]],
    ['tools', '⌘', t('ابزارهای مهندسی', 'Engineering Tools'),
      t('ماشینحساب سابنت، VLSM، پهنای باند و MAC', 'Subnet, VLSM, bandwidth and MAC calculators'),
      ['Subnet Calculator', 'Bandwidth', 'MAC address']],
    ['phonebook', '☎', t('دفتر تلفن', 'Phone Directory'),
      t('.internal و موبایل شعب و شرکتها', 'Internal and mobile contacts of branches'),
      [t('نام و نام خانوادگی', 'Full Name'), t('شماره موبایل', 'Mobile'), t('شماره داخلی', 'Extension')]]
  ];

  return `
    <div class="hero">
      <div class="hero-top">
        <div class="hero-icon">◈</div>
        <div style="flex:1"><h1>NetOps Hub</h1><div class="tagline">${t('سامانه جامع مدیریت زیرساخت، سرورها و دانشنامه مهندسی', 'Network Operations & Academy Platform')}</div></div>
        <button class="apk-header-act" data-act="go" data-id="settings" style="font-size:20px;background:none;border:none;color:var(--muted)">⚙</button>
      </div>
      <span class="badge">${t('NOC TELEMETRY ONLINE', 'NOC TELEMETRY ONLINE')}</span>
    </div>

    <div class="quick-chips chips">
      <button class="chip" data-act="go" data-id="users">${t('کاربران', 'Users')}</button>
      <button class="chip" data-act="go" data-id="phonebook">${t('دفتر تلفن', 'Phonebook')}</button>
      <button class="chip" data-act="go" data-id="favorites">${t('علاقهمندیها', 'Favorites')}</button>
      <button class="chip" data-act="go" data-id="search">${t('جستجو', 'Search')}</button>
    </div>

    <div class="kpis">
      <div class="glass kpi" data-act="go" data-id="servers"><strong class="primary">${num(servers.length)}</strong><span>${t('سرور', 'Servers')}</span></div>
      <div class="glass kpi" data-act="go" data-id="inventory"><strong class="primary">${num(sites.length)}</strong><span>${t('سایت', 'Sites')}</span></div>
      <div class="glass kpi" data-act="go" data-id="inventory"><strong class="primary">${num(companies.length)}</strong><span>${t('سامانه', 'Systems')}</span></div>
      <div class="glass kpi" data-act="go" data-id="academy"><strong class="primary">${num(cheats.length)}</strong><span>${t('مطلب', 'Guides')}</span></div>
    </div>

    ${features.map(([id, icon, title, desc, chips], i) => `
      <div class="glass feature-card" style="--i:${i}" data-act="go" data-id="${id}">
        <div class="feature-head">
          <div class="feature-icon">${icon}</div>
          <div style="flex:1"><div class="feature-title">${title}</div><div class="feature-desc">${desc}</div></div>
        </div>
        <div class="feature-chips">${chips.map(c => `<button class="tag chip-action" data-act="go" data-id="${id}">${esc(c)}</button>`).join('')}</div>
      </div>`).join('')}`;
}

function serversView() {
  const q = state.q.servers || '';
  const items = (state.data.servers || []).filter(x => matches(x, q));
  return `${searchInput('servers', t('جستجو: نام، IP، سایت، سرویس…', 'Search name, IP, site, service…'))}
    <div class="row"><div class="muted" style="flex:1">${num(items.length)} ${t('سرور', 'servers')}</div>
      ${canEditRole() ? `<button class="btn" data-act="openedit" data-key="servers">+ ${t('جدید', 'New server')}</button>` : ''}</div>
    ${items.length ? items.slice(0, 300).map((x, i) => `
      <div class="list-item" style="--i:${i}" data-act="copy" data-id="${esc(x.ip)}">
        <div class="avatar">▣</div><div class="col" style="flex:1">
          <span class="item-title">${esc(x.name)}</span>
          <span class="item-sub mono">${esc(x.ip)} • ${esc(x.service || '')}</span>
        </div><span class="tag">${esc(x.site || '')}</span>
        ${canEditRole() ? `<button class="chip" data-act="openedit" data-key="servers" data-id="${esc(x.id)}">${t('ویرایش', 'Edit')}</button>` : ''}
        ${canAdminRole() ? `<button class="chip" data-act="delitem" data-key="servers" data-id="${esc(x.id)}">${t('حذف', 'Delete')}</button>` : ''}
      </div>`).join('') : empty(t('سروری یافت نشد', 'No servers found'))}`;
}
function inventoryView() {
  const tab = state.tab.inventory || 0;
  const tabs = [[0, t('IP', 'IP')], [1, 'vCenter'], [2, 'Rahkaran']];
  const key = ['ips', 'vcenters', 'rahkaran'][tab];
  const q = state.q.inventory || '';
  const items = (state.data[key] || []).filter(x => matches(x, q));
  return `
    <div class="chips">${tabs.map(([i, label]) => `<button class="chip ${tab === i ? 'active' : ''}" data-act="tab" data-key="inventory" data-id="${i}">${label}</button>`).join('')}</div>
    ${searchInput('inventory', t('جستجو در موجودی…', 'Search inventory…'))}
    <div class="row"><div class="muted" style="flex:1">${num(items.length)} ${t('رکورد', 'records')}</div>
      ${canAdminRole() ? `<button class="btn" data-act="openedit" data-key="${key}">+ ${t('افزودن', 'Add')}</button>` : ''}</div>
    ${items.length ? items.slice(0, 300).map((x, i) => `
      <div class="list-item" style="--i:${i}" data-act="copy" data-id="${esc(x.ip || '')}">
        <div class="avatar">▦</div><div class="col" style="flex:1">
          <span class="item-title mono">${esc(x.ip || x.name || x.companyName || '')}</span>
          <span class="item-sub">${esc(x.site || x.vcenter || x.companyName || '')} • ${esc(x.computerName || x.service || x.rdpPort || '')}</span>
        </div><span class="tag">${esc(x.type || x.status || '')}</span>
        ${canAdminRole() ? `<button class="chip" data-act="openedit" data-key="${key}" data-id="${esc(x.id)}">${t('ویرایش', 'Edit')}</button>
        <button class="chip" data-act="delitem" data-key="${key}" data-id="${esc(x.id)}">${t('حذف', 'Delete')}</button>` : ''}
      </div>`).join('') : empty(t('رکوردی یافت نشد', 'No records found'))}`;
}
function phoneView() {
  const q = state.q.phone || '';
  const items = (state.data.phone || []).filter(x => matches(x, q));
  return `${searchInput('phone', t('جستجو: نام، شماره، پست…', 'Search name, number, position…'))}
    <div class="row"><div class="muted" style="flex:1">${num(items.length)} ${t('مخاطب', 'contacts')}</div>
      <button class="btn" data-act="openedit" data-key="phone">+ ${t('جدید', 'New contact')}</button></div>
    ${items.length ? items.map((x, i) => `
      <div class="list-item" style="--i:${i}" data-act="call" data-id="${esc(x.mobile || x.phone || '')}">
        <div class="avatar">☎</div><div class="col" style="flex:1">
          <span class="item-title">${esc(x.name)}</span>
          <span class="item-sub">${esc(x.position || '')} ${x.extension ? '• ' + esc(x.extension) : ''}</span>
        </div><span class="tag mono">${esc(x.mobile || x.phone || '')}</span>
        <button class="chip" data-act="openedit" data-key="phone" data-id="${esc(x.id)}">${t('ویرایش', 'Edit')}</button>
        <button class="chip" data-act="delitem" data-key="phone" data-id="${esc(x.id)}">${t('حذف', 'Delete')}</button>
      </div>`).join('') : empty(t('مخاطبی یافت نشد', 'No contacts found'))}`;
}
function academyView() {
  const q = state.q.academy || '';
  const onlyFav = state.tab.academyFav || false;
  const items = state.refs.filter(x =>
    (!state.category || x.category === state.category) &&
    (!onlyFav || state.favorites.has(x.title)) && matches(x, q));
  return `
    <div class="glass card">
      <h2>◈ ${t('آکادمی شبکه', 'Network Academy')}</h2>
      <div class="muted">${num(state.refs.length)} ${t('مطلب مرجع', 'reference guides')} • ${num(CATEGORIES.length - 1)} ${t('رشته', 'disciplines')}</div>
    </div>
    <div class="chips">
      <button class="chip ${!state.category && !onlyFav ? 'active' : ''}" data-act="cat" data-id="">${t('همه', 'All')}</button>
      <button class="chip ${onlyFav ? 'active' : ''}" data-act="favtab">★ ${t('علاقهمندیها', 'Favorites')}</button>
      ${CATEGORIES.slice(1).map(([slug, fa, en]) => `
        <button class="chip ${state.category === slug ? 'active' : ''}" data-act="cat" data-id="${slug}">${t(fa, en)}</button>`).join('')}
    </div>
    ${searchInput('academy', t('جستجو در دستورات و کیووردها…', 'Search commands and keywords…'))}
    <div class="muted">${num(items.length)} ${t('نتیجه', 'results')}</div>
    ${items.length ? items.map((x, i) => `
      <div class="list-item" style="--i:${i}" data-act="article" data-id="${esc(x.title)}">
        <div class="avatar">${x.category === 'cmd-commands' ? '›_' : x.category === 'cpl-commands' ? '▤' : x.category === 'keywords' ? '#' : '◈'}</div>
        <div class="col" style="flex:1">
          <span class="item-title">${esc(x.title)}</span><span class="item-sub">${esc(x.subtitle || '')}</span>
        </div>
        <button class="star ${state.favorites.has(x.title) ? 'on' : ''}" data-act="fav" data-id="${esc(x.title)}">★</button>
      </div>`).join('') : empty(t('مطلبی یافت نشد', 'No guides found'))}`;
}
function helpdeskView() {
  const tab = state.tab.helpdesk || 0;
  const tabs = [
    [0, t('دانشنامه', 'Knowledge')], [1, t('تیکتها', 'Tickets')],
    [2, t('گزارش', 'Reports')], [3, t('عیبیابی شبکه', 'Diagnostics')]
  ];
  let body = '';
  if (tab === 0) {
    const q = state.q.kb || '';
    const items = (state.data.cheats || []).filter(x => matches(x, q));
    body = `${searchInput('kb', t('جستجو در دانشنامه…', 'Search knowledge base…'))}
      <div class="muted">${num(items.length)} ${t('مطلب', 'guides')}</div>
      ${items.length ? items.map((x, i) => `
        <div class="list-item" style="--i:${i}" data-act="article" data-id="${esc(x.title)}">
          <div class="avatar">◈</div><div class="col" style="flex:1">
            <span class="item-title">${esc(x.title)}</span><span class="item-sub">${esc(x.subtitle || '')}</span>
          </div><span class="tag">${esc(catLabel(x.category))}</span>
        </div>`).join('') : empty(t('مطلبی یافت نشد', 'No guides found'))}`;
  } else if (tab === 1) {
    const tickets = (state.data.tickets || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    body = `<div class="muted">${num(tickets.length)} ${t('تیکت', 'tickets')}</div>
      ${tickets.length ? tickets.map((x, i) => {
        const sla = slaOf(x);
        return `<div class="list-item" style="--i:${i}" data-act="ticket" data-id="${esc(x.id)}">
          <div class="avatar">◉</div><div class="col" style="flex:1">
            <span class="item-title">${esc(x.title)}</span>
            <span class="item-sub">${esc(x.displayNo || ('T-' + x.ticketNo))} • ${esc(x.site || '')} • ${esc(x.assigneeId || '')}</span>
          </div><span class="tag ${(x.priority || 'p3').toLowerCase()}">${esc(x.priority || 'P3')}</span>
          <span class="${sla.cls}" style="font-size:11px">${sla.label}</span>
        </div>`;
      }).join('') : empty(t('تیکتی یافت نشد', 'No tickets found'))}`;
  } else if (tab === 3) {
    body = diagnosticsView();
  } else {
    const tickets = state.data.tickets || [];
    const resolved = tickets.filter(x => x.resolvedAt);
    const mttr = resolved.length ? Math.round(resolved.reduce((a, x) => a + (x.resolvedAt - x.createdAt), 0) / resolved.length / 60000) : 0;
    const breached = tickets.filter(x => slaOf(x).cls === 'bad').length;
    const byCat = Object.entries(tickets.reduce((m, x) => (m[x.category || 'general'] = (m[x.category || 'general'] || 0) + 1, m), {}))
      .sort((a, b) => b[1] - a[1]).slice(0, 8);
    body = `<div class="kpis">
        <div class="glass kpi"><strong class="primary">${num(tickets.length)}</strong><span>${t('همه تیکتها', 'Total')}</span></div>
        <div class="glass kpi"><strong class="ok">${num(resolved.length)}</strong><span>${t('حلشده', 'Resolved')}</span></div>
        <div class="glass kpi"><strong class="bad">${num(breached)}</strong><span>${t('نقض SLA', 'Breached')}</span></div>
      </div>
      <div class="glass card"><h2>${t('MTTR (دقیقه)', 'MTTR (min)')}</h2><div class="primary" style="font-size:24px;font-weight:800">${num(mttr)}</div></div>
      <div class="glass card"><h2>${t('پرتکرارترینها', 'Top categories')}</h2>
        ${byCat.map(([k, v], i) => `<div class="row" style="margin:6px 0"><span style="width:90px;font-size:11px">${esc(catLabel(k))}</span>
          <div class="progress" style="flex:1"><i style="width:${Math.round(v * 100 / (byCat[0]?.[1] || 1))}%"></i></div>
          <span class="muted">${num(v)}</span></div>`).join('')}
      </div>`;
  }
  return `<div class="chips">${tabs.map(([i, label]) => `<button class="chip ${tab === i ? 'active' : ''}" data-act="tab" data-key="helpdesk" data-id="${i}">${label}</button>`).join('')}</div>${body}`;
}
function favoritesView() {
  const favs = state.refs.filter(x => state.favorites.has(x.title));
  return `<div class="glass card"><h2>★ ${t('مقالات برگزیده', 'Favorite guides')}</h2></div>
    ${favs.length ? favs.map((x, i) => `<div class="list-item" style="--i:${i}" data-act="article" data-id="${esc(x.title)}">
      <div class="avatar">★</div><div class="col" style="flex:1"><span class="item-title">${esc(x.title)}</span>
      <span class="item-sub">${esc(x.subtitle || '')}</span></div>
      <button class="star on" data-act="fav" data-id="${esc(x.title)}">★</button></div>`).join('') : empty(t('از آکادمی یک مطلب را ستارهدار کنید', 'Star a guide in Academy'))}
    <div class="hr"></div>
    <div class="glass card"><h2>${t('یادداشتهای من', 'My notes')}</h2>
      <input class="field" data-input="note" value="${esc(state.q.note || '')}" placeholder="${t('یادداشت تازه…', 'New note…')}">
      <button class="btn" data-act="addnote">+ ${t('ذخیره', 'Save')}</button>
      <div class="hr"></div>
      ${state.notes.length ? state.notes.map((n, i) => `<div class="row" style="margin:6px 0">
        <span style="flex:1;font-size:12px">${esc(n.text)}</span>
        <button class="star" data-act="delnote" data-id="${esc(n.id)}">✕</button></div>`).join('') : empty(t('یادداشتی ندارید', 'No notes yet'))}
    </div>`;
}
const DIAG_CATS = {
  LAYER1: ['لایه ۱ و کابل', 'Layer 1 & Cabling'],
  IP_DHCP: ['IP و DHCP', 'IP & DHCP'],
  DNS: ['DNS و نامگذاری', 'DNS'],
  ROUTING: ['مسیریابی و دروازه', 'Routing'],
  SWITCHING: ['سوئیچینگ و VLAN', 'Switching'],
  WIRELESS: ['وایرلس', 'Wireless'],
  FIREWALL: ['فایروال و امنیت', 'Firewall'],
  PERFORMANCE: ['عملکرد و QoS', 'Performance'],
  SERVER: ['سرورها و سرویسها', 'Servers'],
  VIRTUAL: ['مجازیسازی و vCenter', 'Virtualization'],
  VOICE: ['صدا و VoIP', 'Voice'],
  PRINTER: ['پرینترها', 'Printers'],
  SECURITY: ['حوادث امنیتی', 'Security'],
  MONITOR: ['مانیتورینگ و لاگ', 'Monitoring']
};
function diagCatName(code) {
  const c = DIAG_CATS[code];
  return c ? t(c[0], c[1]) : code;
}

function diagnosticsView() {
  const problems = state.diagnostics || [];
  const cat = state.q.diagCat || '';
  const q = state.q.diagQ || '';
  const visible = problems.filter(p =>
    (!cat || p.category === cat) &&
    (!q || JSON.stringify(p).toLowerCase().includes(q.toLowerCase()))
  );
  return `<div class="chips">
      <button class="chip ${!cat ? 'active' : ''}" data-act="diagcat" data-id="">${t('همه', 'All')}</button>
      ${Object.keys(DIAG_CATS).map(code => `<button class="chip ${cat === code ? 'active' : ''}" data-act="diagcat" data-id="${code}">${diagCatName(code)}</button>`).join('')}
    </div>
    ${searchInput('diagQ', t('جستجو در سناریوها…', 'Search scenarios…'))}
    <div class="muted">${num(visible.length)} ${t('سناریو', 'scenarios')}</div>
    ${visible.map((p, i) => `<div class="list-item" style="--i:${i}" data-act="problem" data-id="${esc(p.id)}">
      <div class="avatar">${p.severity === 'CRITICAL' || p.severity === 'HIGH' ? '⚠' : '◉'}</div>
      <div class="col" style="flex:1">
        <span class="item-title">${esc(p.id)} — ${esc(t(p.title.fa, p.title.en))}</span>
        <span class="item-sub">${esc(diagCatName(p.category))} • ${p.steps.length} ${t('مرحله', 'steps')}</span>
      </div>
      <span class="tag ${p.severity === 'HIGH' ? 'p2' : 'p3'}">${esc(p.severity)}</span>
    </div>`).join('') || empty(t('سناریویی یافت نشد', 'No scenarios found'))}`;
}

function problemModal() {
  const p = (state.diagnostics || []).find(x => x.id === state.problemId);
  if (!p) return '';
  const list = (items) => items.map(x => `<li style="margin:4px 0">${esc(t(x.fa, x.en))}</li>`).join('');
  return `<div class="modal-back" data-act="closeproblem">
    <div class="modal" data-stop="1">
      <div class="modal-head"><button class="icon-btn" data-act="closeproblem">✕</button>
        <span class="tag">${esc(diagCatName(p.category))}</span><span class="spacer"></span><span class="tag p2">${esc(p.severity)}</span></div>
      <h2>${esc(p.id)} — ${esc(t(p.title.fa, p.title.en))}</h2>
      <div class="hr"></div><h3>${t('علائم', 'Symptoms')}</h3><ul>${list(p.symptoms)}</ul>
      <div class="hr"></div><h3>${t('علل احتمالی', 'Likely causes')}</h3><ul>${list(p.causes)}</ul>
      <div class="hr"></div><h3>${t('مراحل عیبیابی', 'Resolution steps')}</h3><ol>${list(p.steps)}</ol>
      ${p.commands.length ? `<div class="hr"></div><h3>${t('دستورات', 'Commands')}</h3><div class="cmd">${esc(p.commands.join('\n'))}</div>` : ''}
    </div></div>`;
}

function usersView() {
  if (state.user?.role !== 'CREATOR' && state.user?.role !== 'ADMIN') {
    return empty(t('فقط Creator و Admin میتوانند کاربران را مدیریت کنند.', 'Only Creator and Admin can manage users.'));
  }
  const users = (state.data.users || []).filter(u => u.username !== 'kourosh');
  return `<div class="glass card">
      <h2>👤 ${t('مدیریت کاربران', 'User management')}</h2>
      <div class="muted">${t('تغییر پسورد و حذف کاربر توسط Creator', 'Password change and deletion by Creator')}</div>
      <div class="hr"></div>
      <div class="muted">${t('رمز Creator برای عملیات روی سایر کاربران لازم است.', 'Creator password is required for actions on other users.')}</div>
      <input class="field" data-input="actorPass" type="password" value="${esc(state.q.actorPass || '')}" placeholder="${t('رمز Creator', 'Creator password')}">
      <button class="btn" data-act="openusers">${t('مدیریت و لاگها', 'Manage & audit')}</button>
    </div>
    ${users.map((u, i) => `<div class="list-item" style="--i:${i}">
      <div class="avatar">👤</div><div class="col" style="flex:1">
        <span class="item-title">${esc(u.fullName || u.username)}</span>
        <span class="item-sub">@${esc(u.username)} • ${esc(u.role)}</span></div>
      ${state.user?.role === 'CREATOR' ? `<button class="chip" data-act="userpass" data-id="${esc(u.username)}">${t('پسورد', 'Password')}</button>
      <button class="chip" data-act="userdelete" data-id="${esc(u.username)}">${t('حذف', 'Delete')}</button>` : ''}
    </div>`).join('')}`;
}

function toolsView() {
  const ip = state.q.calcIp || '192.168.1.10';
  const mask = state.q.calcMask || '24';
  let result = '';
  const parts = ip.split('.').map(Number);
  const bits = parseInt(mask, 10);
  if (parts.length === 4 && parts.every(n => n >= 0 && n < 256) && bits >= 0 && bits <= 32) {
    const ipNum = ((parts[0]<<24) >>> 0) + (parts[1]<<16) + (parts[2]<<8) + parts[3];
    const maskNum = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
    const net = (ipNum & maskNum) >>> 0;
    const hosts = bits >= 31 ? (bits === 31 ? 1 : 1) : Math.pow(2, 32 - bits) - 2;
    const oct = n => [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.');
    result = `<div class="cmd">Network : ${oct(net)}
Mask    : ${oct(maskNum)} (/${bits})
Hosts   : ${num(hosts)}
Range   : ${oct(net + 1)} – ${oct((net | (~maskNum >>> 0)) - 1)}</div>`;
  }
  return `<div class="glass card">
      <h2>⌘ ${t('ماشینحساب سابنت', 'Subnet calculator')}</h2>
      <input class="field" data-input="calcIp" value="${esc(ip)}" placeholder="IP">
      <input class="field" data-input="calcMask" value="${esc(mask)}" placeholder="CIDR /24">
      ${result || `<div class="muted">${t('IP و ماسک معتبر وارد کنید.', 'Enter a valid IP and mask.')}</div>`}
    </div>
    <div class="glass card">
      <h2>${t('پهنای باند', 'Bandwidth')}</h2>
      <div class="muted">${t('۱۰۰Mbps ≈ ۱۲.۵MB/s • ۱Gbps ≈ ۱۲۵MB/s', '100Mbps ≈ 12.5MB/s • 1Gbps ≈ 125MB/s')}</div>
    </div>`;
}

function searchView() {
  const q = state.q.global || '';
  const groups = [];
  if (q.trim()) {
    const add = (label, icon, items, titleOf, subOf, act) => {
      const found = items.filter(x => matches(x, q)).slice(0, 10);
      if (found.length) groups.push([label, icon, found, titleOf, subOf, act]);
    };
    add(t('سرورها', 'Servers'), '▣', state.data.servers || [], x => x.name, x => `${x.ip} • ${x.site}`, 'copy');
    add(t('دفتر تلفن', 'Phonebook'), '☎', state.data.phone || [], x => x.name, x => x.mobile || x.phone, 'call');
    add(t('آکادمی', 'Academy'), '◈', state.refs, x => x.title, x => x.subtitle, 'article');
    add(t('دانشنامه', 'Knowledge'), '◈', state.data.cheats || [], x => x.title, x => x.subtitle, 'article');
    add(t('موجودی IP', 'IP inventory'), '▦', state.data.ips || [], x => x.ip, x => `${x.site} • ${x.computerName}`, 'copy');
    add(t('Rahkaran'), '▤', state.data.rahkaran || [], x => x.companyName, x => x.ip, 'copy');
    add(t('تیکتها', 'Tickets'), '◉', state.data.tickets || [], x => x.title, x => x.displayNo || ('T-' + x.ticketNo), 'ticket');
  }
  return `${searchInput('global', t('جستجو در همهی دادهها…', 'Search across all data…'))}
    ${q.trim() ? `<div class="muted">${num(groups.reduce((a, g) => a + g[2].length, 0))} ${t('نتیجه', 'results')}</div>` : empty(t('عبارتی وارد کنید', 'Type something to search'))}
    ${groups.map(([label, icon, items, titleOf, subOf, act], gi) => `
      <h2 style="margin-top:12px">${icon} ${label}</h2>
      ${items.map((x, i) => `<div class="list-item" style="--i:${i + gi}" data-act="${act}" data-id="${esc(titleOf(x))}">
        <div class="avatar">${icon}</div><div class="col" style="flex:1">
          <span class="item-title">${esc(titleOf(x))}</span><span class="item-sub">${esc(subOf(x) || '')}</span></div></div>`).join('')}`).join('')}`;
}
function settingsView() {
  return `
    <div class="glass card">
      <h2>${t('ظاهر', 'Appearance')}</h2>
      <div class="chips">${PALETTES.map(([id, fa, en]) => `<button class="chip ${state.palette === id ? 'active' : ''}" data-act="palette" data-id="${id}">${t(fa, en)}</button>`).join('')}</div>
      <div class="row"><span class="muted">${t('زبان', 'Language')}</span>
        <button class="chip ${state.lang === 'fa' ? 'active' : ''}" data-act="lang" data-id="fa">فارسی</button>
        <button class="chip ${state.lang === 'en' ? 'active' : ''}" data-act="lang" data-id="en">English</button></div>
      <div class="row"><span class="muted">${t('جلوههای صوتی', 'Sound effects')}</span>
        <button class="chip ${localStorage.getItem('netops.sound') !== '0' ? 'active' : ''}" data-act="sound">${t('روشن', 'On')}</button>
        <button class="chip ${localStorage.getItem('netops.sound') === '0' ? 'active' : ''}" data-act="soundoff">${t('خاموش', 'Off')}</button></div>
      <div class="hr"></div>
      <div class="row"><span class="muted">${t('شفافیت شیشه', 'Glass opacity')} ${Math.round(state.glass * 100)}%</span></div>
      <input type="range" min="10" max="95" value="${Math.round(state.glass * 100)}" data-input="glass" style="width:100%">
    </div>
    <div class="glass card">
      <h2>${t('نسخه و دادهها', 'Version & data')}</h2>
      <button class="btn ghost" data-act="selfpass">🔑 ${t('تغییر پسورد من', 'Change my password')}</button>
      <div class="hr"></div>
      ${state.user?.role === 'CREATOR' ? `<button class="btn" data-act="openusers">👤 ${t('مدیریت کاربران و لاگها', 'Users & audit log')}</button><div class="hr"></div>` : ''}
      <div class="muted">${t('نسخهی ابری', 'Cloud release')}: ${esc(state.release?.versionName || '—')} • ${esc(state.release?.notes || '')}</div>
      <div class="muted">${t('آخرین دریافت', 'Last sync')}: ${ago(JSON.parse(localStorage.getItem('netops.data') || '{}').ts)}</div>
      <div class="row wrap" style="margin-top:10px">
        <button class="btn" data-act="refresh">↻ ${t('دریافت مجدد', 'Refresh')}</button>
        <button class="btn ghost" data-act="cache">${t('پاک کردن کش', 'Clear cache')}</button>
        <button class="btn danger" data-act="logout">${t('خروج', 'Sign out')}</button>
      </div>
    </div>
    <div class="glass card"><h2>${t('آپدیت', 'Updates')}</h2>
      <div class="muted">${t('این نسخه وب است و بهصورت خودکار آپدیت میشود؛ نیاز به نصب APK نیست.', 'This is a web app and updates automatically — no APK install needed.')}</div>
    </div>`;
}

function editModal() {
  const target = state.editTarget;
  if (!target) return '';
  const fields = EDIT_FIELDS[target.collection] || [];
  return `<div class="modal-back" data-act="closeedit">
    <div class="modal" data-stop="1">
      <div class="modal-head"><button class="icon-btn" data-act="closeedit">✕</button>
        <h2>${target.id ? t('ویرایش', 'Edit') : t('افزودن', 'Add')} — ${esc(target.collection)}</h2></div>
      ${fields.map((f, i) => `<input class="field" data-input="edit_${f}" value="${esc(target.item[f] || '')}" placeholder="${esc(f)}">`).join('')}
      <button class="btn solid" data-act="saveedit">${t('ذخیره', 'Save')}</button>
    </div></div>`;
}

/* ---------------------------------------------------------------- modals */
function articleModal() {
  const x = state.article;
  if (!x) return '';
  return `<div class="modal-back" data-act="closemodal">
    <div class="modal" data-stop="1">
      <div class="modal-head">
        <button class="icon-btn" data-act="closemodal">✕</button>
        <span class="tag">${esc(catLabel(x.category))}</span>
        <span class="spacer"></span>
        <button class="star ${state.favorites.has(x.title) ? 'on' : ''}" data-act="fav" data-id="${esc(x.title)}">★</button>
      </div>
      <h2>${esc(x.title)}</h2>
      ${x.subtitle ? `<div class="muted">${esc(x.subtitle)}</div>` : ''}
      <div class="hr"></div>
      ${x.command ? `<div class="row"><span class="muted">${t('دستور / مرجع', 'Command / reference')}</span><span class="spacer"></span>
        <button class="chip" data-act="copy" data-id="${esc(x.command)}">⧉ ${t('کپی', 'Copy')}</button></div>
        <div class="cmd" style="margin-top:6px">${esc(x.command)}</div>
        ${/^https?:/.test(x.command) ? `<button class="btn solid" data-act="openlink" data-id="${esc(x.command)}">${t('باز کردن ویدیو / درس', 'Open video / lesson')}</button>` : ''}` : ''}
      ${x.description ? `<div class="hr"></div><div>${esc(x.description)}</div>` : ''}
      ${x.tags ? `<div class="hr"></div><div class="dim"># ${esc(x.tags)}</div>` : ''}
    </div></div>`;
}
function ticketModal() {
  const x = state.ticket;
  if (!x) return '';
  const comments = (state.data.ticket_comments || []).filter(c => c.ticketId === x.id);
  const activity = (state.data.ticket_activity || []).filter(a => a.ticketId === x.id);
  const sla = slaOf(x);
  return `<div class="modal-back" data-act="closeticket">
    <div class="modal" data-stop="1">
      <div class="modal-head"><button class="icon-btn" data-act="closeticket">✕</button>
        <span class="tag ${(x.priority || 'p3').toLowerCase()}">${esc(x.priority || 'P3')}</span>
        <span class="spacer"></span><span class="${sla.cls}">${sla.label}</span></div>
      <h2>${esc(x.title)}</h2>
      <div class="muted">${esc(x.displayNo || ('T-' + x.ticketNo))} • ${esc(x.status || '')} • ${esc(x.site || '')} • ${esc(x.assigneeId || '')}</div>
      <div class="hr"></div><div>${esc(x.description || '')}</div>
      <div class="hr"></div><h3>${t('پاسخها', 'Comments')} (${num(comments.length)})</h3>
      ${comments.map(c => `<div class="glass card" style="--i:0"><div class="row"><span class="primary">${esc(c.authorId)}</span>
        ${c.isInternal ? `<span class="tag warn">${t('داخلی', 'Internal')}</span>` : ''}<span class="spacer"></span><span class="dim">${ago(c.createdAt)}</span></div>
        <div style="margin-top:6px">${esc(c.body)}</div></div>`).join('') || empty(t('پاسخی نیست', 'No comments'))}
      <div class="hr"></div><h3>${t('تاریخچه', 'Activity')}</h3>
      ${activity.slice(-12).map(a => `<div class="row" style="font-size:11px;padding:3px 0"><span class="primary">${esc(a.action)}</span>
        <span class="muted">${esc(a.fromValue || '')} ${a.toValue ? '→ ' + esc(a.toValue) : ''}</span><span class="spacer"></span><span class="dim">${ago(a.createdAt)}</span></div>`).join('') || empty(t('رویدادی نیست', 'No activity'))}
    </div></div>`;
}

/* ---------------------------------------------------------------- users */
function usersModal() {
  if (!state.userModal || state.user?.role !== 'CREATOR') return '';
  const users = (state.data.users || []).filter(u => u.username !== 'kourosh');
  const logs = (state.data.audit_log || []).slice(0, 200);
  return `<div class="modal-back" data-act="closeusers">
    <div class="modal" data-stop="1">
      <div class="modal-head"><button class="icon-btn" data-act="closeusers">✕</button>
        <h2>${t('مدیریت کاربران و لاگها', 'Users & audit log')}</h2></div>
      <div class="chips">
        <button class="chip ${state.userTab === 0 ? 'active' : ''}" data-act="usertab" data-id="0">${t('کاربران', 'Users')}</button>
        <button class="chip ${state.userTab === 1 ? 'active' : ''}" data-act="usertab" data-id="1">${t('لاگ تغییرات', 'Audit log')}</button>
      </div>
      ${state.userTab === 0 ? `
        <div class="glass card"><div class="muted">${t('برای تغییر رمز یا حذف کاربر، ابتدا رمز Creator را وارد کنید.', 'Enter the Creator password before changing or deleting a user.')}</div>
          <input class="field" data-input="actorPass" type="password" value="${esc(state.q.actorPass || '')}" placeholder="${t('رمز Creator', 'Creator password')}">
        </div>
        ${users.map((u, i) => `<div class="list-item" style="--i:${i}">
          <div class="avatar">👤</div><div class="col" style="flex:1">
            <span class="item-title">${esc(u.fullName || u.username)}</span>
            <span class="item-sub">@${esc(u.username)} • ${esc(u.role)}</span></div>
          <button class="chip" data-act="userpass" data-id="${esc(u.username)}">${t('پسورد', 'Password')}</button>
          <button class="chip" data-act="userdelete" data-id="${esc(u.username)}">${t('حذف', 'Delete')}</button>
        </div>`).join('') || empty(t('کاربر دیگری نیست', 'No other users'))}` : `
        <div class="muted">${t('آخرین ۲۰۰ تغییر — کی، چه کاری و چه زمانی', 'Last 200 changes — who did what and when')}</div>
        ${logs.map((l, i) => `<div class="list-item" style="--i:${i}">
          <div class="avatar">✓</div><div class="col" style="flex:1">
            <span class="item-title">${esc(l.action)}</span>
            <span class="item-sub">${esc(l.actorId)} • ${esc(l.target || '')} ${l.detail ? '• ' + esc(l.detail) : ''}</span></div>
          <span class="dim">${ago(l.createdAt)}</span></div>`).join('') || empty(t('لاگی وجود ندارد', 'No audit entries'))}`}
    </div></div>`;
}

/* ---------------------------------------------------------------- events */
function render(preserveScroll = false) {
  applyTheme();
  if (!state.user) { loginView(); return; }
  appView();
  if (!preserveScroll) window.scrollTo({ top: 0, behavior: 'instant' });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('کپی شد', 'Copied'));
  } catch (e) {
    toast(t('کپی ناموفق بود', 'Copy failed'));
  }
}

document.addEventListener('submit', async e => {
  if (e.target.id !== 'loginForm') return;
  e.preventDefault();
  const fd = new FormData(e.target);
  const err = document.getElementById('loginErr');
  err.textContent = t('در حال ورود…', 'Signing in…');
  try {
    const res = await api('/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') })
    });
    if (!res.ok) { err.textContent = res.error || t('ورود ناموفق', 'Login failed'); return; }
    state.user = res.user;
    state.token = res.token || '';
    sessionStorage.setItem('netops.user', JSON.stringify(res.user));
    sessionStorage.setItem('netops.token', state.token);
    loadCached();
    render();
    loadData();
  } catch (ex) { err.textContent = ex.message; }
});

document.addEventListener('input', e => {
  const key = e.target.dataset.input;
  if (!key) return;
  if (key === 'glass') {
    state.glass = +e.target.value / 100;
    localStorage.setItem('netops.glass', String(state.glass));
    applyTheme();
    return;
  }
  state.q[key] = e.target.value;
  // فیلدهای دیالوگ ویرایش نباید کل رابط را بازسازی کنند؛ بازسازی باعث از دست رفتن فوکوس میشود
  if (key.startsWith('edit_') || key === 'note') return;
  const pos = e.target.selectionStart;
  render();
  const next = document.querySelector(`[data-input="${key}"]`);
  if (next) { next.focus(); next.setSelectionRange(pos, pos); }
});

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  beep(act === 'logout' || act === 'delnote' ? 'error' : 'click');

  if (act === 'closemodal' && e.target.closest('[data-stop]')) return;
  if (act === 'closeticket' && e.target.closest('[data-stop]')) return;

  switch (act) {
    case 'diagcat':
      state.q.diagCat = id; render(); break;
    case 'problem':
      state.problemId = id; render(); break;
    case 'closeproblem':
      if (e.target.closest('[data-stop]')) return;
      state.problemId = null; render(); break;
    case 'saveedit': {
      if (!state.editTarget) return;
      const item = { ...state.editTarget.item };
      (EDIT_FIELDS[state.editTarget.collection] || []).forEach(f => { item[f] = state.q['edit_' + f] || ''; });
      writeCollection(state.editTarget.collection, item.id ? 'upsert' : 'create', item, item.id);
      break;
    }
    case 'closeedit':
      if (e.target.closest('[data-stop]')) return;
      state.editTarget = null; render(); break;
    case 'openedit': {
      const collection = el.dataset.key;
      const item = collection === 'phone' ? (state.data.phone || []).find(x => x.id === id)
        : collection === 'servers' ? (state.data.servers || []).find(x => x.id === id)
        : (state.data[collection] || []).find(x => x.id === id);
      state.editTarget = { collection, id: id || null, item: { ...(item || {}) } };
      (EDIT_FIELDS[collection] || []).forEach(f => { state.q['edit_' + f] = (item || {})[f] || ''; });
      render(); break;
    }
    case 'delitem':
      if (!confirm(t('آیا حذف شود؟', 'Delete this item?'))) return;
      writeCollection(el.dataset.key, 'delete', {}, id);
      break;
    case 'go':
      state.screen = id;
      state.article = null; state.ticket = null;
      render(); break;
    case 'tab':
      state.tab[el.dataset.key] = +id; render(); break;
    case 'cat':
      state.category = id; render(); break;
    case 'favtab':
      state.tab.academyFav = !state.tab.academyFav; render(); break;
    case 'fav':
      e.stopPropagation();
      if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
      localStorage.setItem('netops.favorites', JSON.stringify([...state.favorites]));
      render(); break;
    case 'article': {
      const item = state.refs.find(x => x.title === id) || (state.data.cheats || []).find(x => x.title === id);
      if (item) { state.article = item; render(); }
      break;
    }
    case 'closemodal':
      state.article = null; render(); break;
    case 'ticket': {
      const item = (state.data.tickets || []).find(x =>
        x.id === id || x.title === id || (x.displayNo || '') === id || ('T-' + x.ticketNo) === id);
      if (item) { state.ticket = item; render(); }
      break;
    }
    case 'closeticket':
      state.ticket = null; render(); break;
    case 'openlink':
      try { window.open(id, '_blank', 'noopener'); } catch (e) {}
      break;
    case 'copy':
      copyText(id); break;
    case 'call':
      if (id) location.href = 'tel:' + id.replace(/[^\d+]/g, '');
      break;
    case 'palette':
      state.palette = id; localStorage.setItem('netops.palette', id); render(); break;
    case 'lang':
      state.lang = id; localStorage.setItem('netops.lang', id); render(); break;
    case 'refresh':
      await loadData(); toast(t('دادهها بروزرسانی شد', 'Data refreshed')); break;
    case 'cache':
      localStorage.removeItem('netops.data');
      toast(t('کش پاک شد', 'Cache cleared')); break;
    case 'logout':
      state.user = null; sessionStorage.removeItem('netops.user'); render(); break;
    case 'openusers':
      state.userModal = true; state.userTab = 0; render(); break;
    case 'closeusers':
      if (e.target.closest('[data-stop]')) return;
      state.userModal = false; render(); break;
    case 'usertab':
      state.userTab = +id; render(); break;
    case 'sound':
      localStorage.setItem('netops.sound', '1'); beep('success'); render(); break;
    case 'soundoff':
      localStorage.setItem('netops.sound', '0'); render(); break;
    case 'selfpass': {
      const oldPassword = prompt(t('رمز فعلی خود را وارد کنید', 'Enter your current password'));
      if (!oldPassword) return;
      const next = prompt(t('رمز جدید (حداقل ۶ کاراکتر)', 'New password (at least 6 chars)'));
      if (!next || next.length < 6) { toast(t('رمز جدید کوتاه است', 'Password too short')); return; }
      try {
        const res = await api('/password/self', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: state.user.username, oldPassword, newPassword: next })
        });
        toast(res.ok ? t('رمز تغییر کرد', 'Password changed') : (res.error || 'Error'));
        beep(res.ok ? 'success' : 'error');
      } catch (ex) { toast(ex.message); }
      break;
    }
    case 'userpass': {
      const next = prompt(t('رمز جدید برای ' + id, 'New password for ' + id));
      if (!next || next.length < 6) { toast(t('رمز جدید باید حداقل ۶ کاراکتر باشد', 'At least 6 characters')); return; }
      try {
        const res = await api('/password', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actor: state.user.username, actorPassword: state.q.actorPass || '', username: id, newPassword: next })
        });
        toast(res.ok ? t('رمز تغییر کرد', 'Password changed') : (res.error || 'Error'));
        beep(res.ok ? 'success' : 'error');
        loadData();
      } catch (ex) { toast(ex.message); }
      break;
    }
    case 'userdelete': {
      if (!confirm(t('آیا «' + id + '» حذف شود؟', 'Delete ' + id + '?'))) return;
      try {
        const res = await api('/user/delete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actor: state.user.username, actorPassword: state.q.actorPass || '', username: id })
        });
        toast(res.ok ? t('کاربر حذف شد', 'User deleted') : (res.error || 'Error'));
        beep(res.ok ? 'success' : 'error');
        loadData();
      } catch (ex) { toast(ex.message); }
      break;
    }
    case 'addnote':
      if ((state.q.note || '').trim()) {
        state.notes.unshift({ id: Date.now().toString(), text: state.q.note.trim(), createdAt: Date.now() });
        state.q.note = '';
        localStorage.setItem('netops.notes', JSON.stringify(state.notes));
        render();
      }
      break;
    case 'delnote':
      state.notes = state.notes.filter(n => n.id !== id);
      localStorage.setItem('netops.notes', JSON.stringify(state.notes));
      render(); break;
  }
});

window.addEventListener('online', () => { state.online = true; loadData(); });
window.addEventListener('offline', () => { state.online = false; toast(t('آفلاین — از کش استفاده میشود', 'Offline — using cache')); });

/* ---------------------------------------------------------------- start */
async function boot() {
  applyTheme();
  const cachedUser = sessionStorage.getItem('netops.user');
  if (cachedUser) {
    try { state.user = JSON.parse(cachedUser); } catch (e) {}
  }
  loadCached();
  render();
  if (state.user) await loadData();
}
boot();
