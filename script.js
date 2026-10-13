/* ========== STORAGE ========== */
const DB = {
  get: (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};

let products  = DB.get('products', []);
let stores    = DB.get('stores', []);
let mainStore = DB.get('mainStore', {});
let transfers = DB.get('transfers', []);
let accounts  = DB.get('accounts', {});

function saveAll() {
  DB.set('products', products);
  DB.set('stores', stores);
  DB.set('mainStore', mainStore);
  DB.set('transfers', transfers);
  DB.set('accounts', accounts);
}

/* ========== HELPERS ========== */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const getProduct = id => products.find(p => p.id === id);
const getStore = id => stores.find(s => s.id === id);
const fmtRs = n => 'Rs ' + Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function toast(msg, type = 'success') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = 'toast', 3000);
}

/* ========== THEME ========== */
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

$('#themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
});

function updateThemeIcon(theme) {
  $('#themeToggle').textContent = theme === 'dark' ? '🌙' : '☀️';
}

/* ========== SIDEBAR ========== */
$('#menuToggle').addEventListener('click', openSidebar);
$('#closeSidebar').addEventListener('click', closeSidebar);
$('#overlay').addEventListener('click', closeSidebar);

function openSidebar() {
  $('#sidebar').classList.add('open');
  $('#overlay').classList.add('show');
}

function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#overlay').classList.remove('show');
}

/* ========== NAVIGATION ========== */
$$('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.page').forEach(p => p.classList.remove('active'));
    $('#' + btn.dataset.page).classList.add('active');
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

/* ========== NOTIFICATIONS ========== */
$('#notifBtn').addEventListener('click', e => {
  e.stopPropagation();
  $('#notifPanel').classList.toggle('show');
});

$('#closeNotif').addEventListener('click', () => $('#notifPanel').classList.remove('show'));

document.addEventListener('click', e => {
  if (!e.target.closest('#notifPanel') && !e.target.closest('#notifBtn')) {
    $('#notifPanel').classList.remove('show');
  }
});

function renderNotifications() {
  const alerts = getLowStockAlerts();
  $('#notifBadge').textContent = alerts.length;
  $('#notifBadge').style.display = alerts.length ? 'block' : 'none';

  const list = $('#notifList');
  if (!alerts.length) {
    list.innerHTML = `<div class="empty-state"><span class="emoji">✨</span>All good! No alerts.</div>`;
    return;
  }
  list.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.level}">
      <span class="icon">${a.level === 'danger' ? '🚨' : '⚠️'}</span>
      <div class="info">
        <strong>${a.name}</strong>
        <span>${a.msg}</span>
      </div>
    </div>
  `).join('');
}

function getLowStockAlerts() {
  const alerts = [];
  // Main store low stock (< 10)
  Object.entries(mainStore).forEach(([pid, qty]) => {
    const p = getProduct(pid);
    if (!p || qty <= 0) return;
    if (qty < 10) {
      alerts.push({
        name: p.name,
        msg: `Main Store: only ${qty} ${p.unit} left`,
        level: qty < 5 ? 'danger' : 'warn'
      });
    }
  });
  return alerts;
}

/* ========== PRODUCTS ========== */
$('#productForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#productName').value.trim();
  const price = parseFloat($('#productPrice').value);
  const unit = $('#productUnit').value.trim();
  if (!name || isNaN(price) || !unit) return;

  products.push({ id: uid(), name, price, unit });
  saveAll();
  e.target.reset();
  renderAll();
  toast(`✅ "${name}" added`);
});

window.deleteProduct = id => {
  const p = getProduct(id);
  if (!confirm(`Delete "${p.name}"? It will also be removed from all stores.`)) return;
  products = products.filter(x => x.id !== id);
  delete mainStore[id];
  stores.forEach(s => delete s.items[id]);
  Object.keys(accounts).forEach(sid => delete accounts[sid][id]);
  saveAll();
  renderAll();
  toast('🗑️ Product deleted', 'error');
};

function renderProducts() {
  const tbody = $('#productsTable');
  tbody.innerHTML = products.length === 0
    ? `<tr><td colspan="4"><div class="empty-state"><span class="emoji">📦</span>No products yet. Add one above!</div></td></tr>`
    : products.map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${fmtRs(p.price)}</td>
        <td>${p.unit}</td>
        <td><button class="btn danger" onclick="deleteProduct('${p.id}')">Delete</button></td>
      </tr>
    `).join('');
}

/* ========== PURCHASE ========== */
$('#purchaseForm').addEventListener('submit', e => {
  e.preventDefault();
  const pid = $('#purchaseProduct').value;
  const qty = parseInt($('#purchaseQty').value);
  const priceInput = $('#purchasePrice').value;
  if (!pid || qty <= 0) return;

  const product = getProduct(pid);
  if (!product) return;

  if (priceInput && !isNaN(parseFloat(priceInput))) {
    product.price = parseFloat(priceInput);
  }

  mainStore[pid] = (mainStore[pid] || 0) + qty;
  saveAll();
  e.target.reset();
  renderAll();
  toast(`📦 ${qty} ${product.unit} of ${product.name} added to Main Store`);
});

function renderMainStore() {
  const tbody = $('#mainStoreTable');
  const entries = Object.entries(mainStore).filter(([, q]) => q > 0);

  tbody.innerHTML = entries.length === 0
    ? `<tr><td colspan="4"><div class="empty-state"><span class="emoji">🏬</span>Main store is empty</div></td></tr>`
    : entries.map(([pid, qty]) => {
        const p = getProduct(pid);
        if (!p) return '';
        return `
          <tr data-search="${p.name.toLowerCase()}">
            <td><strong>${p.name}</strong></td>
            <td>${qty} ${p.unit}</td>
            <td>${fmtRs(p.price)}</td>
            <td><strong>${fmtRs(qty * p.price)}</strong></td>
          </tr>`;
      }).join('');
}

/* ========== STORES ========== */
$('#storeForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#storeName').value.trim();
  if (!name) return;

  stores.push({ id: uid(), name, items: {} });
  saveAll();
  e.target.reset();
  renderAll();
  toast(`🏪 "${name}" store added`);
});

window.deleteStore = id => {
  const s = getStore(id);
  if (!confirm(`Delete "${s.name}"? All its stock will be lost.`)) return;
  stores = stores.filter(x => x.id !== id);
  delete accounts[id];
  saveAll();
  renderAll();
  toast('🗑️ Store deleted', 'error');
};

function renderStores() {
  const container = $('#storesList');
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

/* ========== TRANSFER ========== */
$('#transferForm').addEventListener('submit', e => {
  e.preventDefault();
  const pid = $('#transferProduct').value;
  const sid = $('#transferStore').value;
  const qty = parseInt($('#transferQty').value);
  const msg = $('#transferMsg');

  if (!pid || !sid || qty <= 0) {
    msg.textContent = '⚠️ Please fill all fields';
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
    qty
  });

  saveAll();
  e.target.reset();
  msg.textContent = `✅ ${qty} ${product.unit} of ${product.name} → ${store.name}`;
  msg.className = 'msg show success';
  toast(`🔄 Transferred to ${store.name}`);
  renderAll();
  setTimeout(() => { msg.className = 'msg'; }, 4000);
});

function renderTransferHistory() {
  const tbody = $('#transferHistory');
  tbody.innerHTML = transfers.length === 0
    ? `<tr><td colspan="4"><div class="empty-state"><span class="emoji">🔄</span>No transfers yet</div></td></tr>`
    : transfers.slice(0, 30).map(t => {
        const p = getProduct(t.productId);
        const s = getStore(t.storeId);
        return `
          <tr>
            <td>${t.date}</td>
            <td><strong>${p ? p.name : '—'}</strong></td>
            <td>${s ? s.name : '—'}</td>
            <td>${t.qty}</td>
          </tr>`;
      }).join('');
}

/* ========== ACCOUNTS ========== */
function renderAccounts() {
  const tbody = $('#accountsTable');
  const rows = [];

  Object.entries(accounts).forEach(([sid, items]) => {
    const store = getStore(sid);
    if (!store) return;
    Object.entries(items).forEach(([pid, data]) => {
      const p = getProduct(pid);
      if (!p) return;
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

  tbody.innerHTML = rows.length === 0
    ? `<tr><td colspan="5"><div class="empty-state"><span class="emoji">💰</span>No account entries yet</div></td></tr>`
    : rows.map(r => `
      <tr data-search="${r.storeName.toLowerCase()} ${r.productName.toLowerCase()}">
        <td>${r.storeName}</td>
        <td><strong>${r.productName}</strong></td>
        <td>${r.qty} ${r.unit}</td>
        <td>${fmtRs(r.price)}</td>
        <td><strong>${fmtRs(r.total)}</strong></td>
      </tr>
    `).join('');
}

/* ========== DASHBOARD ========== */
function renderDashboard() {
  $('#statProducts').textContent = products.length;
  $('#statStores').textContent = stores.length;

  const mainItems = Object.values(mainStore).filter(q => q > 0).length;
  $('#statMainItems').textContent = mainItems;

  let value = 0;
  Object.entries(mainStore).forEach(([pid, qty]) => {
    const p = getProduct(pid);
    if (p) value += qty * p.price;
  });
  $('#statMainValue').textContent = fmtRs(value);

  // Date
  $('#todayDate').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });

  renderChart();
  renderLowStock();
  renderRecentActivity();
  renderTopProducts();
}

function renderChart() {
  const container = $('#chartBars');
  const data = [];

  // Main store total
  let mainTotal = 0;
  Object.entries(mainStore).forEach(([pid, qty]) => {
    const p = getProduct(pid);
    if (p) mainTotal += qty * p.price;
  });
  data.push({ name: '🏬 Main Store', value: mainTotal });

  // Each store
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
      <div class="bar-track">
        <div class="bar-fill" style="width: ${(d.value / max * 100).toFixed(1)}%"></div>
      </div>
    </div>
  `).join('');
}

function renderLowStock() {
  const alerts = getLowStockAlerts();
  const el = $('#lowStockList');

  if (!alerts.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">✨</span>All good! No low stock.</div>`;
    return;
  }

  el.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.level}">
      <span class="icon">${a.level === 'danger' ? '🚨' : '⚠️'}</span>
      <div class="info">
        <strong>${a.name}</strong>
        <span>${a.msg}</span>
      </div>
    </div>
  `).join('');
}

function renderRecentActivity() {
  const el = $('#recentActivity');
  if (!transfers.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">🕒</span>No activity yet</div>`;
    return;
  }

  el.innerHTML = transfers.slice(0, 6).map(t => {
    const p = getProduct(t.productId);
    const s = getStore(t.storeId);
    if (!p || !s) return '';
    return `
      <div class="activity-item">
        <span class="icon">🔄</span>
        <div class="info">
          <strong>${p.name} → ${s.name}</strong>
          <span>${t.qty} ${p.unit} • ${t.date}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderTopProducts() {
  const el = $('#topProducts');
  const all = {};

  Object.entries(mainStore).forEach(([pid, qty]) => {
    const p = getProduct(pid);
    if (p) all[pid] = (all[pid] || 0) + qty * p.price;
  });

  stores.forEach(s => {
    Object.entries(s.items).forEach(([pid, qty]) => {
      const p = getProduct(pid);
      if (p) all[pid] = (all[pid] || 0) + qty * p.price;
    });
  });

  const top = Object.entries(all)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!top.length) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">🏆</span>No products yet</div>`;
    return;
  }

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  el.innerHTML = top.map(([pid, val], i) => {
    const p = getProduct(pid);
    return `
      <div class="activity-item">
        <span class="icon">${medals[i]}</span>
        <div class="info">
          <strong>${p.name}</strong>
          <span>Total value: ${fmtRs(val)}</span>
        </div>
      </div>
    `;
  }).join('');
}

/* ========== DROPDOWNS ========== */
function renderDropdowns() {
  const pOpts = products.length
    ? products.map(p => `<option value="${p.id}">${p.name} (${p.unit})</option>`).join('')
    : `<option value="">Add products first</option>`;

  const sOpts = stores.length
    ? stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
    : `<option value="">Add stores first</option>`;

  $('#purchaseProduct').innerHTML = pOpts;
  $('#transferProduct').innerHTML = pOpts;
  $('#transferStore').innerHTML = sOpts;
}

/* ========== SEARCH ========== */
$('#globalSearch').addEventListener('input', e => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) return;

  // Products match
  const prodMatch = products.find(p => p.name.toLowerCase().includes(q));
  if (prodMatch) {
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-page="products"]').classList.add('active');
    $$('.page').forEach(p => p.classList.remove('active'));
    $('#products').classList.add('active');
  }
});

$$('.mini-search').forEach(input => {
  input.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const tableId = e.target.dataset.search;
    const rows = document.querySelectorAll(`#${tableId} tr`);
    rows.forEach(row => {
      const text = (row.dataset.search || row.textContent).toLowerCase();
      row.style.display = text.includes(q) ? '' : 'none';
    });
  });
});

/* ========== EXPORT ========== */
$('#exportBtn').addEventListener('click', () => {
  const rows = [['Store', 'Product', 'Qty', 'Unit', 'Price', 'Total']];

  Object.entries(mainStore).forEach(([pid, qty]) => {
    const p = getProduct(pid);
    if (p && qty > 0) rows.push(['Main Store', p.name, qty, p.unit, p.price, qty * p.price]);
  });

  Object.entries(accounts).forEach(([sid, items]) => {
    const s = getStore(sid);
    if (!s) return;
    Object.entries(items).forEach(([pid, d]) => {
      const p = getProduct(pid);
      if (p) rows.push([s.name, p.name, d.qty, p.unit, d.price, d.qty * d.price]);
    });
  });

  if (rows.length === 1) {
    toast('⚠️ Nothing to export', 'error');
    return;
  }

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `restaurant-stock-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('📥 Report exported as CSV');
});

/* ========== MASTER RENDER ========== */
function renderAll() {
  renderDashboard();
  renderProducts();
  renderMainStore();
  renderStores();
  renderTransferHistory();
  renderAccounts();
  renderDropdowns();
  renderNotifications();
}

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', () => {
  if (products.length === 0 && !localStorage.getItem('seeded')) {
    products.push(
      { id: uid(), name: 'Chicken', price: 350, unit: 'kg' },
      { id: uid(), name: 'Rice',    price: 200, unit: 'kg' },
      { id: uid(), name: 'Oil',     price: 500, unit: 'litre' },
      { id: uid(), name: 'Onion',   price: 120, unit: 'kg' }
    );
    localStorage.setItem('seeded', '1');
    saveAll();
  }
  renderAll();
});
