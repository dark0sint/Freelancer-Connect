const express = require('express');
const db = require('../db');
const { newId } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Beri ulasan setelah pesanan selesai (hanya pembeli, hanya sekali per pesanan)
router.post('/order/:orderId', requireAuth, async (req, res) => {
  const order = db.orders.findById(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Hanya pembeli yang bisa memberi ulasan.' });
  if (order.status !== 'completed') {
    return res.status(409).json({ error: 'Ulasan hanya bisa diberikan setelah pesanan selesai.' });
  }
  const existing = db.reviews.findOne((r) => r.orderId === order.id);
  if (existing) return res.status(409).json({ error: 'Anda sudah memberi ulasan untuk pesanan ini.' });

  const { rating, comment } = req.body || {};
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'Rating harus berupa angka bulat 1 sampai 5.' });
  }

  const review = {
    id: newId('rev'),
    orderId: order.id,
    gigId: order.gigId,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    rating: ratingNum,
    comment: String(comment || '').slice(0, 1000),
    createdAt: new Date().toISOString(),
  };
  await db.reviews.insert(review);
  const buyer = db.users.findById(order.buyerId);
  res.status(201).json({ review: { ...review, buyerName: buyer ? buyer.name : '' } });
});

router.get('/gig/:gigId', (req, res) => {
  const reviews = db.reviews
    .find((r) => r.gigId === req.params.gigId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((r) => {
      const buyer = db.users.findById(r.buyerId);
      return { ...r, buyerName: buyer ? buyer.name : '(pengguna dihapus)' };
    });
  res.json({ reviews });
});

router.get('/seller/:sellerId', (req, res) => {
  const reviews = db.reviews
    .find((r) => r.sellerId === req.params.sellerId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((r) => {
      const buyer = db.users.findById(r.buyerId);
      const gig = db.gigs.findById(r.gigId);
      return { ...r, buyerName: buyer ? buyer.name : '(pengguna dihapus)', gigTitle: gig ? gig.title : '' };
    });
  res.json({ reviews });
});

module.exports = router;
