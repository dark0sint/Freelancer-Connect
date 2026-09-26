require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/auth');
const profileRoutes = require('./src/routes/profiles');
const gigRoutes = require('./src/routes/gigs');
const orderRoutes = require('./src/routes/orders');
const messageRoutes = require('./src/routes/messages');
const reviewRoutes = require('./src/routes/reviews');
const postRoutes = require('./src/routes/posts');

if (!process.env.JWT_SECRET) {
  console.warn(
    '[peringatan] JWT_SECRET belum diset di .env — menggunakan nilai default yang TIDAK aman. ' +
      'Salin .env.example menjadi .env dan ganti JWT_SECRET sebelum digunakan di produksi.'
  );
  process.env.JWT_SECRET = 'dev-only-secret-jangan-dipakai-di-produksi';
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// API
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/gigs', gigRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/posts', postRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Frontend statis (mobile & desktop, satu tampilan responsif)
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 untuk rute API yang tidak dikenal
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
});

// Penanganan error terpusat
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, () => {
  console.log(`Freelancer Connect berjalan di http://localhost:${PORT}`);
});
