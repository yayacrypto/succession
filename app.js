// Succession storefront - production build.
// Data: Firestore (products, settings, orders). Auth: Firebase Auth (owner only).
// Notifications: EmailJS to the owner. All money math is re-validated by Firestore rules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const app = initializeApp(window.FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

const EMAILJS_PUBLIC_KEY = 'BiM22ONZbJbZRGSz5';
const EMAILJS_SERVICE_ID = 'service_cwpmpd9';
const EMAILJS_TEMPLATE_ID = 'template_new_order';

const SIZES = ['S', 'M', 'L', 'XL', '2XL'];
const SIZE_GUIDE = [['L', '70-80 kg'], ['XL', '80-90 kg'], ['2XL', '90-110 kg']];
const GOVS = ['Alexandria','Aswan','Asyut','Beheira','Beni Suef','Cairo','Dakahlia','Damietta','Faiyum','Gharbia','Giza','Ismailia','Kafr El Sheikh','Luxor','Matrouh','Minya','Monufia','New Valley','North Sinai','Port Said','Qalyubia','Qena','Red Sea','Sharqia','Sohag','South Sinai','Suez'];

const DEFAULT_SETTINGS = {
  shippingFee: 60,
  shippingGovs: ['Alexandria'],
  acceptingOrders: false,
  storeWhatsApp: '+201033820516',
  notifyEmail: 'yahiahammad2008@gmail.com'
};

const state = { products: [], settings: null, cart: [], user: null, orders: [], route: '' };
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const egp = (n) => `EGP ${Number(n).toLocaleString('en-EG')}`;

function loadCart() { try { state.cart = JSON.parse(localStorage.getItem('succession-live-cart') || '[]'); } catch { state.cart = []; } }
function saveCart() { localStorage.setItem('succession-live-cart', JSON.stringify(state.cart)); }

async function loadStore() {
  const [prods, setDocSnap] = await Promise.all([
    getDocs(collection(db, 'products')),
    getDoc(doc(db, 'settings', 'store'))
  ]);
  state.products = prods.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.active !== false);
  state.settings = setDocSnap.exists() ? { ...DEFAULT_SETTINGS, ...setDocSnap.data() } : null;
}

// ---------- routing ----------
window.addEventListener('hashchange', render);
function nav(hash) { location.hash = hash; }
function routeParts() { return (location.hash || '#/').slice(2).split('/'); }

async function render() {
  const parts = routeParts();
  const root = $('#app');
  try {
    if (parts[0] === 'owner') { await renderOwner(root, parts.slice(1)); }
    else if (parts[0] === 'product') { renderProduct(root, parts[1]); }
    else if (parts[0] === 'cart') { renderCart(root); }
    else if (parts[0] === 'checkout') { renderCheckout(root); }
    else if (parts[0] === 'confirm') { renderConfirm(root, parts[1]); }
    else if (parts[0] === 'help') { renderHelp(root); }
    else { renderHome(root); }
  } catch (e) {
    console.error(e);
    root.innerHTML = shell(`<section class="page"><h1>Something went wrong</h1><p class="muted">${esc(e.message)}</p></section>`);
  }
  window.scrollTo(0, 0);
}

// ---------- shared chrome ----------
function shell(content) {
  const count = state.cart.reduce((a, c) => a + c.qty, 0);
  const cartLabel = `Cart${count ? ` (${count})` : ''}`;
  return `
  <header class="top">
    <a href="#/" class="brand"><img src="assets/leopard.jpg" alt="Succession logo"><span>Succession</span></a>
    <nav class="mainnav">
      <a href="#/">Home</a>
      <div class="dropdown">
        <button type="button" class="dropbtn">Discover</button>
        <div class="dropmenu">
          <a href="#/" data-scroll="hoodies">Hoodies</a>
          <a href="#/" data-scroll="pants">Pants</a>
        </div>
      </div>
      <a href="#/help">Help</a>
      <a href="#/cart" class="cartlink">${cartLabel}</a>
    </nav>
    <div class="mobright">
      <a href="#/cart" class="cartlink mobilcart">${cartLabel}</a>
      <button type="button" class="burger" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
    </div>
  </header>
  <div class="drawerwrap" hidden>
    <div class="draweroverlay"></div>
    <aside class="drawer" aria-label="Menu">
      <div class="drawerhead"><span>Menu</span><button type="button" class="drawerclose" aria-label="Close menu">&times;</button></div>
      <a href="#/" data-nav>Home</a>
      <p class="drawergroup">Discover</p>
      <a href="#/" class="sub" data-nav data-scroll="hoodies">Hoodies</a>
      <a href="#/" class="sub" data-nav data-scroll="pants">Pants</a>
      <a href="#/help" data-nav>Help</a>
      <a href="#/cart" data-nav>${cartLabel}</a>
    </aside>
  </div>
  <main>${content}</main>
  <footer class="foot">Succession - Alexandria, Egypt - Orders &amp; support on WhatsApp ${esc(state.settings?.storeWhatsApp || '')}</footer>`;
}

// ---------- nav drawer ----------
function closeDrawer() {
  const w = document.querySelector('.drawerwrap'); if (!w || w.hidden) return;
  w.hidden = true;
  const b = document.querySelector('.burger'); if (b) b.setAttribute('aria-expanded', 'false');
}
function goSection(id) {
  const doScroll = () => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  if ((location.hash || '#/') !== '#/') { location.hash = '#/'; setTimeout(doScroll, 150); }
  else doScroll();
}
document.addEventListener('click', (e) => {
  const burger = e.target.closest('.burger');
  if (burger) {
    const w = document.querySelector('.drawerwrap');
    if (w) { w.hidden = !w.hidden; burger.setAttribute('aria-expanded', String(!w.hidden)); }
    return;
  }
  if (e.target.closest('.drawerclose') || e.target.closest('.draweroverlay')) { closeDrawer(); return; }
  const sc = e.target.closest('[data-scroll]');
  if (sc) { e.preventDefault(); closeDrawer(); goSection(sc.dataset.scroll); return; }
  if (e.target.closest('[data-nav]')) closeDrawer();
});
window.addEventListener('hashchange', closeDrawer);

function productCard(p) {
  return `
  <a class="card" href="#/product/${p.id}">
    <div class="thumb"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></div>
    <div class="cardbody">
      <h3>${esc(p.name)}</h3>
      <p class="price">${egp(p.price)}</p>
      <p class="muted small">${SIZES.filter(s => p.sizes && p.sizes[s]).join(' / ') || 'Sizes soon'}</p>
    </div>
  </a>`;
}

// ---------- storefront ----------
function renderHome(root) {
  const hoodies = state.products.filter(p => p.category === 'hoodies');
  const pants = state.products.filter(p => p.category === 'pants');
  root.innerHTML = shell(`
  <section class="hero">
    <div class="herotext">
      <h1>Simple colors, bold prints.</h1>
      <p>Oversized streetwear from Alexandria. Cash on delivery, e-wallet or bank transfer.</p>
      <a class="btn" href="#catalog">Shop the drop</a>
    </div>
    <img class="heroart" src="assets/leopard.jpg" alt="Succession leopard artwork">
  </section>
  <section class="page" id="catalog">
    <h2 id="hoodies">Hoodies</h2>
    <div class="grid">${hoodies.map(productCard).join('') || '<p class="muted">No products here yet.</p>'}</div>
    <h2 id="pants">Pants</h2>
    <div class="grid">${pants.map(productCard).join('') || '<p class="muted">No products here yet.</p>'}</div>
  </section>`);
}

function renderProduct(root, id) {
  const p = state.products.find(x => x.id === id);
  if (!p) { root.innerHTML = shell('<section class="page"><h1>Product not found</h1></section>'); return; }
  const available = SIZES.filter(s => p.sizes && p.sizes[s]);
  root.innerHTML = shell(`
  <section class="page product">
    <div class="thumb big"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div>
    <div class="pinfo">
      <h1>${esc(p.name)}</h1>
      <p class="price">${egp(p.price)}</p>
      <p class="muted">${esc(p.desc || '')}</p>
      <h3>Size</h3>
      <div class="sizes">
        ${SIZES.map(s => `<button class="size" data-size="${s}" ${p.sizes && p.sizes[s] ? '' : 'disabled'}>${s}${p.sizes && p.sizes[s] ? '' : ' <small>soon</small>'}</button>`).join('')}
      </div>
      <details class="sizeguide"><summary>Size guide (by weight)</summary>
        <ul>${SIZE_GUIDE.map(([s, w]) => `<li><b>${s}</b> - ${w}</li>`).join('')}</ul>
      </details>
      <button class="btn" id="addBtn" disabled>Add to cart</button>
      <p class="muted small">Delivery: ${(state.settings?.shippingGovs || []).join(', ') || 'closed'} - ${egp(state.settings?.shippingFee ?? 0)} shipping.</p>
    </div>
  </section>`);
  let chosen = null;
  document.querySelectorAll('.size:not([disabled])').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.size').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel'); chosen = b.dataset.size; $('#addBtn').disabled = false;
  }));
  $('#addBtn').addEventListener('click', () => {
    const line = state.cart.find(c => c.productId === p.id && c.size === chosen);
    if (line) line.qty = Math.min(10, line.qty + 1); else state.cart.push({ productId: p.id, size: chosen, qty: 1 });
    saveCart(); nav('#/cart');
  });
}

function cartLines() {
  return state.cart.map(c => {
    const p = state.products.find(x => x.id === c.productId);
    return p ? { ...c, product: p, lineTotal: p.price * c.qty } : null;
  }).filter(Boolean);
}

function renderCart(root) {
  const lines = cartLines();
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const ship = state.settings?.shippingFee ?? 0;
  root.innerHTML = shell(`
  <section class="page">
    <h1>Cart</h1>
    ${lines.length ? `
      <table class="cart">
        ${lines.map((l, i) => `<tr>
          <td><img class="mini" src="${esc(l.product.image)}" alt=""></td>
          <td>${esc(l.product.name)}<br><span class="muted small">Size ${l.size}</span></td>
          <td>${egp(l.product.price)} x ${l.qty}</td>
          <td>${egp(l.lineTotal)}</td>
          <td><button class="link" data-rm="${i}">Remove</button></td>
        </tr>`).join('')}
      </table>
      <div class="totals">
        <p>Subtotal <b>${egp(subtotal)}</b></p>
        <p>Shipping (${(state.settings?.shippingGovs || []).join(', ')}) <b>${egp(ship)}</b></p>
        <p class="grand">Total <b>${egp(subtotal + ship)}</b></p>
      </div>
      <a class="btn" href="#/checkout">Checkout</a>`
    : '<p class="muted">Your cart is empty.</p>'}
  </section>`);
  document.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
    state.cart.splice(Number(b.dataset.rm), 1); saveCart(); render();
  }));
}

// ---------- checkout ----------
function renderCheckout(root) {
  const lines = cartLines();
  if (!lines.length) { nav('#/cart'); return; }
  const open = state.settings && state.settings.acceptingOrders === true;
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const ship = state.settings?.shippingFee ?? 0;
  const shipGovs = state.settings?.shippingGovs || [];
  root.innerHTML = shell(`
  <section class="page">
    <h1>Checkout</h1>
    ${!open ? `<div class="notice">Orders are temporarily closed. Follow us and check back soon - or message us on WhatsApp ${esc(state.settings?.storeWhatsApp || '')}.</div>` : ''}
    <form id="co" class="form" ${!open ? 'inert' : ''}>
      <label>Full name<input name="name" required minlength="2" maxlength="100" autocomplete="name"></label>
      <label>Email<input name="email" type="email" required maxlength="100" autocomplete="email"></label>
      <label>WhatsApp phone<input name="phone" type="tel" required autocomplete="tel" placeholder="+20 1X XXX XXXX"></label>
      <label>Governorate
        <select name="gov" required>
          <option value="">Choose governorate</option>
          ${GOVS.map(g => `<option value="${g}" ${shipGovs.includes(g) ? '' : 'disabled'}>${g}${shipGovs.includes(g) ? '' : ' (not available yet)'}</option>`).join('')}
        </select>
      </label>
      <label>Area / district<input name="area" required minlength="2" maxlength="100"></label>
      <label>Street &amp; building<input name="street" required minlength="3" maxlength="200" placeholder="Street, building, floor, apartment"></label>
      <h3>Payment</h3>
      <label class="radio"><input type="radio" name="payment" value="cod" checked> Cash on delivery</label>
      <label class="radio"><input type="radio" name="payment" value="wallet"> E-wallet (we send you the wallet number on WhatsApp)</label>
      <label class="radio"><input type="radio" name="payment" value="bank"> Bank transfer (we send you the details on WhatsApp)</label>
      <div class="totals">
        <p>Subtotal <b>${egp(subtotal)}</b></p>
        <p>Shipping <b>${egp(ship)}</b></p>
        <p class="grand">Total <b>${egp(subtotal + ship)}</b></p>
      </div>
      <p class="error" id="coErr"></p>
      <button class="btn" type="submit" ${!open ? 'disabled' : ''}>Place order - ${egp(subtotal + ship)}</button>
    </form>
  </section>`);
  if (!open) return;
  $('#co').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Placing order...';
    try {
      // Re-read product docs at order time so totals use trusted prices, not the cart.
      const items = [];
      let sub = 0;
      for (const l of lines) {
        const snap = await getDoc(doc(db, 'products', l.productId));
        if (!snap.exists()) throw new Error('A product in your cart is no longer available.');
        const p = snap.data();
        if (!p.sizes || !p.sizes[l.size]) throw new Error(`${p.name}: size ${l.size} is not available.`);
        items.push({ productId: l.productId, size: l.size, qty: l.qty, price: p.price });
        sub += p.price * l.qty;
      }
      const shipping = state.settings.shippingFee;
      const orderNo = 'SCS-' + Date.now().toString(36).toUpperCase();
      const orderDoc = {
        orderNo,
        items,
        subtotal: sub,
        shipping,
        total: sub + shipping,
        payment: f.get('payment'),
        customer: {
          name: f.get('name').trim(), email: f.get('email').trim(), phone: f.get('phone').trim(),
          gov: f.get('gov'), area: f.get('area').trim(), street: f.get('street').trim()
        },
        status: 'New',
        createdAt: serverTimestamp()
      };
      const ref = await addDoc(collection(db, 'orders'), orderDoc);
      // Email notification to the owner (best effort; the durable record is Firestore).
      try {
        await sendOrderEmail(orderDoc, ref.id);
      } catch (mailErr) { console.warn('email notify failed', mailErr); }
      state.cart = []; saveCart();
      sessionStorage.setItem('succession-last-order', JSON.stringify({ ...orderDoc, createdAt: null }));
      nav('#/confirm/' + ref.id);
    } catch (err) {
      console.error(err);
      $('#coErr').textContent = err.code === 'permission-denied'
        ? 'This order was rejected by the store. Please refresh and try again, or message us on WhatsApp.'
        : err.message;
      btn.disabled = false; btn.textContent = 'Place order';
    }
  });
}

function sendOrderEmail(orderDoc, id) {
  if (!window.emailjs) return Promise.resolve();
  window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  const itemsText = orderDoc.items.map(i => {
    const p = state.products.find(x => x.id === i.productId);
    return `${i.qty} x ${p ? p.name : i.productId} (${i.size}) - ${egp(i.price * i.qty)}`;
  }).join('\n');
  const payLabel = { cod: 'Cash on delivery', wallet: 'E-wallet', bank: 'Bank transfer' }[orderDoc.payment];
  return window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    order_number: orderDoc.orderNo,
    order_id: id,
    items: itemsText,
    subtotal: egp(orderDoc.subtotal),
    shipping: egp(orderDoc.shipping),
    total: egp(orderDoc.total),
    payment: payLabel,
    customer_name: orderDoc.customer.name,
    customer_email: orderDoc.customer.email,
    customer_phone: orderDoc.customer.phone,
    address: `${orderDoc.customer.street}, ${orderDoc.customer.area}, ${orderDoc.customer.gov}`
  });
}

function renderConfirm(root, id) {
  const cached = JSON.parse(sessionStorage.getItem('succession-last-order') || 'null');
  const payNote = cached && cached.payment !== 'cod'
    ? `<p class="notice">You chose ${cached.payment === 'wallet' ? 'e-wallet' : 'bank transfer'}: the owner will send you the payment details on WhatsApp.</p>` : '';
  root.innerHTML = shell(`
  <section class="page confirm">
    <div class="check">&#10003;</div>
    <h1>Order ${esc(cached?.orderNo || '')} placed</h1>
    <p>Thank you! The owner will contact you on WhatsApp to confirm your order.</p>
    ${payNote}
    ${cached ? `<div class="totals left">
      ${cached.items.map(i => { const p = state.products.find(x => x.id === i.productId); return `<p>${i.qty} x ${esc(p ? p.name : i.productId)} (${i.size}) <b>${egp(i.price * i.qty)}</b></p>`; }).join('')}
      <p>Shipping <b>${egp(cached.shipping)}</b></p>
      <p class="grand">Total <b>${egp(cached.total)}</b></p>
    </div>` : ''}
    <a class="btn" href="#/">Back to store</a>
  </section>`);
}

function renderHelp(root) {
  root.innerHTML = shell(`
  <section class="page">
    <h1>Help</h1>
    <h3>Delivery</h3>
    <p>We currently deliver in ${(state.settings?.shippingGovs || []).join(', ') || 'Alexandria'} only. Shipping is ${egp(state.settings?.shippingFee ?? 60)} per order.</p>
    <h3>Payment</h3>
    <p>Cash on delivery, e-wallet, or bank transfer. For wallet or bank, the owner sends you the payment details on WhatsApp after you order.</p>
    <h3>Sizing</h3>
    <ul>${SIZE_GUIDE.map(([s, w]) => `<li><b>${s}</b> - ${w}</li>`).join('')}</ul>
    <h3>Contact</h3>
    <p>WhatsApp: ${esc(state.settings?.storeWhatsApp || '')}</p>
  </section>`);
}

// ---------- owner dashboard ----------
async function ensureSeed() {
  // First owner login creates the settings doc (store starts CLOSED until the owner opens it).
  const ref = doc(db, 'settings', 'store');
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, DEFAULT_SETTINGS);
  state.settings = { ...DEFAULT_SETTINGS, ...(await getDoc(ref)).data() };
}

async function renderOwner(root, parts) {
  if (!state.user) {
    root.innerHTML = shell(`
    <section class="page narrow">
      <h1>Owner sign in</h1>
      <form id="login" class="form">
        <label>Email<input name="email" type="email" required autocomplete="username"></label>
        <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
        <p class="error" id="loginErr"></p>
        <button class="btn" type="submit">Sign in</button>
      </form>
    </section>`);
    $('#login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await signInWithEmailAndPassword(auth, f.get('email').trim(), f.get('password'));
      } catch (err) { $('#loginErr').textContent = 'Wrong email or password.'; }
    });
    return;
  }

  await ensureSeed();
  const tab = parts[0] || 'orders';
  const tabs = `
    <nav class="tabs">
      <a href="#/owner/orders" class="${tab === 'orders' ? 'sel' : ''}">Orders</a>
      <a href="#/owner/products" class="${tab === 'products' ? 'sel' : ''}">Products</a>
      <a href="#/owner/settings" class="${tab === 'settings' ? 'sel' : ''}">Settings</a>
      <button class="link" id="out">Sign out</button>
    </nav>`;

  let body = '';
  if (tab === 'products') { body = await ownerProducts(); }
  else if (tab === 'settings') { body = ownerSettings(); }
  else { body = await ownerOrders(); }

  root.innerHTML = shell(`<section class="page"><h1>Owner dashboard</h1>${tabs}${body}</section>`);
  $('#out').addEventListener('click', () => signOut(auth));
  if (tab === 'products') bindOwnerProducts(root);
  if (tab === 'settings') bindOwnerSettings(root);
  if (tab === 'orders') bindOwnerOrders(root);
}

async function ownerOrders() {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!orders.length) return '<p class="muted">No orders yet.</p>';
  return orders.map(o => `
    <details class="order">
      <summary>
        <b>${esc(o.orderNo || o.id)}</b> - ${esc(o.customer?.name || '')} - ${egp(o.total)}
        <span class="badge">${esc(o.status)}</span>
        <span class="muted small">${o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString('en-GB') : ''}</span>
      </summary>
      <div class="orderbody">
        ${(o.items || []).map(i => { const p = state.products.find(x => x.id === i.productId); return `<p>${i.qty} x ${esc(p ? p.name : i.productId)} (${i.size}) - ${egp(i.price * i.qty)}</p>`; }).join('')}
        <p>Subtotal ${egp(o.subtotal)} + shipping ${egp(o.shipping)} = <b>${egp(o.total)}</b></p>
        <p>Payment: ${esc(o.payment)}</p>
        <p>Phone: <a href="https://wa.me/${esc((o.customer?.phone || '').replace(/[^0-9]/g, ''))}" target="_blank" rel="noopener">${esc(o.customer?.phone || '')}</a> - Email: ${esc(o.customer?.email || '')}</p>
        <p>Address: ${esc(o.customer?.street || '')}, ${esc(o.customer?.area || '')}, ${esc(o.customer?.gov || '')}</p>
        <label>Status
          <select data-oid="${o.id}" class="statusSel">
            ${['New', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
      </div>
    </details>`).join('');
}

function bindOwnerOrders(root) {
  document.querySelectorAll('.statusSel').forEach(sel => sel.addEventListener('change', async () => {
    await updateDoc(doc(db, 'orders', sel.dataset.oid), { status: sel.value });
  }));
}

async function ownerProducts() {
  const snap = await getDocs(collection(db, 'products'));
  const prods = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return `
  <div class="adminlist">
    ${prods.map(p => `
      <div class="adminitem">
        <img class="mini" src="${esc(p.image)}" alt="">
        <div><b>${esc(p.name)}</b><br><span class="muted small">${esc(p.category)} - ${egp(p.price)} - ${SIZES.filter(s => p.sizes && p.sizes[s]).join('/') || 'no sizes'}${p.active === false ? ' - hidden' : ''}</span></div>
        <button class="link" data-edit="${p.id}">Edit</button>
        <button class="link" data-del="${p.id}">Delete</button>
      </div>`).join('') || '<p class="muted">No products yet.</p>'}
  </div>
  <h3 id="formTitle">Add product</h3>
  <form id="pform" class="form">
    <input type="hidden" name="id">
    <label>Name<input name="name" required maxlength="80"></label>
    <label>Price (EGP)<input name="price" type="number" min="1" max="100000" required></label>
    <label>Category
      <select name="category"><option value="hoodies">Hoodies</option><option value="pants">Pants</option></select>
    </label>
    <label>Image path or URL<input name="image" required placeholder="assets/hood-dark.jpg"></label>
    <label>Description<input name="desc" maxlength="200"></label>
    <fieldset><legend>Sizes available</legend>
      ${SIZES.map(s => `<label class="radio"><input type="checkbox" name="size_${s}"> ${s}</label>`).join('')}
    </fieldset>
    <label class="radio"><input type="checkbox" name="active" checked> Visible in store</label>
    <p class="error" id="pErr"></p>
    <button class="btn" type="submit">Save product</button>
    <button class="link" type="button" id="pcancel" hidden>Cancel edit</button>
  </form>`;
}

function bindOwnerProducts(root) {
  const form = $('#pform');
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', async () => {
    const snap = await getDoc(doc(db, 'products', b.dataset.edit));
    const p = snap.data();
    form.id.value = b.dataset.edit;
    form.name.value = p.name; form.price.value = p.price; form.category.value = p.category;
    form.image.value = p.image; form.desc.value = p.desc || '';
    SIZES.forEach(s => form['size_' + s].checked = !!(p.sizes && p.sizes[s]));
    form.active.checked = p.active !== false;
    $('#formTitle').textContent = 'Edit product'; $('#pcancel').hidden = false;
  }));
  $('#pcancel').addEventListener('click', () => { form.reset(); form.id.value = ''; $('#formTitle').textContent = 'Add product'; $('#pcancel').hidden = true; });
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this product?')) return;
    await deleteDoc(doc(db, 'products', b.dataset.del)); render();
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const data = {
      name: f.get('name').trim(),
      price: Number(f.get('price')),
      category: f.get('category'),
      image: f.get('image').trim(),
      desc: f.get('desc').trim(),
      sizes: Object.fromEntries(SIZES.map(s => [s, f.get('size_' + s) === 'on'])),
      active: f.get('active') === 'on'
    };
    try {
      if (form.id.value) await updateDoc(doc(db, 'products', form.id.value), data);
      else await addDoc(collection(db, 'products'), data);
      await loadStore(); render();
    } catch (err) { $('#pErr').textContent = err.message; }
  });
}

function ownerSettings() {
  const s = state.settings;
  return `
  <form id="sform" class="form">
    <label class="radio big"><input type="checkbox" name="acceptingOrders" ${s.acceptingOrders ? 'checked' : ''}> Accepting orders</label>
    <label>Shipping fee (EGP)<input name="shippingFee" type="number" min="0" max="10000" value="${s.shippingFee}" required></label>
    <fieldset><legend>Delivery governorates</legend>
      ${GOVS.map(g => `<label class="radio"><input type="checkbox" name="gov_${g}" ${s.shippingGovs.includes(g) ? 'checked' : ''}> ${g}</label>`).join('')}
    </fieldset>
    <label>Store WhatsApp<input name="storeWhatsApp" value="${esc(s.storeWhatsApp)}" required></label>
    <label>Notification email<input name="notifyEmail" type="email" value="${esc(s.notifyEmail)}" required></label>
    <p class="error" id="sErr"></p><p class="ok" id="sOk"></p>
    <button class="btn" type="submit">Save settings</button>
  </form>`;
}

function bindOwnerSettings(root) {
  $('#sform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const govs = GOVS.filter(g => f.get('gov_' + g) === 'on');
    if (!govs.length) { $('#sErr').textContent = 'Pick at least one delivery governorate.'; return; }
    try {
      await setDoc(doc(db, 'settings', 'store'), {
        acceptingOrders: f.get('acceptingOrders') === 'on',
        shippingFee: Number(f.get('shippingFee')),
        shippingGovs: govs,
        storeWhatsApp: f.get('storeWhatsApp').trim(),
        notifyEmail: f.get('notifyEmail').trim()
      });
      state.settings = { ...state.settings, acceptingOrders: f.get('acceptingOrders') === 'on', shippingFee: Number(f.get('shippingFee')), shippingGovs: govs };
      $('#sOk').textContent = 'Saved.'; $('#sErr').textContent = '';
    } catch (err) { $('#sErr').textContent = err.message; }
  });
}

// ---------- boot ----------
async function boot() {
  loadCart();
  onAuthStateChanged(auth, (u) => { state.user = u; render(); });
  try { await loadStore(); } catch (e) { console.warn('store load failed', e); state.settings = null; }
  render();
}
boot();

