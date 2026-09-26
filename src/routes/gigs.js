const express = require('express');
const db = require('../db');
const { newId, averageRating } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function withSeller(gig) {
  const seller = db.users.findById(gig.ownerId);
  const reviews = db.reviews.find((r) => r.gigId === gig.id);
  const { average, count } = averageRating(reviews);
  return {
    ...gig,
    rating: average,
    reviewCount: count,
    seller: seller
      ? { id: seller.id, name: seller.name, title: seller.title, avatarColor: seller.avatarColor }
      : null,
  };
}

// Jelajahi / cari gig
router.get('/', (req, res) => {
  const { q, category, maxPrice, sort } = req.query;
  let gigs = db.gigs.find((g) => g.status === 'active');

  if (q) {
    const term = String(q).toLowerCase();
    gigs = gigs.filter(
      (g) => g.title.toLowerCase().includes(term) || g.description.toLowerCase().includes(term)
    );
  }
  if (category) gigs = gigs.filter((g) => g.category === category);
  if (maxPrice) gigs = gigs.filter((g) => g.price <= Number(maxPrice));

  gigs = gigs.map(withSeller);

  if (sort === 'price_asc') gigs.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') gigs.sort((a, b) => b.price - a.price);
  else if (sort === 'rating') gigs.sort((a, b) => b.rating - a.rating);
  else gigs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ gigs: gigs.slice(0, 100) });
});

router.get('/categories', (req, res) => {
  res.json({
    categories: [
      'Desain Grafis',
      'Pengembangan Web & App',
      'Penulisan & Terjemahan',
      'Digital Marketing',
      'Video & Animasi',
      'Musik & Audio',
      'Bisnis & Konsultasi',
      'Fotografi',
      'Lainnya',
    ],
  });
});

router.get('/:id', (req, res) => {
  const gig = db.gigs.findById(req.params.id);
  if (!gig) return res.status(404).json({ error: 'Gig tidak ditemukan.' });
  const reviews = db.reviews.find((r) => r.gigId === gig.id);
  res.json({ gig: withSeller(gig), reviews });
});

router.post('/', requireAuth, async (req, res) => {
  const { title, description, category, price, deliveryDays, imageUrl, packages } = req.body || {};
  if (!title || !description || !price) {
    return res.status(400).json({ error: 'Judul, deskripsi, dan harga wajib diisi.' });
  }
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    return res.status(400).json({ error: 'Harga harus berupa angka lebih dari 0.' });
  }

  const gig = {
    id: newId('gig'),
    ownerId: req.user.id,
    title: String(title).slice(0, 150),
    description: String(description).slice(0, 3000),
    category: category || 'Lainnya',
    price: priceNum,
    deliveryDays: Number(deliveryDays) > 0 ? Number(deliveryDays) : 3,
    imageUrl: imageUrl ? String(imageUrl).slice(0, 500) : '',
    // Paket opsional (mis. Basic/Standard/Premium) - sederhana, tiap paket punya nama, harga, deskripsi
    packages: Array.isArray(packages) ? packages.slice(0, 3) : [],
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  await db.gigs.insert(gig);
  res.status(201).json({ gig: withSeller(gig) });
});

router.put('/:id', requireAuth, async (req, res) => {
  const gig = db.gigs.findById(req.params.id);
  if (!gig) return res.status(404).json({ error: 'Gig tidak ditemukan.' });
  if (gig.ownerId !== req.user.id) return res.status(403).json({ error: 'Bukan gig milik Anda.' });

  const { title, description, category, price, deliveryDays, imageUrl, status } = req.body || {};
  const patch = {};
  if (title) patch.title = String(title).slice(0, 150);
  if (description) patch.description = String(description).slice(0, 3000);
  if (category) patch.category = category;
  if (price) patch.price = Number(price);
  if (deliveryDays) patch.deliveryDays = Number(deliveryDays);
  if (imageUrl !== undefined) patch.imageUrl = String(imageUrl).slice(0, 500);
  if (['active', 'paused'].includes(status)) patch.status = status;

  const updated = await db.gigs.updateById(req.params.id, patch);
  res.json({ gig: withSeller(updated) });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const gig = db.gigs.findById(req.params.id);
  if (!gig) return res.status(404).json({ error: 'Gig tidak ditemukan.' });
  if (gig.ownerId !== req.user.id) return res.status(403).json({ error: 'Bukan gig milik Anda.' });

  const activeOrders = db.orders.find(
    (o) => o.gigId === gig.id && !['completed', 'cancelled', 'disputed'].includes(o.status)
  );
  if (activeOrders.length) {
    return res.status(409).json({ error: 'Tidak bisa menghapus gig dengan pesanan yang masih berjalan.' });
  }
  await db.gigs.deleteById(req.params.id);
  res.json({ success: true });
});

router.get('/user/:userId', (req, res) => {
  const gigs = db.gigs.find((g) => g.ownerId === req.params.userId && g.status === 'active');
  res.json({ gigs: gigs.map(withSeller) });
});

module.exports = router;
