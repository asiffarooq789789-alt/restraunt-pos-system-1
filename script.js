/* ========== DATA LAYER (localStorage) ========== */
const DB = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

let products   = DB.get('products', []);      // {id, name, price, unit}
let stores     = DB.get('stores', []);        // {id, name, items: {productId: qty}}
let mainStore  = DB.get('mainStore', {});     // {productId: qty}
let transfers  = DB.get('transfers', []);     // {date, productId, storeId, qty}
let accounts   = DB.get('accounts', {});      // {storeId: {productId: {qty, price}}}

function saveAll() {
  DB.set('products', products);
  DB.set('stores', stores);
  DB.set('mainStore', mainStore);
  DB.set('transfers', transfers);
  DB.set('accounts', accounts);
}

/* ========== UTILS ========== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function getProduct(id) {
  return products.find(p => p.id === id);
}

function getStore(id) {
  return stores.find(s => s.id === id);
}

/* ========== NAVIGATION ========== */
$$('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    $$('.page').forEach(p => p.classList.remove('active'));
    const pageId = btn.dataset.page;
    $('#' + pageId).classList.add('active');

    const titles = {
      dashboard: 'Dashboard',
      mainstore: 'Main Store',
      substores: 'Sub Stores',
      transfer: 'Transfer Stock',
      products: 'Products / Settings',
      accounts: 'Store Accounts'
    };
    $('#pageTitle').textContent = titles[pageId];
  });
});

/* ========== PRODUCTS ========== */
$('#productForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#productName').value.trim();
  const price = parseFloat($('#productPrice').value);
  const unit = $('#productUnit').value.trim();

  if (!name || isNaN(price) || !unit) return;

  products.push({ id: uid(), name, price, unit });
  saveAll();

  e.target.reset();
  renderAll();
});

function renderProducts() {
  const tbody = $('#productsTable');
  tbody.innerHTML = products.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">No products added yet</td></tr>`
    : products.map(p => `
      <tr>
        <td>${p.name}</td>
        <td>Rs ${p.price.toFixed(2)}</td>
        <td>${p.unit}</td>
        <td><button class="btn danger" onclick="deleteProduct('${p.id}')">Delete</button></td>
      </tr>
    `).join('');
}

window.deleteProduct = function (id) {
  if (!confirm('Delete this product? It will also be removed from all stores.')) return;
  products = products.filter(p => p.id !== id);
  delete mainStore[id];
  stores.forEach(s => delete s.items[id]);
  Object.keys(accounts).forEach(sid => delete accounts[sid][id]);
  saveAll();
  renderAll();
};

/* ========== PURCHASE (MAIN STORE) ========== */
$('#purchaseForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const pid = $('#purchaseProduct').value;
  const qty = parseInt($('#purchaseQty').value);
  const priceInput = $('#purchasePrice').value;

  if (!pid || qty <= 0) return;

  const product = getProduct(pid);
  if (!product) return;

  // Agar naya price diya, product ka price update kar do
  if (priceInput && !isNaN(parseFloat(priceInput))) {
    product.price = parseFloat(priceInput);
  }

  mainStore[pid] = (mainStore[pid] || 0) + qty;
  saveAll();
  e.target.reset();
  renderAll();
});

function renderMainStore() {
  const tbody = $('#mainStoreTable');
  const entries = Object.entries(mainStore).filter(([, q]) => q > 0);

  tbody.innerHTML = entries.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Main store is empty</td></tr>`
    : entries.map(([pid, qty]) => {
        const p = getProduct(pid);
        if (!p) return '';
        const total = qty * p.price;
        return `
          <tr>
            <td>${p.name}</td>
            <td>${qty} ${p.unit}</td>
            <td>Rs ${p.price.toFixed(2)}</td>
            <td>Rs ${total.toFixed(2)}</td>
          </tr>`;
      }).join('');
}

/* ========== SUB STORES ========== */
$('#storeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#storeName').value.trim();
  if (!name) return;

  stores.push({ id: uid(), name, items: {} });
  saveAll();
  e.target.reset();
  renderAll();
});

function renderStores() {
  const container = $('#storesList');
  container.innerHTML = stores.length === 0
    ? `<p style="color:#94a3b8;">No sub stores added yet</p>`
    : stores.map(s => {
        const items = Object.entries(s.items).filter(([, q]) => q > 0);
        return `
          <div class="store-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <h3>🏪 ${s.name}</h3>
              <button class="btn danger" onclick="deleteStore('${s.id}')">Delete</button>
            </div>
            ${items.length === 0
              ? `<div style="color:#94a3b8;font-size:13px;">No stock</div>`
              : items.map(([pid, qty]) => {
                  const p = getProduct(pid);
                  if (!p) return '';
                  return `<div class="item"><span>${p.name}</span><span>${qty} ${p.unit}</span></div>`;
                }).join('')
            }
          </div>
        `;
      }).join('');
}

window.deleteStore = function (id) {
  if (!confirm('Delete this store? All its stock will be lost.')) return;
  stores = stores.filter(s => s.id !== id);
  delete accounts[id];
  saveAll();
  renderAll();
};

/* ========== TRANSFER ========== */
$('#transferForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const pid = $('#transferProduct').value;
  const sid = $('#transferStore').value;
  const qty = parseInt($('#transferQty').value);

  const msg = $('#transferMsg');

  if (!pid || !sid || qty <= 0) {
    msg.textContent = 'Please fill all fields correctly.';
    msg.className = 'msg error';
    return;
  }

  const available = mainStore[pid] || 0;
  if (qty > available) {
    msg.textContent = `Not enough stock in main store. Available: ${available}`;
    msg.className = 'msg error';
    return;
  }

  const product = getProduct(pid);
  const store = getStore(sid);
  if (!product || !store) return;

  // Deduct from main store
  mainStore[pid] -= qty;

  // Add to sub store
  store.items[pid] = (store.items[pid] || 0) + qty;

  // Add to store account (khata)
  if (!accounts[sid]) accounts[sid] = {};
  if (!accounts[sid][pid]) accounts[sid][pid] = { qty: 0, price: product.price };
  accounts[sid][pid].qty += qty;
  accounts[sid][pid].price = product.price; // latest price

  // Transfer history
  transfers.unshift({
    date: new Date().toLocaleString(),
    productId: pid,
    storeId: sid,
    qty
  });

  saveAll();
  e.target.reset();

  msg.textContent = `✅ ${qty} ${product.unit} of ${product.name} transferred to ${store.name}`;
  msg.className = 'msg success';

  renderAll();
  setTimeout(() => { msg.textContent = ''; }, 4000);
});

function renderTransferHistory() {
  const tbody = $('#transferHistory');
  tbody.innerHTML = transfers.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">No transfers yet</td></tr>`
    : transfers.slice(0, 20).map(t => {
        const p = getProduct(t.productId);
        const s = getStore(t.storeId);
        return `
          <tr>
            <td>${t.date}</td>
            <td>${p ? p.name : '—'}</td>
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
    ? `<tr><td colspan="5" style="text-align:center;color:#94a3b8;">No account entries yet</td></tr>`
    : rows.map(r => `
      <tr>
        <td>${r.storeName}</td>
        <td>${r.productName}</td>
        <td>${r.qty} ${r.unit}</td>
        <td>Rs ${r.price.toFixed(2)}</td>
        <td>Rs ${r.total.toFixed(2)}</td>
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
  $('#statMainValue').textContent = 'Rs ' + value.toFixed(2);
}

/* ========== DROPDOWNS ========== */
function renderDropdowns() {
  // Purchase products
  const pSel = $('#purchaseProduct');
  pSel.innerHTML = products.length === 0
    ? `<option value="">Add products first</option>`
    : products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  // Transfer products
  const tSel = $('#transferProduct');
  tSel.innerHTML = products.length === 0
    ? `<option value="">Add products first</option>`
    : products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  // Transfer stores
  const sSel = $('#transferStore');
  sSel.innerHTML = stores.length === 0
    ? `<option value="">Add stores first</option>`
    : stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

/* ========== MASTER RENDER ========== */
function renderAll() {
  renderDashboard();
  renderProducts();
  renderMainStore();
  renderStores();
  renderTransferHistory();
  renderAccounts();
  renderDropdowns();
}

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', () => {
  // Seed default products if empty (only first time)
  if (products.length === 0 && !localStorage.getItem('seeded')) {
    products.push(
      { id: uid(), name: 'Chicken', price: 350, unit: 'kg' },
      { id: uid(), name: 'Rice',    price: 200, unit: 'kg' },
      { id: uid(), name: 'Oil',     price: 500, unit: 'litre' }
    );
    localStorage.setItem('seeded', '1');
    saveAll();
  }
  renderAll();
});
