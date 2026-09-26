// src/db.js
// Penyimpanan data sederhana berbasis file JSON.
// Dipilih agar aplikasi ini bisa langsung "npm install && npm start" di server mana pun
// tanpa perlu instalasi database eksternal atau modul native (mis. better-sqlite3).
// Untuk skala produksi yang lebih besar, ganti modul ini dengan PostgreSQL/MySQL/MongoDB
// tanpa perlu mengubah kode di src/routes/*.js (interface-nya dibuat mirip).

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const COLLECTIONS = ['users', 'gigs', 'orders', 'reviews', 'messages', 'posts'];

const files = {};
for (const name of COLLECTIONS) {
  files[name] = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(files[name])) fs.writeFileSync(files[name], '[]', 'utf8');
}

function readAll(name) {
  try {
    const raw = fs.readFileSync(files[name], 'utf8');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error(`[db] Gagal membaca koleksi "${name}":`, err.message);
    return [];
  }
}

function writeAll(name, records) {
  // Tulis ke file sementara lalu rename -> menghindari file korup jika proses terhenti mendadak
  const tmp = `${files[name]}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');
  fs.renameSync(tmp, files[name]);
}

// Antrian penulisan sederhana per-koleksi supaya operasi baca-ubah-tulis tidak saling menimpa
const queues = {};
function enqueue(name, fn) {
  const prev = queues[name] || Promise.resolve();
  const next = prev.then(fn, fn);
  queues[name] = next.catch(() => {});
  return next;
}

const collection = (name) => ({
  all() {
    return readAll(name);
  },
  find(predicate) {
    return readAll(name).filter(predicate);
  },
  findOne(predicate) {
    return readAll(name).find(predicate) || null;
  },
  findById(id) {
    return readAll(name).find((r) => r.id === id) || null;
  },
  insert(record) {
    return enqueue(name, () => {
      const all = readAll(name);
      all.push(record);
      writeAll(name, all);
      return record;
    });
  },
  updateById(id, patch) {
    return enqueue(name, () => {
      const all = readAll(name);
      const idx = all.findIndex((r) => r.id === id);
      if (idx === -1) return null;
      all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
      writeAll(name, all);
      return all[idx];
    });
  },
  deleteById(id) {
    return enqueue(name, () => {
      const all = readAll(name);
      const next = all.filter((r) => r.id !== id);
      writeAll(name, next);
      return next.length !== all.length;
    });
  },
});

module.exports = {
  users: collection('users'),
  gigs: collection('gigs'),
  orders: collection('orders'),
  reviews: collection('reviews'),
  messages: collection('messages'),
  posts: collection('posts'),
};
