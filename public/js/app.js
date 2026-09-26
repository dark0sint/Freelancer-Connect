(() => {
  'use strict';

  /* ============================== State & API ============================== */
  const state = {
    token: localStorage.getItem('fc_token') || null,
    user: null,
    route: '',
  };

  const API = '/api';

  async function api(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;
    let res;
    try {
      res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch (err) {
      throw { error: 'Tidak bisa terhubung ke server. Periksa koneksi Anda.' };
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) throw data && data.error ? data : { error: 'Terjadi kesalahan.' };
    return data;
  }

  function setSession(token, user) {
    state.token = token;
    state.user = user;
    if (token) localStorage.setItem('fc_token', token);
    else localStorage.removeItem('fc_token');
  }

  async function loadMe() {
    if (!state.token) return;
    try {
      const { user } = await api('/auth/me');
      state.user = user;
    } catch (e) {
      setSession(null, null);
    }
  }

  /* ============================== Utilities ============================== */
  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function nl2br(str) { return esc(str).replace(/\n/g, '<br>'); }
  function rupiah(n) { return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID'); }
  function initials(name) {
    return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }
  function avatar(user, size = '') {
    if (!user) return `<div class="avatar ${size}" style="background:#999">?</div>`;
    return `<div class="avatar ${size}" style="background:${esc(user.avatarColor || '#0E5C56')}">${esc(initials(user.name))}</div>`;
  }
  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} jam lalu`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} hari lalu`;
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function stars(rating) {
    const r = Math.round(rating || 0);
    return '<span class="stars">' + '★'.repeat(r) + '☆'.repeat(5 - r) + '</span>';
  }
  function categoryColor(cat) {
    const map = {
      'Desain Grafis': '#D9A441', 'Pengembangan Web & App': '#0E5C56', 'Penulisan & Terjemahan': '#1C5D8C',
      'Digital Marketing': '#B23A2E', 'Video & Animasi': '#7A4FB5', 'Musik & Audio': '#2F7D4F',
      'Bisnis & Konsultasi': '#48565E', 'Fotografi': '#B3822C',
    };
    return map[cat] || '#0E5C56';
  }
  function toast(msg, type = '') {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }
  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  /* ============================== Router ============================== */
  const routes = [];
  function route(pattern, handler) {
    const keys = [];
    const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
    routes.push({ regex, keys, handler });
  }
  async function render() {
    const hash = location.hash.slice(1) || '/';
    state.route = hash;
    const path = hash.split('?')[0];
    for (const r of routes) {
      const m = path.match(r.regex);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        const query = Object.fromEntries(new URLSearchParams(hash.split('?')[1] || ''));
        renderChrome();
        window.scrollTo(0, 0);
        try {
          await r.handler(params, query);
        } catch (err) {
          qs('#app-main').innerHTML = errorState(err && err.error);
        }
        return;
      }
    }
    qs('#app-main') && (qs('#app-main').innerHTML = errorState('Halaman tidak ditemukan.'));
  }
  function go(path) { location.hash = path; }

  function errorState(msg) {
    return `<div class="container"><div class="empty"><div class="big">🕵️</div><p>${esc(msg || 'Terjadi kesalahan.')}</p>
      <button class="btn btn-outline" onclick="location.hash='/'">Kembali ke Beranda</button></div></div>`;
  }

  /* ============================== Chrome (nav) ============================== */
  function navLink(path, label, icon) {
    const active = state.route === path || state.route.startsWith(path + '?');
    return { path, label, icon, active };
  }
  function renderChrome() {
    const links = [
      navLink('/', 'Jelajahi Gig'),
      navLink('/feed', 'Feed'),
      navLink('/orders', 'Pesanan'),
    ];
    const app = document.getElementById('app');
    let shell = document.getElementById('shell');
    if (!shell) {
      app.innerHTML = `
        <header class="topnav"><div class="container topnav-inner">
          <div class="logo" onclick="location.hash='/'"><span class="logo-mark">fc</span> Freelancer Connect</div>
          <nav class="nav-links" id="nav-links"></nav>
          <div class="nav-spacer"></div>
          <div class="nav-actions" id="nav-actions"></div>
        </div></header>
        <main id="app-main"></main>
        <nav class="tabbar" id="tabbar"></nav>
      `;
      shell = app;
    }
    qs('#nav-links').innerHTML = links.map((l) => `<div class="nav-link ${l.active ? 'active' : ''}" data-go="${l.path}">${esc(l.label)}</div>`).join('');
    qs('#tabbar').innerHTML = [
      { path: '/', icon: '🔎', label: 'Jelajahi' },
      { path: '/feed', icon: '📰', label: 'Feed' },
      { path: '/gig/new', icon: '➕', label: 'Buat Gig' },
      { path: '/orders', icon: '🧾', label: 'Pesanan' },
      { path: state.user ? `/profile/${state.user.id}` : '/login', icon: '👤', label: 'Profil' },
    ].map((t) => `<div class="tabbar-item ${state.route === t.path ? 'active' : ''}" data-go="${t.path}"><span class="tabbar-icon">${t.icon}</span>${esc(t.label)}</div>`).join('');

    qs('#nav-actions').innerHTML = state.user
      ? `<button class="btn btn-accent btn-sm" data-go="/gig/new">Buat Gig</button>
         <div class="avatar" style="background:${esc(state.user.avatarColor)}" data-go="/profile/${state.user.id}" title="${esc(state.user.name)}">${esc(initials(state.user.name))}</div>
         <button class="btn btn-ghost btn-sm" id="btn-logout">Keluar</button>`
      : `<button class="btn btn-outline btn-sm" data-go="/login">Masuk</button>
         <button class="btn btn-primary btn-sm" data-go="/register">Daftar</button>`;

    qsa('[data-go]').forEach((el) => el.addEventListener('click', () => go(el.getAttribute('data-go'))));
    const logoutBtn = qs('#btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => { setSession(null, null); toast('Anda telah keluar.'); go('/'); });
  }

  function requireLogin() {
    if (!state.user) { toast('Silakan masuk terlebih dahulu.', 'error'); go('/login'); return false; }
    return true;
  }

  /* ============================== View: Explore / Home ============================== */
  route('/', async (params, query) => {
    const main = qs('#app-main');
    main.innerHTML = `
      <section class="hero">
        <div class="container">
          <h1>Temukan freelancer tepercaya, atau tawarkan keahlianmu.</h1>
          <p class="lede">Profil profesional, portofolio digital, dan transaksi aman dengan escrow — semua dalam satu platform.</p>
          <div class="hero-search">
            <input type="text" id="hero-search-input" placeholder="Cari jasa, mis. 'desain logo' atau 'penulisan artikel'" value="${esc(query.q || '')}" />
            <button class="btn btn-accent" id="hero-search-btn">Cari</button>
          </div>
          <div class="hero-stats">
            <div class="hero-stat"><b id="stat-gigs">–</b><span>Gig aktif</span></div>
            <div class="hero-stat"><b id="stat-freelancers">–</b><span>Freelancer</span></div>
            <div class="hero-stat"><b>Escrow</b><span>Pembayaran aman terjamin</span></div>
          </div>
        </div>
      </section>
      <div class="container">
        <div id="cat-row" class="chip-row" style="margin-bottom:22px"></div>
        <div class="section-head"><h2 style="margin:0">Jelajahi Gig</h2>
          <select id="sort-select">
            <option value="">Terbaru</option>
            <option value="rating">Rating tertinggi</option>
            <option value="price_asc">Harga terendah</option>
            <option value="price_desc">Harga tertinggi</option>
          </select>
        </div>
        <div id="gig-grid" class="grid grid-3">${skeletonCards(6)}</div>
      </div>
    `;
    qs('#hero-search-btn').addEventListener('click', () => go('/?q=' + encodeURIComponent(qs('#hero-search-input').value)));
    qs('#hero-search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') qs('#hero-search-btn').click(); });
    qs('#sort-select').addEventListener('change', (e) => loadGigs(query.q, query.category, e.target.value));

    api('/gigs/categories', { auth: false }).then(({ categories }) => {
      qs('#cat-row').innerHTML = categories.map((c) =>
        `<div class="chip" style="cursor:pointer;${query.category === c ? 'border-color:var(--primary);color:var(--primary);font-weight:700' : ''}" data-cat="${esc(c)}">${esc(c)}</div>`
      ).join('');
      qsa('[data-cat]').forEach((el) => el.addEventListener('click', () => go('/?category=' + encodeURIComponent(el.getAttribute('data-cat')))));
    });

    loadGigs(query.q, query.category, '');
    api('/gigs', { auth: false }).then(({ gigs }) => { qs('#stat-gigs').textContent = gigs.length; });
    api('/profiles/search', { auth: false }).then(({ profiles }) => { qs('#stat-freelancers').textContent = profiles.length; });
  });

  function skeletonCards(n) {
    return Array(n).fill(0).map(() => `<div class="card"><div class="skeleton" style="height:130px"></div><div class="gig-card-body"><div class="skeleton" style="height:14px;width:60%"></div><div class="skeleton" style="height:20px;margin-top:8px"></div></div></div>`).join('');
  }

  async function loadGigs(q, category, sort) {
    const params = new URLSearchParams();
    if (q) params.set('q', q); if (category) params.set('category', category); if (sort) params.set('sort', sort);
    const { gigs } = await api('/gigs?' + params.toString(), { auth: false });
    const grid = qs('#gig-grid');
    if (!grid) return;
    if (!gigs.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">🗂️</div><p>Belum ada gig yang cocok. Coba kata kunci lain.</p></div>`;
      return;
    }
    grid.innerHTML = gigs.map(gigCard).join('');
    qsa('.gig-card', grid).forEach((el) => el.addEventListener('click', () => go(`/gig/${el.getAttribute('data-id')}`)));
  }

  function gigCard(g) {
    return `<div class="card gig-card" data-id="${g.id}">
      <div class="gig-card-accent" style="background:${categoryColor(g.category)}"></div>
      <div class="gig-card-body">
        <div class="gig-card-cat">${esc(g.category)}</div>
        <div class="gig-card-title">${esc(g.title)}</div>
        <div class="gig-card-seller">${avatar(g.seller)} ${esc(g.seller ? g.seller.name : '')} · ${g.deliveryDays} hari pengerjaan</div>
        <div class="gig-card-foot">
          <span class="rating">${g.reviewCount ? stars(g.rating) + ` (${g.reviewCount})` : 'Belum ada ulasan'}</span>
          <span class="price">${rupiah(g.price)}</span>
        </div>
      </div>
    </div>`;
  }

  /* ============================== View: Login / Register ============================== */
  route('/login', async () => {
    qs('#app-main').innerHTML = `<div class="container" style="padding:30px 20px 60px">
      <div class="form-card">
        <h2 class="center">Masuk</h2>
        <p class="muted center" style="margin-bottom:22px">Kelola gig, pesanan, dan profilmu.</p>
        <form id="login-form">
          <div class="field"><label>Email</label><input required type="email" name="email" /></div>
          <div class="field"><label>Kata sandi</label><input required type="password" name="password" /></div>
          <button class="btn btn-primary btn-block" type="submit">Masuk</button>
        </form>
        <p class="center muted" style="margin-top:18px">Belum punya akun? <button class="link-btn" data-go="/register">Daftar</button></p>
      </div>
    </div>`;
    qsa('[data-go]').forEach((el) => el.addEventListener('click', () => go(el.getAttribute('data-go'))));
    qs('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const { token, user } = await api('/auth/login', { auth: false, method: 'POST', body: Object.fromEntries(fd) });
        setSession(token, user);
        toast(`Selamat datang kembali, ${user.name}!`, 'success');
        go('/');
      } catch (err) { toast(err.error || 'Gagal masuk.', 'error'); }
    });
  });

  route('/register', async () => {
    qs('#app-main').innerHTML = `<div class="container" style="padding:30px 20px 60px">
      <div class="form-card">
        <h2 class="center">Buat Akun</h2>
        <p class="muted center" style="margin-bottom:22px">Gratis untuk klien maupun freelancer.</p>
        <form id="reg-form">
          <div class="field"><label>Nama lengkap</label><input required type="text" name="name" /></div>
          <div class="field"><label>Email</label><input required type="email" name="email" /></div>
          <div class="field"><label>Kata sandi</label><input required type="password" name="password" minlength="6" />
            <div class="hint">Minimal 6 karakter.</div></div>
          <div class="field"><label>Saya bergabung sebagai</label>
            <select name="role">
              <option value="both">Klien &amp; Freelancer</option>
              <option value="freelancer">Freelancer</option>
              <option value="client">Klien</option>
            </select>
          </div>
          <button class="btn btn-primary btn-block" type="submit">Daftar</button>
        </form>
        <p class="center muted" style="margin-top:18px">Sudah punya akun? <button class="link-btn" data-go="/login">Masuk</button></p>
      </div>
    </div>`;
    qsa('[data-go]').forEach((el) => el.addEventListener('click', () => go(el.getAttribute('data-go'))));
    qs('#reg-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const { token, user } = await api('/auth/register', { auth: false, method: 'POST', body: Object.fromEntries(fd) });
        setSession(token, user);
        toast(`Akun berhasil dibuat. Selamat datang, ${user.name}!`, 'success');
        go('/profile/' + user.id);
      } catch (err) { toast(err.error || 'Gagal mendaftar.', 'error'); }
    });
  });

  /* ============================== View: Feed (social) ============================== */
  route('/feed', async () => {
    const main = qs('#app-main');
    main.innerHTML = `<div class="container" style="max-width:640px">
      <h2>Feed</h2>
      ${state.user ? `
        <div class="card" style="padding:16px;margin-bottom:20px">
          <textarea id="post-text" placeholder="Bagikan progres kerja, pencapaian, atau tips untuk komunitas..." maxlength="1000"></textarea>
          <div style="display:flex;justify-content:flex-end;margin-top:10px">
            <button class="btn btn-primary" id="post-submit">Bagikan</button>
          </div>
        </div>` : `<div class="card" style="padding:16px;margin-bottom:20px" class="center"><a data-go="/login" style="cursor:pointer" class="link-btn">Masuk</a> untuk ikut berbagi cerita.</div>`}
      <div id="post-list">${skeletonCards(3)}</div>
    </div>`;
    qsa('[data-go]', main).forEach((el) => el.addEventListener('click', () => go(el.getAttribute('data-go'))));
    if (state.user) {
      qs('#post-submit').addEventListener('click', async () => {
        const text = qs('#post-text').value.trim();
        if (!text) return toast('Tulis sesuatu dulu.', 'error');
        try {
          await api('/posts', { method: 'POST', body: { text } });
          qs('#post-text').value = '';
          loadFeed();
        } catch (err) { toast(err.error || 'Gagal memposting.', 'error'); }
      });
    }
    loadFeed();
  });

  async function loadFeed() {
    const { posts } = await api('/posts', { auth: !!state.token });
    const list = qs('#post-list');
    if (!list) return;
    if (!posts.length) { list.innerHTML = `<div class="empty"><div class="big">💬</div><p>Belum ada postingan. Jadilah yang pertama berbagi!</p></div>`; return; }
    list.innerHTML = posts.map((p) => `
      <div class="post">
        <div class="post-head">${avatar(p.author)}
          <div><div class="post-name">${esc(p.author ? p.author.name : '(pengguna dihapus)')}</div>
          <div class="post-time">${timeAgo(p.createdAt)}</div></div>
        </div>
        <div>${nl2br(p.text)}</div>
        <div class="post-actions">
          <button class="like-btn ${p.likedByMe ? 'liked' : ''}" data-like="${p.id}">${p.likedByMe ? '♥' : '♡'} ${p.likeCount || ''}</button>
        </div>
      </div>
    `).join('');
    qsa('[data-like]', list).forEach((el) => el.addEventListener('click', async () => {
      if (!requireLogin()) return;
      await api(`/posts/${el.getAttribute('data-like')}/like`, { method: 'POST' });
      loadFeed();
    }));
  }

  /* ============================== View: Gig detail ============================== */
  route('/gig/:id', async (params) => {
    const main = qs('#app-main');
    main.innerHTML = `<div class="container">${skeletonCards(1)}</div>`;
    const { gig, reviews } = await api(`/gigs/${params.id}`, { auth: false });
    const isOwner = state.user && state.user.id === gig.ownerId;
    main.innerHTML = `<div class="container" style="max-width:820px">
      <div style="height:8px;border-radius:8px;background:${categoryColor(gig.category)};margin-bottom:18px"></div>
      <div class="gig-card-cat">${esc(gig.category)}</div>
      <h1>${esc(gig.title)}</h1>
      <div class="gig-card-seller" style="margin-bottom:18px">${avatar(gig.seller)}
        <div><b data-go="/profile/${gig.ownerId}" style="cursor:pointer">${esc(gig.seller ? gig.seller.name : '')}</b>
        <div class="muted" style="font-size:.82rem">${esc(gig.seller ? gig.seller.title : '')}</div></div>
      </div>
      <p style="white-space:pre-wrap">${nl2br(gig.description)}</p>
      <div class="card" style="padding:20px;margin:22px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span class="muted">Harga paket</span><span class="price">${rupiah(gig.price)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <span class="muted">Estimasi pengerjaan</span><span>${gig.deliveryDays} hari</span>
        </div>
        ${isOwner
          ? `<button class="btn btn-outline btn-block" data-go="/gig/${gig.id}/edit">Kelola Gig Ini</button>`
          : `<button class="btn btn-accent btn-block" id="order-btn">Pesan Sekarang</button>
             <div class="hint" style="margin-top:8px">Dana Anda akan ditahan aman oleh platform (escrow) sampai pekerjaan disetujui.</div>`}
      </div>
      <h3>Ulasan (${reviews.length})</h3>
      <div id="reviews-list">${reviews.length ? reviews.map(reviewItem).join('') : '<p class="muted">Belum ada ulasan untuk gig ini.</p>'}</div>
    </div>`;
    qsa('[data-go]', main).forEach((el) => el.addEventListener('click', () => go(el.getAttribute('data-go'))));
    const orderBtn = qs('#order-btn');
    if (orderBtn) orderBtn.addEventListener('click', () => openOrderModal(gig));
  });

  function reviewItem(r) {
    return `<div style="padding:12px 0;border-bottom:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between"><b>${esc(r.buyerName)}</b>${stars(r.rating)}</div>
      <p class="muted" style="margin-top:4px">${esc(r.comment || '(tanpa komentar)')}</p>
    </div>`;
  }

  function openOrderModal(gig) {
    if (!requireLogin()) return;
    const requirements = prompt('Jelaskan kebutuhan proyek Anda untuk freelancer (opsional):', '') || '';
    (async () => {
      try {
        const { order } = await api('/orders', { method: 'POST', body: { gigId: gig.id, requirements } });
        toast('Pesanan dibuat! Lanjutkan ke pembayaran escrow.', 'success');
        go('/orders/' + order.id);
      } catch (err) { toast(err.error || 'Gagal membuat pesanan.', 'error'); }
    })();
  }

  /* ============================== View: Create / Edit Gig ============================== */
  route('/gig/new', async () => {
    if (!requireLogin()) return;
    renderGigForm(null);
  });
  route('/gig/:id/edit', async (params) => {
    if (!requireLogin()) return;
    const { gig } = await api(`/gigs/${params.id}`, { auth: false });
    if (gig.ownerId !== state.user.id) { toast('Bukan gig milik Anda.', 'error'); return go('/'); }
    renderGigForm(gig);
  });

  async function renderGigForm(gig) {
    const { categories } = await api('/gigs/categories', { auth: false });
    const main = qs('#app-main');
    main.innerHTML = `<div class="container" style="max-width:560px;padding-bottom:60px">
      <h2>${gig ? 'Kelola Gig' : 'Buat Gig Baru'}</h2>
      <form id="gig-form" class="form-card" style="max-width:none">
        <div class="field"><label>Judul gig</label><input required name="title" value="${esc(gig ? gig.title : '')}" placeholder="mis. Saya akan mendesain logo profesional" /></div>
        <div class="field"><label>Kategori</label><select name="category">${categories.map((c) => `<option ${gig && gig.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label>Deskripsi</label><textarea required name="description" rows="6">${esc(gig ? gig.description : '')}</textarea></div>
        <div class="field"><label>Harga (Rp)</label><input required type="number" min="1" name="price" value="${gig ? gig.price : ''}" /></div>
        <div class="field"><label>Estimasi pengerjaan (hari)</label><input required type="number" min="1" name="deliveryDays" value="${gig ? gig.deliveryDays : 3}" /></div>
        <button class="btn btn-primary btn-block" type="submit">${gig ? 'Simpan Perubahan' : 'Publikasikan Gig'}</button>
        ${gig ? `<button type="button" class="btn btn-danger btn-block" id="del-gig" style="margin-top:10px">Hapus Gig</button>` : ''}
      </form>
    </div>`;
    qs('#gig-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target));
      try {
        if (gig) { await api(`/gigs/${gig.id}`, { method: 'PUT', body }); toast('Gig diperbarui.', 'success'); go(`/gig/${gig.id}`); }
        else { const { gig: created } = await api('/gigs', { method: 'POST', body }); toast('Gig dipublikasikan!', 'success'); go(`/gig/${created.id}`); }
      } catch (err) { toast(err.error || 'Gagal menyimpan gig.', 'error'); }
    });
    const delBtn = qs('#del-gig');
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (!confirm('Hapus gig ini? Tindakan tidak bisa dibatalkan.')) return;
      try { await api(`/gigs/${gig.id}`, { method: 'DELETE' }); toast('Gig dihapus.'); go(`/profile/${state.user.id}`); }
      catch (err) { toast(err.error || 'Gagal menghapus gig.', 'error'); }
    });
  }

  /* ============================== View: Profile ============================== */
  route('/profile/:id', async (params) => {
    const main = qs('#app-main');
    main.innerHTML = `<div class="container">${skeletonCards(1)}</div>`;
    const { profile } = await api(`/profiles/${params.id}`, { auth: false });
    const { gigs } = await api(`/gigs/user/${params.id}`, { auth: false });
    const { reviews } = await api(`/reviews/seller/${params.id}`, { auth: false });
    const isMe = state.user && state.user.id === params.id;

    main.innerHTML = `<div class="container" style="max-width:900px">
      <div class="profile-head">
        ${avatar(profile, 'avatar-lg')}
        <div style="flex:1;min-width:220px">
          <h1 style="margin-bottom:2px">${esc(profile.name)}</h1>
          <p class="muted" style="margin-bottom:6px">${esc(profile.title || 'Belum menambahkan judul profesi')}</p>
          <div>${profile.reviewCount ? stars(profile.rating) + ` ${profile.rating} (${profile.reviewCount} ulasan)` : '<span class="muted">Belum ada ulasan</span>'} · ${profile.gigCount} gig aktif</div>
        </div>
        ${isMe ? `<button class="btn btn-outline" id="edit-profile-btn">Edit Profil</button>` : ''}
      </div>
      <p style="max-width:70ch">${nl2br(profile.bio || (isMe ? 'Ceritakan tentang dirimu dan keahlianmu — klien akan lebih percaya dengan profil yang lengkap.' : 'Belum ada bio.'))}</p>
      <div class="chip-row" style="margin:14px 0 26px">${(profile.skills || []).map((s) => `<span class="chip">${esc(s)}</span>`).join('') || (isMe ? '<span class="muted">Belum ada keahlian ditambahkan.</span>' : '')}</div>

      <div class="tabs" id="profile-tabs">
        <div class="tab active" data-tab="gigs">Gig (${gigs.length})</div>
        <div class="tab" data-tab="portfolio">Portofolio (${(profile.portfolio || []).length})</div>
        <div class="tab" data-tab="certs">Sertifikasi (${(profile.certifications || []).length})</div>
        <div class="tab" data-tab="reviews">Ulasan (${reviews.length})</div>
      </div>
      <div id="tab-gigs" class="grid grid-3">${gigs.length ? gigs.map(gigCard).join('') : `<div class="empty" style="grid-column:1/-1"><p>${isMe ? 'Anda belum membuat gig.' : 'Belum ada gig aktif.'}</p>${isMe ? `<button class="btn btn-accent" data-go="/gig/new">Buat Gig Pertama</button>` : ''}</div>`}</div>
      <div id="tab-portfolio" class="hidden">
        ${isMe ? `<button class="btn btn-outline btn-sm" id="add-portfolio-btn" style="margin-bottom:16px">+ Tambah Karya</button>` : ''}
        <div class="grid grid-3" id="portfolio-grid">${portfolioGrid(profile.portfolio, isMe)}</div>
      </div>
      <div id="tab-certs" class="hidden">
        ${isMe ? `<button class="btn btn-outline btn-sm" id="add-cert-btn" style="margin-bottom:16px">+ Tambah Sertifikasi</button>` : ''}
        <div id="cert-list">${certList(profile.certifications, isMe)}</div>
      </div>
      <div id="tab-reviews" class="hidden">${reviews.length ? reviews.map((r) => `
        <div style="padding:12px 0;border-bottom:1px solid var(--line)">
          <div style="display:flex;justify-content:space-between"><b>${esc(r.buyerName)}</b>${stars(r.rating)}</div>
          <div class="muted" style="font-size:.82rem">${esc(r.gigTitle)} · ${timeAgo(r.createdAt)}</div>
          <p style="margin-top:4px">${esc(r.comment || '')}</p>
        </div>`).join('') : '<p class="muted">Belum ada ulasan.</p>'}</div>
    </div>`;

    qsa('.gig-card', main).forEach((el) => el.addEventListener('click', () => go(`/gig/${el.getAttribute('data-id')}`)));
    qsa('[data-go]', main).forEach((el) => el.addEventListener('click', () => go(el.getAttribute('data-go'))));
    qsa('.tab', main).forEach((tab) => tab.addEventListener('click', () => {
      qsa('.tab', main).forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      ['gigs', 'portfolio', 'certs', 'reviews'].forEach((k) => qs('#tab-' + k).classList.toggle('hidden', k !== tab.getAttribute('data-tab')));
    }));

    if (isMe) {
      qs('#edit-profile-btn').addEventListener('click', () => openEditProfileModal(profile));
      qs('#add-portfolio-btn').addEventListener('click', () => openAddPortfolioModal());
      qs('#add-cert-btn').addEventListener('click', () => openAddCertModal());
      bindPortfolioDelete(main);
      bindCertDelete(main);
    }
  });

  function portfolioGrid(items, isMe) {
    if (!items || !items.length) return `<div class="empty" style="grid-column:1/-1"><div class="big">🖼️</div><p>${isMe ? 'Tambahkan karya terbaikmu agar klien lebih yakin.' : 'Belum ada portofolio.'}</p></div>`;
    return items.map((p) => `
      <div class="portfolio-item">
        ${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.title)}" />` : `<div class="skeleton" style="height:140px;margin-bottom:10px"></div>`}
        <b>${esc(p.title)}</b>
        <p class="muted" style="font-size:.85rem;margin:6px 0">${esc(p.description)}</p>
        ${p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener" class="link-btn">Lihat karya ↗</a>` : ''}
        ${isMe ? `<button class="btn btn-ghost btn-sm" data-del-port="${p.id}" style="margin-top:6px">Hapus</button>` : ''}
      </div>`).join('');
  }
  function certList(items, isMe) {
    if (!items || !items.length) return `<p class="muted">${isMe ? 'Tambahkan sertifikasi untuk memperkuat kredibilitas.' : 'Belum ada sertifikasi.'}</p>`;
    return items.map((c) => `<div class="card" style="padding:14px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
      <div><b>${esc(c.title)}</b><div class="muted" style="font-size:.85rem">${esc(c.issuer)}${c.year ? ' · ' + esc(c.year) : ''}</div></div>
      ${isMe ? `<button class="btn btn-ghost btn-sm" data-del-cert="${c.id}">Hapus</button>` : ''}
    </div>`).join('');
  }
  function bindPortfolioDelete(root) {
    qsa('[data-del-port]', root).forEach((el) => el.addEventListener('click', async () => {
      await api(`/profiles/me/portfolio/${el.getAttribute('data-del-port')}`, { method: 'DELETE' });
      go('/profile/' + state.user.id); render();
    }));
  }
  function bindCertDelete(root) {
    qsa('[data-del-cert]', root).forEach((el) => el.addEventListener('click', async () => {
      await api(`/profiles/me/certifications/${el.getAttribute('data-del-cert')}`, { method: 'DELETE' });
      go('/profile/' + state.user.id); render();
    }));
  }

  function openEditProfileModal(profile) {
    const name = prompt('Nama tampilan:', profile.name); if (name === null) return;
    const title = prompt('Judul profesi (mis. UI/UX Designer):', profile.title || ''); if (title === null) return;
    const bio = prompt('Bio singkat:', profile.bio || ''); if (bio === null) return;
    const skillsStr = prompt('Keahlian, pisahkan dengan koma:', (profile.skills || []).join(', ')); if (skillsStr === null) return;
    const skills = skillsStr.split(',').map((s) => s.trim()).filter(Boolean);
    api('/profiles/me', { method: 'PUT', body: { name, title, bio, skills } })
      .then(({ user }) => { state.user = { ...state.user, ...user }; toast('Profil diperbarui.', 'success'); render(); })
      .catch((err) => toast(err.error || 'Gagal memperbarui profil.', 'error'));
  }
  function openAddPortfolioModal() {
    const title = prompt('Judul karya:'); if (!title) return;
    const description = prompt('Deskripsi singkat:', '') || '';
    const link = prompt('Tautan karya (opsional):', '') || '';
    const imageUrl = prompt('URL gambar (opsional):', '') || '';
    api('/profiles/me/portfolio', { method: 'POST', body: { title, description, link, imageUrl } })
      .then(() => { toast('Karya ditambahkan.', 'success'); render(); })
      .catch((err) => toast(err.error || 'Gagal menambahkan karya.', 'error'));
  }
  function openAddCertModal() {
    const title = prompt('Nama sertifikasi:'); if (!title) return;
    const issuer = prompt('Diterbitkan oleh:', '') || '';
    const year = prompt('Tahun:', '') || '';
    api('/profiles/me/certifications', { method: 'POST', body: { title, issuer, year } })
      .then(() => { toast('Sertifikasi ditambahkan.', 'success'); render(); })
      .catch((err) => toast(err.error || 'Gagal menambahkan sertifikasi.', 'error'));
  }

  /* ============================== View: Orders list ============================== */
  route('/orders', async (params, query) => {
    if (!requireLogin()) return;
    const roleFilter = query.role || '';
    const main = qs('#app-main');
    main.innerHTML = `<div class="container" style="max-width:820px">
      <h2>Pesanan Saya</h2>
      <div class="tabs">
        <div class="tab ${!roleFilter ? 'active' : ''}" data-go="/orders">Semua</div>
        <div class="tab ${roleFilter === 'buyer' ? 'active' : ''}" data-go="/orders?role=buyer">Sebagai Klien</div>
        <div class="tab ${roleFilter === 'seller' ? 'active' : ''}" data-go="/orders?role=seller">Sebagai Freelancer</div>
      </div>
      <div id="order-list">${skeletonCards(3)}</div>
    </div>`;
    qsa('[data-go]', main).forEach((el) => el.addEventListener('click', () => go(el.getAttribute('data-go'))));
    const { orders } = await api('/orders' + (roleFilter ? `?role=${roleFilter}` : ''));
    const list = qs('#order-list');
    if (!orders.length) { list.innerHTML = `<div class="empty"><div class="big">🧾</div><p>Belum ada pesanan.</p><button class="btn btn-accent" data-go="/">Jelajahi Gig</button></div>`; qsa('[data-go]', list).forEach((el) => el.addEventListener('click', () => go(el.getAttribute('data-go')))); return; }
    list.innerHTML = orders.map((o) => {
      const iAmBuyer = o.buyerId === state.user.id;
      return `<div class="order-row" data-id="${o.id}">
        <div class="order-row-main">
          <div class="gig-card-title">${esc(o.gigTitle)}</div>
          <div class="muted" style="font-size:.85rem">${iAmBuyer ? 'Freelancer: ' + esc(o.sellerName) : 'Klien: ' + esc(o.buyerName)} · ${timeAgo(o.createdAt)}</div>
        </div>
        <div class="price">${rupiah(o.amount)}</div>
        <span class="badge badge-status-${o.status}">${statusLabel(o.status)}</span>
      </div>`;
    }).join('');
    qsa('.order-row', list).forEach((el) => el.addEventListener('click', () => go('/orders/' + el.getAttribute('data-id'))));
  });

  function statusLabel(s) {
    return {
      awaiting_payment: 'Menunggu Pembayaran', in_escrow: 'Dana di Escrow', delivered: 'Hasil Dikirim',
      completed: 'Selesai', disputed: 'Sengketa', cancelled: 'Dibatalkan',
    }[s] || s;
  }

  /* ============================== View: Order detail ============================== */
  route('/orders/:id', async (params) => {
    if (!requireLogin()) return;
    const main = qs('#app-main');
    main.innerHTML = `<div class="container">${skeletonCards(1)}</div>`;
    const { order } = await api(`/orders/${params.id}`);
    const iAmBuyer = order.buyerId === state.user.id;
    const steps = ['awaiting_payment', 'in_escrow', 'delivered', 'completed'];
    const curIdx = steps.indexOf(order.status);
    const isTerminalOdd = ['disputed', 'cancelled'].includes(order.status);

    main.innerHTML = `<div class="container" style="max-width:760px">
      <button class="btn btn-ghost btn-sm" data-go="/orders" style="margin-bottom:8px">← Semua Pesanan</button>
      <div class="section-head"><h2 style="margin:0">${esc(order.gigTitle)}</h2><span class="badge badge-status-${order.status}">${statusLabel(order.status)}</span></div>
      <p class="muted">${iAmBuyer ? 'Freelancer' : 'Klien'}: <b>${esc(iAmBuyer ? order.sellerName : order.buyerName)}</b> · Nilai pesanan: <b>${rupiah(order.amount)}</b> · Tenggat: ${new Date(order.dueAt).toLocaleDateString('id-ID')}</p>

      ${isTerminalOdd ? '' : `<div class="stepper">
        ${['Dipesan', 'Dana Ditahan (Escrow)', 'Hasil Dikirim', 'Selesai'].map((label, i) => `
          <div class="step ${i < curIdx ? 'done' : ''} ${i === curIdx ? 'current' : ''}">
            <div class="dot">${i < curIdx ? '✓' : i + 1}</div><small>${label}</small>
          </div>`).join('')}
      </div>`}

      ${order.requirements ? `<div class="card" style="padding:14px 16px;margin-bottom:16px"><b>Kebutuhan dari klien</b><p style="margin-top:6px">${nl2br(order.requirements)}</p></div>` : ''}
      ${order.deliveryNote ? `<div class="card" style="padding:14px 16px;margin-bottom:16px"><b>Catatan pengiriman freelancer</b><p style="margin-top:6px">${nl2br(order.deliveryNote)}</p></div>` : ''}
      ${order.disputeReason ? `<div class="escrow-note" style="background:#F2DAD6;color:var(--danger)"><b>⚠</b> Sengketa diajukan: ${esc(order.disputeReason)}. Dana tetap tertahan aman di escrow sampai ditinjau tim platform.</div>` : ''}

      <div id="order-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin:18px 0"></div>

      <h3>Pesan &amp; Negosiasi</h3>
      <div class="card" style="padding:16px">
        <div id="chat-box" class="chat-box"></div>
        <div class="chat-input-row">
          <textarea id="chat-input" placeholder="Tulis pesan..."></textarea>
          <button class="btn btn-primary" id="chat-send">Kirim</button>
        </div>
      </div>

      ${order.status === 'completed' ? `<div id="review-area" style="margin-top:24px"></div>` : ''}
    </div>`;

    qsa('[data-go]', main).forEach((el) => el.addEventListener('click', () => go(el.getAttribute('data-go'))));
    renderOrderActions(order, iAmBuyer);
    loadChat(order.id);
    qs('#chat-send').addEventListener('click', () => sendChat(order.id));
    qs('#chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(order.id); } });

    if (order.status === 'completed' && iAmBuyer) {
      const { reviews } = await api(`/reviews/seller/${order.sellerId}`, { auth: false });
      const already = reviews.find((r) => r.orderId === order.id);
      qs('#review-area').innerHTML = already
        ? `<div class="card" style="padding:16px"><b>Ulasan Anda:</b> ${stars(already.rating)}<p style="margin-top:6px">${esc(already.comment)}</p></div>`
        : `<div class="card" style="padding:16px">
            <h3 style="margin-top:0">Beri Ulasan</h3>
            <div class="field"><label>Rating</label><select id="rev-rating"><option value="5">★★★★★ Sangat puas</option><option value="4">★★★★☆ Puas</option><option value="3">★★★☆☆ Cukup</option><option value="2">★★☆☆☆ Kurang</option><option value="1">★☆☆☆☆ Tidak puas</option></select></div>
            <div class="field"><label>Komentar</label><textarea id="rev-comment" placeholder="Ceritakan pengalaman kerja sama Anda"></textarea></div>
            <button class="btn btn-accent" id="rev-submit">Kirim Ulasan</button>
          </div>`;
      const revBtn = qs('#rev-submit');
      if (revBtn) revBtn.addEventListener('click', async () => {
        try {
          await api(`/reviews/order/${order.id}`, { method: 'POST', body: { rating: Number(qs('#rev-rating').value), comment: qs('#rev-comment').value } });
          toast('Terima kasih atas ulasannya!', 'success'); render();
        } catch (err) { toast(err.error || 'Gagal mengirim ulasan.', 'error'); }
      });
    }
  });

  function renderOrderActions(order, iAmBuyer) {
    const box = qs('#order-actions');
    const actions = [];
    if (order.status === 'awaiting_payment' && iAmBuyer) {
      actions.push(['btn-primary', 'Bayar & Tahan di Escrow', 'pay']);
      actions.push(['btn-danger', 'Batalkan Pesanan', 'cancel']);
    }
    if (order.status === 'in_escrow' && !iAmBuyer) actions.push(['btn-primary', 'Kirim Hasil Pekerjaan', 'deliver']);
    if (order.status === 'delivered' && iAmBuyer) {
      actions.push(['btn-accent', 'Setujui & Cairkan Dana', 'release']);
      actions.push(['btn-outline', 'Minta Revisi', 'request-revision']);
    }
    if (['in_escrow', 'delivered'].includes(order.status)) actions.push(['btn-danger', 'Ajukan Sengketa', 'dispute']);
    if (!actions.length) { box.innerHTML = ''; return; }
    box.innerHTML = actions.map(([cls, label, action]) => `<button class="btn ${cls}" data-action="${action}">${label}</button>`).join('');
    qsa('[data-action]', box).forEach((btn) => btn.addEventListener('click', () => handleOrderAction(order.id, btn.getAttribute('data-action'))));
  }

  async function handleOrderAction(orderId, action) {
    let body = {};
    if (action === 'deliver') { body.note = prompt('Catatan pengiriman hasil (link file, ringkasan, dll):', '') || ''; }
    if (action === 'dispute') { const reason = prompt('Jelaskan alasan sengketa:'); if (!reason) return; body.reason = reason; }
    if (action === 'cancel' && !confirm('Batalkan pesanan ini?')) return;
    if (action === 'release' && !confirm('Setujui hasil dan cairkan dana ke freelancer? Tindakan ini final.')) return;
    try {
      const { note } = await api(`/orders/${orderId}/${action}`, { method: 'POST', body });
      if (note) toast(note, 'success'); else toast('Berhasil diperbarui.', 'success');
      render();
    } catch (err) { toast(err.error || 'Gagal memproses aksi.', 'error'); }
  }

  async function loadChat(orderId) {
    const { messages } = await api(`/messages/order/${orderId}`);
    const box = qs('#chat-box');
    if (!box) return;
    box.innerHTML = messages.length ? messages.map((m) => `
      <div class="msg ${m.senderId === state.user.id ? 'me' : 'them'}">
        <span class="sender">${esc(m.senderName)} · ${timeAgo(m.createdAt)}</span>${nl2br(m.text)}
      </div>`).join('') : '<p class="muted center">Belum ada pesan. Mulai percakapan dengan lawan transaksi Anda.</p>';
    box.scrollTop = box.scrollHeight;
  }
  async function sendChat(orderId) {
    const input = qs('#chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try { await api(`/messages/order/${orderId}`, { method: 'POST', body: { text } }); loadChat(orderId); }
    catch (err) { toast(err.error || 'Gagal mengirim pesan.', 'error'); }
  }

  /* ============================== Boot ============================== */
  window.addEventListener('hashchange', render);
  (async function boot() {
    await loadMe();
    render();
  })();
})();
