const express = require('express');
const db = require('../db');
const { newId } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 0.1);

function serialize(order) {
  const gig = db.gigs.findById(order.gigId);
  const buyer = db.users.findById(order.buyerId);
  const seller = db.users.findById(order.sellerId);
  return {
    ...order,
    gigTitle: gig ? gig.title : '(gig telah dihapus)',
    buyerName: buyer ? buyer.name : '(pengguna dihapus)',
    sellerName: seller ? seller.name : '(pengguna dihapus)',
  };
}

function assertParticipant(req, res, order) {
  if (order.buyerId !== req.user.id && order.sellerId !== req.user.id) {
    res.status(403).json({ error: 'Anda bukan bagian dari pesanan ini.' });
    return false;
  }
  return true;
}

// Buat pesanan baru terhadap sebuah gig (dana BELUM ditahan sampai /pay dipanggil)
router.post('/', requireAuth, async (req, res) => {
  const { gigId, requirements } = req.body || {};
  const gig = db.gigs.findById(gigId);
  if (!gig || gig.status !== 'active') {
    return res.status(404).json({ error: 'Gig tidak ditemukan atau sudah tidak aktif.' });
  }
  if (gig.ownerId === req.user.id) {
    return res.status(400).json({ error: 'Anda tidak bisa memesan gig milik sendiri.' });
  }

  const order = {
    id: newId('ord'),
    gigId: gig.id,
    buyerId: req.user.id,
    sellerId: gig.ownerId,
    amount: gig.price,
    escrowAmount: 0,
    status: 'awaiting_payment', // awaiting_payment -> in_escrow -> delivered -> completed | disputed | cancelled
    requirements: String(requirements || '').slice(0, 2000),
    deliveryNote: '',
    dueAt: new Date(Date.now() + gig.deliveryDays * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    paidAt: null,
    deliveredAt: null,
    completedAt: null,
  };
  await db.orders.insert(order);
  res.status(201).json({ order: serialize(order) });
});

// Simulasi pembayaran: dana ditahan platform (escrow)
// INTEGRASI PEMBAYARAN: ganti blok ini dengan pemanggilan payment gateway sungguhan
// (mis. Midtrans/Xendit). Setelah gateway mengonfirmasi pembayaran berhasil (via webhook),
// baru ubah status order menjadi 'in_escrow'. Jangan percayai konfirmasi dari sisi klien saja.
router.post('/:id/pay', requireAuth, async (req, res) => {
  const order = db.orders.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Hanya pembeli yang bisa membayar.' });
  if (order.status !== 'awaiting_payment') {
    return res.status(409).json({ error: 'Pesanan ini tidak sedang menunggu pembayaran.' });
  }

  const updated = await db.orders.updateById(order.id, {
    status: 'in_escrow',
    escrowAmount: order.amount,
    paidAt: new Date().toISOString(),
  });
  res.json({ order: serialize(updated), note: 'Dana ditahan aman oleh platform (escrow) sampai pekerjaan selesai.' });
});

// Freelancer mengirim hasil pekerjaan
router.post('/:id/deliver', requireAuth, async (req, res) => {
  const order = db.orders.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  if (order.sellerId !== req.user.id) return res.status(403).json({ error: 'Hanya freelancer yang bisa mengirim hasil.' });
  if (order.status !== 'in_escrow') {
    return res.status(409).json({ error: 'Pesanan belum dibayar atau sudah selesai.' });
  }

  const { note } = req.body || {};
  const updated = await db.orders.updateById(order.id, {
    status: 'delivered',
    deliveryNote: String(note || '').slice(0, 2000),
    deliveredAt: new Date().toISOString(),
  });
  res.json({ order: serialize(updated) });
});

// Pembeli meminta revisi -> kembali ke status in_escrow (masih dikerjakan)
router.post('/:id/request-revision', requireAuth, async (req, res) => {
  const order = db.orders.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Hanya pembeli yang bisa meminta revisi.' });
  if (order.status !== 'delivered') {
    return res.status(409).json({ error: 'Hasil belum dikirim oleh freelancer.' });
  }
  const updated = await db.orders.updateById(order.id, { status: 'in_escrow' });
  res.json({ order: serialize(updated) });
});

// Pembeli menyetujui hasil -> dana escrow dicairkan ke freelancer (dikurangi komisi platform)
router.post('/:id/release', requireAuth, async (req, res) => {
  const order = db.orders.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Hanya pembeli yang bisa mencairkan dana.' });
  if (order.status !== 'delivered') {
    return res.status(409).json({ error: 'Pesanan belum dikirim oleh freelancer.' });
  }

  const seller = db.users.findById(order.sellerId);
  const fee = Math.round(order.amount * FEE_PERCENT);
  const payout = order.amount - fee;
  if (seller) {
    await db.users.updateById(seller.id, { balance: (seller.balance || 0) + payout });
  }

  const updated = await db.orders.updateById(order.id, {
    status: 'completed',
    escrowAmount: 0,
    platformFee: fee,
    payoutAmount: payout,
    completedAt: new Date().toISOString(),
  });
  res.json({ order: serialize(updated), note: `Dana dicairkan ke freelancer (Rp ${payout.toLocaleString('id-ID')}, komisi platform Rp ${fee.toLocaleString('id-ID')}).` });
});

// Ajukan sengketa (dana tetap tertahan di escrow sampai ditinjau)
router.post('/:id/dispute', requireAuth, async (req, res) => {
  const order = db.orders.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  if (!assertParticipant(req, res, order)) return;
  if (!['in_escrow', 'delivered'].includes(order.status)) {
    return res.status(409).json({ error: 'Sengketa hanya bisa diajukan saat dana masih di escrow.' });
  }
  const { reason } = req.body || {};
  const updated = await db.orders.updateById(order.id, {
    status: 'disputed',
    disputeReason: String(reason || '').slice(0, 1000),
  });
  res.json({ order: serialize(updated), note: 'Dana tetap aman di escrow selama sengketa ditinjau tim platform.' });
});

// Batalkan pesanan sebelum dibayar
router.post('/:id/cancel', requireAuth, async (req, res) => {
  const order = db.orders.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  if (!assertParticipant(req, res, order)) return;
  if (order.status !== 'awaiting_payment') {
    return res.status(409).json({ error: 'Pesanan yang sudah dibayar tidak bisa dibatalkan sendiri, ajukan sengketa jika perlu.' });
  }
  const updated = await db.orders.updateById(order.id, { status: 'cancelled' });
  res.json({ order: serialize(updated) });
});

router.get('/', requireAuth, (req, res) => {
  const role = req.query.role; // 'buyer' | 'seller' | undefined (semua)
  let orders = db.orders.find((o) => o.buyerId === req.user.id || o.sellerId === req.user.id);
  if (role === 'buyer') orders = orders.filter((o) => o.buyerId === req.user.id);
  if (role === 'seller') orders = orders.filter((o) => o.sellerId === req.user.id);
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ orders: orders.map(serialize) });
});

router.get('/:id', requireAuth, (req, res) => {
  const order = db.orders.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  if (!assertParticipant(req, res, order)) return;
  res.json({ order: serialize(order) });
});

module.exports = router;
