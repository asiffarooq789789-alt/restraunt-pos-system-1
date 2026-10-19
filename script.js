/* ================= STORAGE ================= */
const DB = {
  get: (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};

let products  = DB.get('products', []);
let stores    = DB.get('stores', []);
let mainStore = DB.get('mainStore', {});
let transfers = DB.get('transfers', []);
let accounts  = DB.get('accounts', {});
let users     = DB.get('users', []);
let logs      = DB.get('logs', []);
let currentUser = null;

function saveAll() {
  DB.set('products', products);
  DB.set('stores', stores);
  DB.set('mainStore', mainStore);
  DB.set('transfers', transfers);
  DB.set('accounts', accounts);
  DB.set('users', users);
  DB.set('logs', logs);
}

/* ================= HELPERS ================= */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const getProduct = id => products.find(p => p.id === id);
const getStore = id => stores.find(s => s.id === id);
const fmtRs = n => 'Rs ' + Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function toast(msg, type = 'success') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = 'toast', 3000);
}

/* Activity log */
function addLog(action, details) {
  logs.unshift({
    id: uid(),
    time: new Date().toLocaleString(),
    userId: currentUser?.id || 'system',
    userName: currentUser?.fullName || 'System',
    action,
    details
  });
  if (logs.length > 500) logs = logs.slice(0, 500);
  saveAll();
}

/* Permission check */
function canDo(action) {
  if (!currentUser) return false;
  const role = currentUser.role;
  if (role === 'admin') return true;
  if (action === 'products') return false;
  if (action === 'users') return false;
  if (action === 'transfer' && role === 'staff') return false;
  if (action === 'purchase' && role === 'staff') return false;
  return true;
}

/* ================= AUTH ================= */
function initUsers() {
  if (users.length === 0) {
    users = [
      { id: uid(), username: 'admin',   password: 'admin123',   fullName: 'Admin User', role: 'admin',   storeId: '' },
      { id: uid(), username: 'manager', password: 'manager123', fullName: 'Main Manager', role: 'manager', storeId: '' },
      { id: uid(), username: 'kitchen', password: 'kitchen123', fullName: 'Kitchen Staff', role: 'staff', storeId: '' },
      { id: uid(), username: 'bar',     password: 'bar123',     fullName: 'Bar Staff',    role: 'staff', storeId: '' }
    ];
    saveAll();
  }
}

function handleLogin(e) {
  e.preventDefault();
  const u = $('#loginUser').value.trim();
  const p = $('#loginPass').value;
  const msg = $('#loginMsg');

  const user = users.find(x => x.username === u && x.password === p);
  if (!user) {
    msg.textContent = '❌ Invalid username or password';
    msg.className = 'login-msg error';
    return;
  }

  currentUser = user;
  sessionStorage.setItem('currentUserId', user.id);
  msg.textContent = '✅ Login successful...';
  msg.className = 'login-msg success';

  setTimeout(() => {
    $('#loginScreen').classList.add('hidden');
    $('#appRoot').style.display = 'block';
    applyUserPermissions();
    renderAll();
    addLog('LOGIN', `${user.fullName} logged in`);
  }, 500);
}

function logout() {
  if (currentUser) addLog('LOGOUT', `${currentUser.fullName} logged out`);
  currentUser = null;
  sessionStorage.removeItem('currentUserId');
  $('#appRoot').style.display = 'none';
  $('#loginScreen').classList.remove('hidden');
  $('#loginUser').value = '';
  $('#loginPass').value = '';
  $('#loginMsg').textContent = '';
}

function restoreSession() {
  const id = sessionStorage.getItem('currentUserId');
  if (!id) return false;
  const user = users.find(u => u.id === id);
  if (!user) return false;
  currentUser = user;
  $('#loginScreen').classList.add('hidden');
  $('#appRoot').style.display = 'block';
  applyUserPermissions();
  return true;
}

function applyUserPermissions() {
  if (!currentUser) return;

  // Update user chip
  $('#userName').textContent = currentUser.fullName;
  $('#userRole').textContent = currentUser.role;
  $('#userAvatar').textContent = currentUser.fullName.charAt(0).toUpperCase();

  // Dashboard subtitle
  const storeName = currentUser.storeId ? getStore(currentUser.storeId)?.name : '';
  $('#dashSubtitle').textContent = currentUser.role === 'admin'
    ? 'Overview of entire restaurant stock'
    : `Welcome ${currentUser.fullName}${storeName ? ' — ' + storeName : ''}`;

  // Hide nav buttons by role
  $$('.nav-btn').forEach(btn => {
    const roles = (btn.dataset.roles || '').split(',');
    if (roles.includes(currentUser.role)) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  });

  // Hide add store form for non-admin? Actually managers can add too. Keep.
}

/* ================= THEME ================= */
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

$('#themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data
