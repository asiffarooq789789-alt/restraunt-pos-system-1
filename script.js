/* ==================================================
   RESTAURANTOS — Complete Script
   ================================================== */

/* ================= STORAGE ================= */
const DB = {
  get: (k, f) => {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : f;
    } catch (e) { return f; }
  },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};

let products = DB.get('products', []);
let stores = DB.get('stores', []);
let mainStore = DB.get('mainStore', {});
let transfers = DB.get('transfers', []);
let accounts = DB.get('accounts', {});
let users = DB.get('users', []);
let logs = DB.get('logs', []);
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
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function getProduct(id) { return products.find(function(p) { return p.id === id; }); }
function getStore(id) { return stores.find(function(s) { return s.id === id; }); }
function fmtRs(n) {
  return 'Rs ' + Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toast(msg, type) {
  type = type || 'success';
  var t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.className = 'toast'; }, 3000);
}

function addLog(action, details) {
  logs.unshift({
    id: uid(),
    time: new Date().toLocaleString(),
    userId: currentUser ? currentUser.id : 'system',
    userName: currentUser ? currentUser.fullName : 'System',
    action: action,
    details: details
  });
  if (logs.length > 500) logs = logs.slice(0, 500);
  saveAll();
}

function canDo(action) {
  if (!currentUser) return false;
  var role = currentUser.role;
  if (role === 'admin') return true;
  if (action === 'products' || action === 'users') return false;
  if ((action === 'transfer' || action === 'purchase') && role === 'staff') return false;
  return true;
}

/* ================= SEED USERS ================= */
function seedUsers() {
  if (users.length === 0) {
    users = [
      { id: uid(), username: 'admin', password: 'admin123', fullName: 'Admin User', role: 'admin', storeId: '' },
      { id: uid(), username: 'manager', password: 'manager123', fullName: 'Main Manager', role: 'manager', storeId: '' },
      { id: uid(), username: 'kitchen', password: 'kitchen123', fullName: 'Kitchen Staff', role: 'staff', storeId: '' },
      { id: uid(), username: 'bar', password: 'bar123', fullName: 'Bar Staff', role: 'staff', storeId: '' }
    ];
    saveAll();
  }
}

/* ================= LOGIN ================= */
function setupLogin() {
  var form = $('#loginForm');
  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var u = $('#loginUser').value.trim();
    var p = $('#loginPass').value;
    var msg = $('#loginMsg');

    users = DB.get('users', []);
    var found = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].username === u && users[i].password === p) {
        found = users[i];
        break;
      }
    }

    if (!found) {
      msg.textContent = '❌ Invalid username or password';
      msg.className = 'login-msg error';
      return;
    }

    currentUser = found;
    sessionStorage.setItem('currentUserId', found.id);
    msg.textContent = '✅ Login successful...';
    msg.className = 'login-msg success';

    setTimeout(function() {
      $('#loginScreen').classList.add('hidden');
      $('#appRoot').style.display = 'block';
      applyPermissions();
      renderAll();
      addLog('LOGIN', found.fullName + ' logged in');
    }, 300);
  });

  var logoutBtn = $('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      if (!confirm('Logout?')) return;
      if (currentUser) addLog('LOGOUT', currentUser.fullName + ' logged out');
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
  var id = sessionStorage.getItem('currentUserId');
  if (!id) return false;
  var found = users.find(function(u) { return u.id === id; });
  if (!found) return false;
  currentUser = found;
  $('#loginScreen').classList.add('hidden');
  $('#appRoot').style.display = 'block';
  applyPermissions();
  return true;
}

function applyPermissions() {
  if (!currentUser) return;
  $('#userName').textContent = currentUser.fullName;
  $('#userRole').textContent = currentUser.role;
  $('#userAvatar').textContent = currentUser.fullName.charAt(0).toUpperCase();

  var storeName = currentUser.storeId ? (getStore(currentUser.storeId) ? getStore(currentUser.storeId).name : '') : '';
  $('#dashSubtitle').textContent = currentUser.role === 'admin'
    ? 'Overview of entire restaurant stock'
    : 'Welcome ' + currentUser.fullName + (storeName ? ' — ' + storeName : '');

  $$('.nav-btn').forEach(function(btn) {
    var roles = (btn.dataset.roles || '').split(',');
    if (roles.indexOf(currentUser.role) !== -1) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
  });
}

/* ================= THEME ================= */
function setupTheme() {
  var saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);

  var btn = $('#themeToggle');
  if (btn) {
    btn.addEventListener('click', function() {
      var cur = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      updateThemeIcon(next);
    });
  }
}

function updateThemeIcon(theme) {
  var btn = $('#themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

/* ================= SIDEBAR ================= */
function setupSidebar() {
  var openBtn = $('#menuToggle');
  var closeBtn = $('#closeSidebar');
  var overlay = $('#overlay');

  if (openBtn) openBtn.addEventListener('click', function() {
    $('#sidebar').classList.add('open');
    $('#overlay').classList.add('show');
  });
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);
}

function closeSidebar() {
  var sb = $('#sidebar'); var ov = $('#overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('show');
}

/* ================= NAVIGATION ================= */
function setupNav() {
  $$('.nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      $$('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      $$('.page').forEach(function(p) { p.classList.remove('active'); });
      var page = $('#' + btn.dataset.page);
      if (page) page.classList.add('active');
      closeSidebar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/* ================= NOTIFICATIONS ================= */
function setupNotifications() {
  var notifBtn = $('#notifBtn');
  var closeNotif = $('#closeNotif');
  if (notifBtn) notifBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    $('#notifPanel').classList.toggle('show');
  });
  if (closeNotif) closeNotif.addEventListener('click', function() {
    $('#notifPanel').classList.remove('show');
  });
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#notifPanel') && !e.target.closest('#notifBtn')) {
      var np = $('#notifPanel');
      if (np) np.classList.remove('show');
    }
  });
}

function getLowStockAlerts() {
  var alerts = [];
  Object.entries(mainStore).forEach(function(entry) {
    var pid = entry[0], qty = entry[1];
    var p = getProduct(pid);
    if (!p || qty <= 0) return;
    if (qty < 10) {
      alerts.push({
        name: p.name,
        msg: 'Main Store: only ' + qty + ' ' + p.unit + ' left',
        level: qty < 5 ? 'danger' : 'warn'
      });
    }
  });
  return alerts;
}

function renderNotifications() {
  var alerts = getLowStockAlerts();
  var badge = $('#notifBadge');
  if (badge) {
    badge.textContent = alerts.length;
    badge.style.display = alerts.length ? 'block' : 'none';
  }
  var list = $('#notifList');
  if (!list) return;
  if (alerts.length === 0) {
    list.innerHTML = '<div class="empty-state"><span class="emoji">✨</span>All good! No alerts.</div>';
    return;
  }
  var html = '';
  alerts.forEach(function(a) {
    html += '<div class="alert-item ' + a.level + '">' +
      '<span class="icon">' + (a.level === 'danger' ? '🚨' : '⚠️') + '</span>' +
      '<div class="info"><strong>' + a.name + '</strong><span>' + a.msg + '</span></div></div>';
  });
  list.innerHTML = html;
}

/* ================= PRODUCTS ================= */
function setupProducts() {
  var form = $('#productForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (!canDo('products')) { toast('❌ Only admin', 'error'); return; }
    var name = $('#productName').value.trim();
    var price = parseFloat($('#productPrice').value);
    var unit = $('#productUnit').value.trim();
    if (!name || isNaN(price) || !unit) return;

    products.push({ id: uid(), name: name, price: price, unit: unit });
    saveAll();
    e.target.reset();
    addLog('ADD_PRODUCT', 'Added product: ' + name);
    renderAll();
    toast('✅ "' + name + '" added');
  });
}

window.deleteProduct = function(id) {
  if (!canDo('products')) { toast('❌ No permission', 'error'); return; }
  var p = getProduct(id);
  if (!p) return;
  if (!confirm('Delete "' + p.name + '"?')) return;
  products = products.filter(function(x) { return x.id !== id; });
  delete mainStore[id];
  stores.forEach(function(s) { delete s.items[id]; });
  Object.keys(accounts).forEach(function(sid) { delete accounts[sid][id]; });
  saveAll();
  addLog('DELETE_PRODUCT', 'Deleted product: ' + p.name);
  renderAll();
  toast('🗑️ Product deleted', 'error');
};

function renderProducts() {
  var tbody = $('#productsTable');
  if (!tbody) return;
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><span class="emoji">📦</span>No products yet</div></td></tr>';
    return;
  }
  var html = '';
  products.forEach(function(p) {
    html += '<tr><td><strong>' + p.name + '</strong></td><td>' + fmtRs(p.price) + '</td><td>' + p.unit + '</td>' +
      '<td><button class="btn danger" onclick="deleteProduct(\'' + p.id + '\')">Delete</button></td></tr>';
  });
  tbody.innerHTML = html;
}

/* ================= PURCHASE ================= */
function setupPurchase() {
  var form = $('#purchaseForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (!canDo('purchase')) { toast('❌ No permission', 'error'); return; }
    var pid = $('#purchaseProduct').value;
    var qty = parseInt($('#purchaseQty').value);
    var priceInput = $('#purchasePrice').value;
    if (!pid || qty <= 0) return;

    var product = getProduct(pid);
    if (!product) return;

    if (priceInput && !isNaN(parseFloat(priceInput))) product.price = parseFloat(priceInput);

    mainStore[pid] = (mainStore[pid] || 0) + qty;
    saveAll();
    e.target.reset();
    addLog('PURCHASE', qty + ' ' + product.unit + ' of ' + product.name + ' added');
    renderAll();
    toast('📦 ' + qty + ' ' + product.unit + ' added');
  });
}

function renderMainStore() {
  var tbody = $('#mainStoreTable');
  if (!tbody) return;
  var entries = Object.entries(mainStore).filter(function(e) { return e[1] > 0; });
  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><span class="emoji">🏬</span>Main store is empty</div></td></tr>';
    return;
  }
  var html = '';
  entries.forEach(function(entry) {
    var pid = entry[0], qty = entry[1];
    var p = getProduct(pid);
    if (!p) return;
    html += '<tr><td><strong>' + p.name + '</strong></td><td>' + qty + ' ' + p.unit + '</td>' +
      '<td>' + fmtRs(p.price) + '</td><td><strong>' + fmtRs(qty * p.price) + '</strong></td></tr>';
  });
  tbody.innerHTML = html;
}

/* ================= STORES ================= */
function setupStores() {
  var form = $('#storeForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var name = $('#storeName').value.trim();
    if (!name) return;
    stores.push({ id: uid(), name: name, items: {} });
    saveAll();
    e.target.reset();
    addLog('ADD_STORE', 'Added store: ' + name);
    renderAll();
    toast('🏪 "' + name + '" added');
  });
}

window.deleteStore = function(id) {
  if (!confirm('Delete this store? All stock will be lost.')) return;
  var s = getStore(id);
  stores = stores.filter(function(x) { return x.id !== id; });
  delete accounts[id];
  saveAll();
  addLog('DELETE_STORE', 'Deleted store: ' + (s ? s.name : ''));
  renderAll();
  toast('🗑️ Store deleted', 'error');
};

function renderStores() {
  var container = $('#storesList');
  if (!container) return;
  if (stores.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="emoji">🏪</span>No sub stores yet</div>';
    return;
  }
  var html = '';
  stores.forEach(function(s) {
    var items = Object.entries(s.items).filter(function(e) { return e[1] > 0; });
    var total = 0;
    items.forEach(function(e) {
      var p = getProduct(e[0]);
      if (p) total += e[1] * p.price;
    });

    var itemsHtml = '';
    if (items.length === 0) {
      itemsHtml = '<div class="item"><span>No stock</span></div>';
    } else {
      items.slice(0, 4).forEach(function(e) {
        var p = getProduct(e[0]);
        if (!p) return;
        itemsHtml += '<div class="item"><span>' + p.name + '</span><strong>' + e[1] + ' ' + p.unit + '</strong></div>';
      });
      if (items.length > 4) {
        itemsHtml += '<div class="item"><span>+ ' + (items.length - 4) + ' more...</span></div>';
      }
    }

    html += '<div class="store-card"><h3>🏪 ' + s.name + '</h3>' +
      '<div class="store-items">' + itemsHtml + '</div>' +
      '<div class="store-actions"><span class="store-total">' + fmtRs(total) + '</span>' +
      '<button class="btn danger" onclick="deleteStore(\'' + s.id + '\')">Delete</button></div></div>';
  });
  container.innerHTML = html;
}

/* ================= TRANSFER ================= */
function setupTransfer() {
  var form = $('#transferForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (!canDo('transfer')) { toast('❌ No permission', 'error'); return; }

    var pid = $('#transferProduct').value;
    var sid = $('#transferStore').value;
    var qty = parseInt($('#transferQty').value);
    var msg = $('#transferMsg');

    if (!pid || !sid || qty <= 0) {
      msg.textContent = '⚠️ Fill all fields';
      msg.className = 'msg show error';
      return;
    }

    var available = mainStore[pid] || 0;
    if (qty > available) {
      msg.textContent = '❌ Not enough stock. Available: ' + available;
      msg.className = 'msg show error';
      return;
    }

    var product = getProduct(pid);
    var store = getStore(sid);
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
      qty: qty,
      by: currentUser ? currentUser.fullName : 'System'
    });

    saveAll();
    e.target.reset();
    msg.textContent = '✅ ' + qty + ' ' + product.unit + ' of ' + product.name + ' → ' + store.name;
    msg.className = 'msg show success';
    addLog('TRANSFER', qty + ' ' + product.unit + ' of ' + product.name + ' to ' + store.name);
    toast('🔄 Transferred');
    renderAll();
    setTimeout(function() { msg.className = 'msg'; }, 4000);
  });
}

function renderTransferHistory() {
  var tbody = $('#transferHistory');
  if (!tbody) return;
  if (transfers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><span class="emoji">🔄</span>No transfers yet</div></td></tr>';
    return;
  }
  var html = '';
  transfers.slice(0, 30).forEach(function(t) {
    var p = getProduct(t.productId);
    var s = getStore(t.storeId);
    html += '<tr><td>' + t.date + '</td><td><strong>' + (p ? p.name : '—') + '</strong></td>' +
      '<td>' + (s ? s.name : '—') + '</td><td>' + t.qty + '</td><td>' + (t.by || '—') + '</td></tr>';
  });
  tbody.innerHTML = html;
}

/* ================= BRANCH STOCK ================= */
function setupBranchStock() {
  var sel = $('#branchSelect');
  if (sel) {
    sel.addEventListener('change', function() {
      currentBranchId = sel.value;
      renderBranchStock();
      updateBranchProductDropdown();
    });
  }

  var form = $('#stockUpdateForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var store = getStore(currentBranchId);
    if (!store) { toast('❌ Select branch first', 'error'); return; }

    var pid = $('#updateProduct').value;
    var action = $('#updateAction').value;
    var qty = parseInt($('#updateQty').value);
    var note = $('#updateNote').value.trim();
    var msg = $('#updateMsg');

    if (!pid || qty <= 0) {
      msg.textContent = '⚠️ Fill all fields';
      msg.className = 'msg show error';
      return;
    }

    var product = getProduct(pid);
    if (!product) return;

    var current = store.items[pid] || 0;
    var actionLabel = '';

    if (action === 'add') {
      store.items[pid] = current + qty;
      actionLabel = 'Added';
    } else if (action === 'remove') {
      if (qty > current) {
        msg.textContent = '❌ Not enough. Available: ' + current;
        msg.className = 'msg show error';
        return;
      }
      store.items[pid] = current - qty;
      if (store.items[pid] === 0) delete store.items[pid];
      actionLabel = 'Removed';
    } else if (action === 'set') {
      store.items[pid] = qty;
      actionLabel = 'Set';
    }

    if (!accounts[store.id]) accounts[store.id] = {};
    if (!accounts[store.id][pid]) accounts[store.id][pid] = { qty: 0, price: product.price };
    accounts[store.id][pid].qty = store.items[pid] || 0;
    accounts[store.id][pid].price = product.price;

    saveAll();
    msg.textContent = '✅ ' + actionLabel + ' ' + qty + ' ' + product.unit + ' of ' + product.name + (note ? ' — ' + note : '');
    msg.className = 'msg show success';
    addLog('BRANCH_UPDATE', actionLabel + ' ' + qty + ' ' + product.unit + ' of ' + product.name + ' at ' + store.name);
    toast('✅ Stock updated');
    e.target.reset();
    renderAll();
    setTimeout(function() { msg.className = 'msg'; }, 4000);
  });
}

function renderBranchSelect() {
  var sel = $('#branchSelect');
  if (!sel) return;

  var availableStores = stores;
  if (currentUser && currentUser.role === 'staff' && currentUser.storeId) {
    availableStores = stores.filter(function(s) { return s.id === currentUser.storeId; });
  }

  if (availableStores.length === 0) {
    sel.innerHTML = '<option value="">No stores available</option>';
    return;
  }

  var html = '';
  availableStores.forEach(function(s) {
    html += '<option value="' + s.id + '">' + s.name + '</option>';
  });
  sel.innerHTML = html;

  var found = availableStores.find(function(s) { return s.id === currentBranchId; });
  if (!found) currentBranchId = availableStores[0].id;
  sel.value = currentBranchId;
}

function renderBranchStock() {
  var tbody = $('#branchStockTable');
  if (!tbody) return;

  var store = getStore(currentBranchId);
  if (!store) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><span class="emoji">🏪</span>No branch selected</div></td></tr>';
    return;
  }

  var items = Object.entries(store.items).filter(function(e) { return e[1] > 0; });
  var total = 0;
  items.forEach(function(e) {
    var p = getProduct(e[0]);
    if (p) total += e[1] * p.price;
  });
  var bt = $('#branchTotal');
  if (bt) bt.textContent = fmtRs(total);

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><span class="emoji">📦</span>No stock in ' + store.name + '</div></td></tr>';
    updateBranchProductDropdown();
    return;
  }

  var html = '';
  items.forEach(function(entry) {
    var pid = entry[0], qty = entry[1];
    var p = getProduct(pid);
    if (!p) return;
    html += '<tr><td><strong>' + p.name + '</strong></td><td>' + qty + ' ' + p.unit + '</td>' +
      '<td>' + fmtRs(p.price) + '</td><td>' + fmtRs(qty * p.price) + '</td>' +
      '<td><button class="btn danger small" onclick="removeFromBranch(\'' + currentBranchId + '\',\'' + pid + '\',1)">−1</button></td></tr>';
  });
  tbody.innerHTML = html;

  updateBranchProductDropdown();
}

window.removeFromBranch = function(sid, pid, qty) {
  var store = getStore(sid);
  if (!store) return;
  var cur = store.items[pid] || 0;
  if (cur < qty) { toast('❌ Not enough', 'error'); return; }
  store.items[pid] = cur - qty;
  if (store.items[pid] === 0) delete store.items[pid];
  saveAll();
  addLog('BRANCH_REMOVE', 'Removed ' + qty + ' from ' + store.name);
  renderAll();
  toast('➖ Removed');
};

function updateBranchProductDropdown() {
  var sel = $('#updateProduct');
  if (!sel) return;
  var store = getStore(currentBranchId);
  if (!store) return;

  var productIds = Object.keys(store.items).filter(function(pid) { return (store.items[pid] || 0) > 0; });
  if (productIds.length === 0) {
    sel.innerHTML = '<option value="">No products in this branch</option>';
    return;
  }
  var html = '';
  productIds.forEach(function(pid) {
    var p = getProduct(pid);
    if (p) html += '<option value="' + pid + '">' + p.name + ' (current: ' + store.items[pid] + ' ' + p.unit + ')</option>';
  });
  sel.innerHTML = html;
}

/* ================= ACCOUNTS ================= */
function renderAccounts() {
  var tbody = $('#accountsTable');
  if (!tbody) return;
  var rows = [];

  Object.entries(accounts).forEach(function(entry) {
    var sid = entry[0], items = entry[1];
    var store = getStore(sid);
    if (!store) return;
    Object.entries(items).forEach(function(e) {
      var pid = e[0], data = e[1];
      var p = getProduct(pid);
      if (!p || data.qty <= 0) return;
      rows.push({
        storeName: store.name,
        productName: p.name,
        qty: data.qty,
        unit: p.unit,
        price: data.price,
        total: data.qty * data.price
      });
    });
  });

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><span class="emoji">💰</span>No account entries yet</div></td></tr>';
    return;
  }
  var html = '';
  rows.forEach(function(r) {
    html += '<tr><td>' + r.storeName + '</td><td><strong>' + r.productName + '</strong></td>' +
      '<td>' + r.qty + ' ' + r.unit + '</td><td>' + fmtRs(r.price) + '</td>' +
      '<td><strong>' + fmtRs(r.total) + '</strong></td></tr>';
  });
  tbody.innerHTML = html;
}

/* ================= USERS ================= */
function setupUsers() {
  var form = $('#userForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (!canDo('users')) { toast('❌ Only admin', 'error'); return; }

    var username = $('#newUsername').value.trim();
    var password = $('#newPassword').value.trim();
    var fullName = $('#newFullName').value.trim();
    var role = $('#newRole').value;
    var storeId = $('#newStore').value;

    if (!username || !password || !fullName) return;

    var exists = users.find(function(u) { return u.username === username; });
    if (exists) { toast('❌ Username exists', 'error'); return; }

    users.push({ id: uid(), username: username, password: password, fullName: fullName, role: role, storeId: storeId });
    saveAll();
    e.target.reset();
    addLog('ADD_USER', 'Added user: ' + username);
    renderAll();
    toast('👤 User added');
  });
}

window.deleteUser = function(id) {
  if (!canDo('users')) { toast('❌ Only admin', 'error'); return; }
  if (currentUser && id === currentUser.id) { toast('❌ Cannot delete yourself', 'error'); return; }
  var u = users.find(function(x) { return x.id === id; });
  if (!u) return;
  if (!confirm('Delete user "' + u.username + '"?')) return;
  users = users.filter(function(x) { return x.id !== id; });
  saveAll();
  addLog('DELETE_USER', 'Deleted user: ' + u.username);
  renderAll();
  toast('🗑️ User deleted', 'error');
};

function renderUsers() {
  var tbody = $('#usersTable');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><span class="emoji">👥</span>No users</div></td></tr>';
  } else {
    var html = '';
    users.forEach(function(u) {
      var store = u.storeId ? getStore(u.storeId) : null;
      var action = (currentUser && u.id === currentUser.id)
        ? '<span style="color:var(--text-dim);font-size:12px;">You</span>'
        : '<button class="btn danger" onclick="deleteUser(\'' + u.id + '\')">Delete</button>';
      html += '<tr><td><strong>' + u.username + '</strong></td><td>' + u.fullName + '</td>' +
        '<td>' + u.role + '</td><td>' + (store ? store.name : '—') + '</td><td>' + action + '</td></tr>';
    });
    tbody.innerHTML = html;
  }

  var storeSel = $('#newStore');
  if (storeSel) {
    var opts = '<option value="">— None —</option>';
    stores.forEach(function(s) {
      opts += '<option value="' + s.id + '">' + s.name + '</option>';
    });
    storeSel.innerHTML = opts;
  }
}

/* ================= ACTIVITY ================= */
function renderActivity() {
  var tbody = $('#activityTable');
  if (!tbody) return;
  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><span class="emoji">📜</span>No activity</div></td></tr>';
    return;
  }
  var html = '';
  logs.slice(0, 100).forEach(function(l) {
    html += '<tr><td style="font-size:12px;">' + l.time + '</td><td><strong>' + l.userName + '</strong></td>' +
      '<td>' + l.action + '</td><td style="font-size:13px;">' + l.details + '</td></tr>';
  });
  tbody.innerHTML = html;
}

function setupActivity() {
  var btn = $('#clearLogBtn');
  if (btn) btn.addEventListener('click', function() {
    if (!confirm('Clear all activity log?')) return;
    logs = [];
    saveAll();
    renderActivity();
    toast('🗑️ Log cleared', 'error');
  });
}

/* ================= DASHBOARD ================= */
function renderDashboard() {
  var sp = $('#statProducts'); if (sp) sp.textContent = products.length;
  var ss = $('#statStores'); if (ss) ss.textContent = stores.length;

  var mainItems = Object.values(mainStore).filter(function(q) { return q > 0; }).length;
  var smi = $('#statMainItems'); if (smi) smi.textContent = mainItems;

  var value = 0;
  Object.entries(mainStore).forEach(function(e) {
    var p = getProduct(e[0]);
    if (p) value += e[1] * p.price;
  });
  var smv = $('#statMainValue'); if (smv) smv.textContent = fmtRs(value);

  var td = $('#todayDate');
  if (td) td.textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });

  renderChart();
  renderLowStock();
  renderRecentActivity();
  renderTopProducts();
}

function renderChart() {
  var container = $('#chartBars');
  if (!container) return;
  var data = [];

  var mainTotal = 0;
  Object.entries(mainStore).forEach(function(e) {
    var p = getProduct(e[0]);
    if (p) mainTotal += e[1] * p.price;
  });
  data.push({ name: '🏬 Main Store', value: mainTotal });

  stores.forEach(function(s) {
    var total = 0;
    Object.entries(s.items).forEach(function(e) {
      var p = getProduct(e[0]);
      if (p) total += e[1] * p.price;
    });
    data.push({ name: '🏪 ' + s.name, value: total });
  });

  var max = 1;
  data.forEach(function(d) { if (
