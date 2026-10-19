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
let currentBranchId = null;

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
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = 'toast', 3000);
}

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

function canDo(action) {
  if (!currentUser) return false;
  const role = currentUser.role;
  if (role === 'admin') return true;
  if (action === 'products' || action === 'users') return false;
  if ((action === 'transfer' || action === 'purchase') && role === 'staff') return false;
  return true;
}

/* ================= INIT USERS ================= */
function initUsers() {
  if (users.length === 0) {
    users = [
      { id: uid(), username: 'admin',   password: 'admin123',   fullName: 'Admin User',   role: 'admin',   storeId: '' },
      { id: uid(), username: 'manager', password: 'manager123', fullName: 'Main Manager', role: 'manager', storeId: '' },
      { id: uid(), username: 'kitchen', password: 'kitchen123', fullName: 'Kitchen Staff', role: 'staff',   storeId: '' },
      { id: uid(), username: 'bar',     password: 'bar123',     fullName: 'Bar Staff',    role: 'staff',   storeId: '' }
    ];
    saveAll();
  }
}

/* ================= LOGIN ================= */
function setupLogin() {
  const form = $('#loginForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const u = $('#loginUser').value.trim();
    const p = $('#loginPass').value;
    const msg = $('#loginMsg');

    // Reload users fresh from storage (in case created in another tab)
    users = DB.get('users', []);

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
    }, 300);
  });

  const logoutBtn = $('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (!confirm('Logout?')) return;
      if (currentUser) addLog('LOGOUT', `${currentUser.fullName} logged out`);
      currentUser = null;
      sessionStorage.removeItem('currentUserId');
      $('#appRoot').style.display = 'none';
      $('#loginScreen').classList.remove('hidden');
      $('#loginUser').value = '';
      $('#loginPass').value = '';
      $('#loginMsg').textContent = '';
    });
  }
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

  $('#userName').textContent = currentUser.fullName;
  $('#userRole').textContent = currentUser.role;
  $('#userAvatar').textContent = currentUser.fullName.charAt(0).toUpperCase();

  const storeName = currentUser.storeId ? getStore(currentUser.storeId)?.name : '';
  $('#dashSubtitle').textContent = currentUser.role === 'admin'
    ? 'Overview of entire restaurant stock'
    : `Welcome ${currentUser.fullName}${storeName ? ' — ' + storeName : ''}`;

  $$('.nav-btn').forEach(btn => {
    const roles = (btn.dataset.roles || '').split(',');
    if (roles.includes(currentUser.role)) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
  });
}

/* ================= THEME ================= */
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

function setupTheme() {
  const btn = $('#themeToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
  });
}

function updateThemeIcon(theme) {
  const btn = $('#themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

/* ================= SIDEBAR ================= */
function setupSidebar() {
  const openBtn = $('#menuToggle');
  const closeBtn = $('#closeSidebar');
  const overlay = $('#overlay');

  if (openBtn) openBtn.addEventListener('click', () => {
    $('#sidebar').classList.add('open');
    $('#overlay').classList.add('show');
  });
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);
}

function closeSidebar() {
  const sb = $('#sidebar'); const ov = $('#overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('show');
}

/* ================= NAVIGATION ================= */
function setupNav() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.page').forEach(p => p.classList.remove('active'));
      const page = $('#' + btn.dataset.page);
      if (page) page.classList.add('active');
      closeSidebar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/* ================= NOTIFICATIONS ================= */
function setupNotifications() {
  const notifBtn = $('#notifBtn');
  const closeNotif = $('#closeNotif');
  if (notifBtn) notifBtn.addEventListener('click', e => {
    e.stopPropagation();
    $('#notifPanel').classList.toggle('show');
  });
  if (closeNotif) closeNotif.addEventListener('click', () => $('#notifPanel').classList.remove('show'));

  document.addEventListener('click', e => {
    if (!e.target.closest('#notifPanel') && !e.target.closest('#notifBtn')) {
      const np = $('#notifPanel');
      if (np) np.classList.remove('show');
    }
  });
}

function getLowStockAlerts() {
  const alerts = [];
  Object.entries(mainStore).forEach(([pid, qty]) => {
    const p = getProduct(pid);
    if (!p || qty <= 0) return;
    if (qty < 10) {
      alerts.push({ name: p.name, msg: `Main Store: only ${qty} ${p.unit} left`, level: qty < 5 ? 'danger' : 'warn' });
    }
  });
  return alerts;
}

function renderNotifications() {
  const alerts = getLowStockAlerts();
  const badge = $('#notifBadge');
  if (badge) {
    badge.textContent = alerts.length;
    badge.style.display = alerts.length ? 'block' : 'none';
  }
  const list = $('#notifList');
  if (!list) return;
  if (!alerts.length) {
    list.innerHTML = `<div class="empty-state"><span class="emoji">✨</span>All good! No alerts.</div>`;
    return;
  }
  list.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.level}">
      <span class="icon">${a.level === 'danger' ? '🚨' : '⚠️'}</span>
      <div class="info"><strong>${a.name}</strong><span>${a.msg}</span></div>
    </div>
  `).join('');
}

/* ================= PRODUCTS ================= */
function setupProducts() {
  const form = $('#productForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!canDo('products')) return toast('❌ Only admin', 'error');

    const name = $('#productName').value.trim();
    const price = parseFloat($('#productPrice').value);
    const unit = $('#productUnit').value.trim();
    if (!name || isNaN(price) || !unit) return;

    products.push({ id: uid(), name, price, unit });
    saveAll();
    e.target.reset();
    addLog('ADD_PRODUCT', `Added product: ${name}`);
    renderAll();
    toast(`✅ "${name}" added`);
  });
}

window.deleteProduct = function(id) {
  if (!canDo('products')) return toast('❌ No permission', 'error');
  const p = getProduct(id);
  if (!confirm(`Delete "${p.name}"?`)) return;
  products = products.filter(x => x.id !== id);
  delete mainStore[id];
  stores.forEach(s => delete s.items[id]);
  Object.keys(accounts).forEach(sid => delete accounts[sid][id]);
  saveAll();
  addLog('DELETE_PRODUCT', `Deleted product: ${p.name}`);
  renderAll();
  toast('🗑️ Product deleted', 'error');
};

function renderProducts() {
  const tbody = $('#productsTable');
  if (!tbody) return;
  tbody.innerHTML = products.length === 0
    ? `<tr><td colspan="4"><div class="empty-state"><span class="emoji">📦</span>No products yet</div></td></tr>`
    : products.map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${fmtRs(p.price)}</td>
        <td>${p.unit}</td>
        <td><button class="btn danger" onclick="deleteProduct('${p.id}')">Delete</button></td>
      </tr>
    `).join('');
}

/* ================= PURCHASE ================= */
function setupPurchase() {
  const form = $('#purchaseForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!canDo('purchase')) return toast('❌ No permission', 'error');

    const pid = $('#purchaseProduct').value;
    const qty = parseInt($('#purchaseQty').value);
    const priceInput = $('#purchasePrice').value;
    if (!pid || qty <= 0) return;

    const product = getProduct(pid);
    if (!product) return;

    if (priceInput && !isNaN(parseFloat(priceInput))) product.price = parseFloat(priceInput);

    mainStore[pid] = (mainStore[pid] || 0) + qty;
    saveAll();
    e.target.reset();
    addLog('PURCHASE', `${qty} ${product.unit} of ${product.name} added to Main Store`);
    renderAll();
    toast(`📦 ${qty} ${product.unit} of ${product.name} added`);
  });
}

function renderMainStore() {
  const tbody = $('#mainStoreTable');
  if (!tbody) return;
  const entries = Object.entries(mainStore).filter(([, q]) => q > 0);
  tbody.innerHTML = entries.length === 0
    ? `<tr><td colspan="4"><div class="empty-state"><span class="emoji">🏬</span>Main store is empty</div></td></tr>`
    : entries.map(([pid, qty]) => {
        const p = getProduct(pid);
        if (!p) return '';
        return `<tr><td><strong>${p.name}</strong></td><td>${qty} ${p.unit}</td><td>${fmtRs(p.price)}</td><td><strong>${fmtRs(qty * p.price)}</strong></td></tr>`;
      }).join('');
}

/* ================= STORES ================= */
function setupStores() {
  const form = $('#storeForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#storeName').value.trim();
    if (!name) return;
    stores.push({ id: uid(), name, items: {} });
    saveAll();
    e.target.reset();
    addLog('ADD_STORE', `Added store: ${name}`);
    renderAll();
    toast(`🏪 "${name}" store added`);
  });
}

window.deleteStore = function(id) {
  if (!confirm(`Delete this store? All stock will be lost.`)) return;
  const s = getStore(id);
  stores = stores.filter(x => x.id !== id);
  delete accounts[id];
  saveAll();
  addLog('DELETE_STORE', `Deleted store: ${s?.name}`);
  renderAll();
  toast('🗑️ Store deleted', 'error');
};

function renderStores() {
  const container = $('#storesList');
  if (!container) return;
  if (!stores.length) {
    container.innerHTML = `<div class="empty-state"><span class="emoji">🏪</span>No sub stores yet. Add one above!</div>`;
    return;
  }
  container.innerHTML = stores.map(s => {
    const items = Object.entries(s.items).filter(([, q]) => q > 0);
    let total = 0;
    items.forEach(([pid, qty]) => {
      const p = getProduct(pid);
      if (p) total += qty * p.price;
    });

    return `
      <div class="store-card">
        <h3>🏪 ${s.name}</h3>
        <div class="store-items">
          ${items.length === 0
            ? `<div class="item"><span>No stock</span></div>`
            : items.slice(0, 4).map(([pid, qty]) => {
                const p = getProduct(pid);
                if (!p) return '';
                return `<div class="item"><span>${p.name}</span><strong>${qty} ${p.unit}</strong></div>`;
              }).join('') +
              (items.length > 4 ? `<div class="item"><span>+ ${items.length - 4} more...</span></div>` : '')
          }
        </div>
        <div class="store-actions">
          <span class="store-total">${fmtRs(total)}</span>
          <button class="btn danger" onclick="deleteStore('${s.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

/* ================= TRANSFER ================= */
function setupTransfer() {
  const form = $('#transferForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!canDo('transfer')) return toast('❌ No permission', 'error');

    const pid = $('#transferProduct').value;
    const sid = $('#transferStore').value;
    const qty = parseInt($('#transferQty').value);
    const msg = $('#transferMsg');

    if (!pid || !sid || qty <= 0) {
      msg.textContent = '⚠️ Fill all fields';
      msg.className = 'msg show error';
      return;
    }

    const available = mainStore[pid] || 0;
    if (qty > available) {
      msg.textContent = `❌ Not enough stock. Available: ${available}`;
      msg.className = 'msg show error';
      return;
    }

    const product = getProduct(pid);
    const store = getStore(sid);
    if (!product || !store) return;

    mainStore[pid] -= qty;
    store.items[pid] = (store.items[pid] || 0) + qty;

    if (!accounts[sid]) accounts[sid] = {};
    if (!accounts[sid][pid]) accounts[sid][pid] = { qty: 0, price: product.price };
    accounts[sid][pid].qty += qty;
    accounts[sid][pid].price = product.price;

    transfers.unshift({
      date: new Date().toLocaleString(),
      productId: pid,
      storeId: sid,
      qty,
      by: currentUser?.fullName || 'System'
    });

    saveAll();
    e.target.reset();
    msg.textContent = `✅ ${qty} ${product.unit} of ${product.name} → ${store.name}`;
    msg.className = 'msg show success';
    addLog('TRANSFER', `${qty} ${product.unit} of ${product.name} to ${store.name}`);
    toast(`🔄 Transferred to ${store.name}`);
    renderAll();
    setTimeout(() => { msg.className = 'msg'; }, 4000);
  });
}

function renderTransferHistory() {
  const tbody = $('#transferHistory');
  if (!tbody) return;
  tbody.innerHTML = transfers.length === 0
    ? `<tr><td colspan="5"><div class="empty-state"><span class="emoji">🔄</span>No transfers yet</div></td></tr>`
    : transfers.slice(0, 30).map(t => {
        const p = getProduct(t.productId);
        const s = getStore(t.storeId);
        return `
          <tr>
            <td>${t.date}</td>
            <td><strong>${p ? p.name : '—'}</strong></td>
            <td>${s ? s.name : '—'}</td>
            <td>${t.qty}</td>
            <td>${t.by || '—'}</td>
          </tr>`;
      }).join('');
}

/* ================= BRANCH STOCK ================= */
function setupBranchStock() {
  const sel = $('#branchSelect');
  if (sel) {
    sel.addEventListener('change', () => {
      currentBranchId = sel.value;
      renderBranchStock();
      updateBranchProductDropdown();
    });
  }

  const form = $('#stockUpdateForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const store = getStore(currentBranchId);
    if (!store) return toast('❌ Select a branch first', 'error');

    const pid = $('#updateProduct').value;
    const action = $('#updateAction').value;
    const qty = parseInt($('#updateQty').value);
    const note = $('#updateNote').value.trim();
    const msg = $('#updateMsg');

    if (!pid || qty <= 0) {
      msg.textContent = '⚠️ Fill all fields';
      msg.className = 'msg show error';
      return;
    }

    const product = getProduct(pid);
    if (!product) return;

    const current = store.items[pid] || 0;

    if (action === 'add') {
      store.items[pid] = current + qty;
    } else if (action === 'remove') {
      if (qty > current) {
        msg.textContent = `❌ Not enough. Available: ${current}`;
        msg.className = 'msg show error';
        return;
      }
      store.items[pid] = current - qty;
      if (store.items[pid] === 0) delete store.items[pid];
    } else if (action === 'set') {
      store.items[pid] = qty;
    }

    if (!accounts[store.id]) accounts[store.id] = {};
    if (!accounts[store.id][pid]) accounts[store.id][pid] = { qty: 0, price: product.price };
    accounts[store.id][pid].qty = store.items[pid] || 0;
    accounts[store.id][pid].price = product.price;

    saveAll();
    const actionLabel = action === 'add' ? 'Added' : action === 'remove' ? 'Removed' : 'Set';
    msg.textContent = `✅ ${actionLabel} ${qty} ${product.unit} of ${product.name} (${store.name})${note ? ' — ' + note : ''}`;
    msg.className = 'msg show success';
    addLog('BRANCH_UPDATE', `${actionLabel} ${qty} ${product.unit} of ${product.name} at ${store.name}${note ? ' | ' + note : ''}`);
    toast(`✅ Stock updated`);
    e.target.reset();
    renderAll();
    setTimeout(() => { msg.className = 'msg'; }, 4000);
  });
}

function renderBranchSelect() {
  const sel = $('#branchSelect');
  if (!sel) return;

  let availableStores = stores;
  if (currentUser?.role === 'staff' && currentUser.storeId) {
    availableStores = stores.filter(s => s.id === currentUser.storeId);
  }

  if (!availableStores.length) {
    sel.innerHTML = `<option value="">No stores available</option>`;
    return;
  }

  sel.innerHTML = availableStores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  if (!currentBranchId || !availableStores.find(s => s.id === currentBranchId)) {
    currentBranchId = availableStores[0].id;
  }
  sel.value = currentBranchId;
}

function renderBranchStock() {
  const tbody = $('#branchStockTable');
  if (!tbody) return;

  const store = getStore(currentBranchId);
  if (!store) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="emoji">🏪</span>No branch selected</div></td></tr>`;
    return;
  }

  const items = Object.entries(store.items).filter(([, q]) => q > 0);
  let total = 0;
  items.forEach(([pid, qty]) => {
    const p = getProduct(pid);
    if (p) total += qty * p.price;
  });
  const branchTotal = $('#branchTotal');
  if (branchTotal) branchTotal.textContent = fmtRs(total);

  tbody.innerHTML = items.length === 0
    ? `<tr><td colspan="5"><div class="empty-state"><span class="emoji">📦</span>No stock in ${store.name}</div></td></tr>`
    : items.map(([pid, qty]) => {
        const p = getProduct(pid);
        if (!p) return '';
        return `
          <tr>
            <td><strong>${p.name}</strong></td>
            <td>${qty} ${p.unit}</td>
            <td>${fmtRs(p.price)}</td>
            <td>${fmtRs(qty * p.price)}</td>
            <td><button class="btn danger small" onclick="removeFromBranch('${currentBranchId}','${pid}',1)">−1</button></td>
          </tr>`;
      }).join('');

  updateBranchProductDropdown();
}

window.removeFromBranch = function(sid, pid, qty) {
  const store = getStore(sid);
  if (!store) return;
  const cur = store.items[pid] || 0;
  if (cur < qty) return toast('❌ Not enough', 'error');
  store.items[pid] = cur - qty;
  if (store.items[pid] === 0) delete store.items[pid];
  saveAll();
  addLog('BRANCH_REMOVE', `Removed ${qty} from ${store.name}`);
  renderAll();
  toast('➖ Removed');
};

function updateBranchProductDropdown() {
  const sel = $('#updateProduct');
  if (!sel) return;
  const store = getStore(currentBranchId);
  if (!store) return;

  const productIds = Object.keys(store.items).filter(pid => (store.items[pid] || 0) > 0);
  if (!productIds.length) {
    sel.innerHTML = `<option value="">No products in this branch</option>`;
    return;
  }
  sel.innerHTML = productIds.map(pid => {
    const p = getProduct(pid);
    return p ? `<option value="${pid}">${p.name} (current: ${store.items[pid]} ${p.unit})</option>` : '';
  }).join('');
}

/* ================= ACCOUNTS ================= */
function renderAccounts() {
  const tbody = $('#accountsTable');
  if (!tbody) return;
  const rows = [];

  Object.entries(accounts).forEach(([sid, items]) => {
    const store = getStore(sid);
    if (!store) return;
    Object.entries(items).forEach(([pid, data]) => {
      const p = getProduct(pid);
      if (!p || data.qty <= 0) return;
      rows.push({ storeName: store.name, productName: p.name, qty: data.qty, unit: p.unit, price: data.price, total: data.qty * data.price });
    });
  });

  tbody.innerHTML = rows.length === 0
    ? `<tr><td colspan="5"><div class="empty-state"><span class="emoji">💰</span>No account entries yet</div></td></tr>`
    : rows.map(r => `
      <tr>
        <td>${r.storeName}</td>
        <td><strong>${r.productName}</strong></td>
        <td>${r.qty} ${r.unit}</td>
        <td>${fmtRs(r.price)}</td>
        <td><strong>${fmtRs(r.total)}</strong></td>
      </tr>
    `).join('');
}

/* ================= USERS ================= */
function setupUsers() {
  const form = $('#userForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!canDo('users')) return toast('❌ Only admin', 'error');

    const username = $('#newUsername').value.trim();
    const password = $('#newPassword').value.trim();
    const fullName = $('#newFullName').value.trim();
    const role = $('#newRole').value;
    const storeId = $('#newStore').value;

    if (!username || !password || !fullName) return;

    if (users.find(u => u.username === username)) {
      toast('❌ Username already exists', 'error');
      return;
    }

    users.push({ id: uid(), username, password, fullName, role, storeId });
    saveAll();
    e.target.reset();
    addLog('ADD_USER', `Added user: ${username} (${role})`);
    renderAll();
    toast(`👤 User "${username}" added`);
  });
}

window.deleteUser = function(id) {
  if (!canDo('users')) return toast('❌ Only admin', 'error');
  if (id === currentUser?.id) return toast('❌ Cannot delete yourself', 'error');
  const u = users.find(x => x.id === id);
  if (!confirm(`Delete user "${u.username}"?`)) return;
  users = users.filter(x => x.id !== id);
  saveAll();
  addLog('DELETE_USER', `Deleted user: ${u.username}`);
  renderAll();
  toast('🗑️ User deleted', 'error');
};

function renderUsers() {
  const tbody = $('#usersTable');
  if (!tbody) return;

  tbody.innerHTML = users.length === 0
    ? `<tr><td colspan="5"><div class="empty-state"><span class="emoji">👥</span>No users</div></td></tr>`
    : users.map(u => {
        const store = u.storeId ? getStore(u.storeId) : null;
        return `
          <tr>
            <td><strong>${u.username}</strong></td>
            <td>${u.fullName}</td>
            <td>${u.role}</td>
            <td>${store ? store.name : '—'}</td>
            <td>${u.id === currentUser?.id ? '<span style="color:var(--text-dim);font-size:12px;">You</span>' : `<button class="btn danger" onclick="deleteUser('${u.id}')">Delete</button>`}</td>
          </tr>
        `;
      }).join('');

  const storeSel = $('#newStore');
  if (storeSel) {
    storeSel.innerHTML = '<option value="">— None —</option>' +
      stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }
}

/* ================= ACTIVITY ================= */
function renderActivity() {
  const tbody = $('#activityTable');
  if (!tbody) return;

  tbody.innerHTML = logs.length === 0
    ? `<tr><td colspan="4"><div class="empty-state"><span class="emoji">📜</span>No activity</div></td></tr>`
    : logs.slice(0, 100).map(l => `
      <tr>
        <td style="font-size:12px;">${l.time}</td>
        <td><strong>${l.userName}</strong></td>
        <td>${l.action}</td>
        <td style="font-size:13px;">${l.details}</td>
      </tr>
    `).join('');
}

function setupActivity() {
  const btn = $('#clearLogBtn');
  if (btn) btn.addEventListener('click', () => {
    if (!confirm('Clear all activity log?')) return;
    logs = [];
    saveAll();
    renderActivity();
    toast('🗑️ Log cleared', 'error');
  });
}

/* ================= DASHBOARD ================= */
function renderDashboard() {
  const sp = $('#statProducts'); if (sp) sp.textContent = products.length;
  const ss = $('#statStores'); if (ss) ss.textContent = stores.length;

  const mainItems = Object.values(mainStore).filter(q => q > 0).length;
  const smi = $('#statMainItems'); if (smi) smi.textContent = mainItems;

  let value = 0;
  Object.entries(mainStore).forEach(([pid, qty]) => {
    const p = getProduct(pid);
    if (p) value += qty * p.price;
  });
  const smv = $('#statMainValue'); if (smv) smv.textContent = fmtRs(value);

  const td = $('#todayDate'); if (td) td.textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });

  renderChart();
  renderLowStock();
  renderRecentActivity();
  renderTopProducts();
}

function renderChart() {
  const container = $('#chartBars');
  if (!container) return;
  const data = [];

  let mainTotal = 0;
  Object.entries(mainStore).forEach(([pid, qty]) => {
    const p = getProduct(pid);
    if (p) mainTotal += qty * p.price;
  });
  data.push({ name: '🏬 Main Store', value: mainTotal });

  stores.forEach(s => {
    let total = 0;
    Object.entries(s.items).forEach(([pid, qty]) => {
      const p = getProduct(pid);
      if (p) total += qty * p.price;
    });
    data.push({ name: '🏪 ' + s.name, value: total });
  });

  const max = Math.max(...data.map(d => d.value), 1);

  if (data.every(d => d.value === 0)) {
    container.innerHTML = `<div class="empty-state"><span class="emoji">📊</span>No stock data yet</div>`;
    return;
  }

  container.innerHTML = data.map(d => `
    <div class="chart-row">
      <div class="label"><span>${d.name}</span><strong>${fmtRs(d.value)}</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width: ${(d.value / max * 100).toFixed(1)}%"></div></div>
    </div>
  `).join('');
}

function renderLowStock() {
  const alerts = getLowStockAlerts();
  const el = $('#lowStockList');
  if (!el) return;
  if (!alerts.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">✨</span>All good! No low stock.</div>`;
    return;
  }
  el.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.level}">
      <span class="icon">${a.level === 'danger' ? '🚨' : '⚠️'}</span>
      <div class="info"><strong>${a.name}</strong><span>${a.msg}</span></div>
    </div>
  `).join('');
}

function renderRecentActivity() {
  const el = $('#recentActivity');
  if (!el) return;
  const recent = transfers.slice(0, 6);
  if (!recent.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">🕒</span>No activity yet</div>`;
