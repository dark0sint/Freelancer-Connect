const express = require('express');
const db = require('../db');
const { newId } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function assertParticipant(req, res, order) {
  if (!order) {
    res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    return false;
  }
  if (order.buyerId !== req.user.id && order.sellerId !== req.user.id) {
    res.status(403).json({ error: 'Anda bukan bagian dari percakapan ini.' });
    return false;
  }
  return true;
}

router.get('/order/:orderId', requireAuth, (req, res) => {
  const order = db.orders.findById(req.params.orderId);
  if (!assertParticipant(req, res, order)) return;

  const messages = db.messages
    .find((m) => m.orderId === order.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const withSender = messages.map((m) => {
    const sender = db.users.findById(m.senderId);
    return { ...m, senderName: sender ? sender.name : '(pengguna dihapus)' };
  });
  res.json({ messages: withSender });
});

router.post('/order/:orderId', requireAuth, async (req, res) => {
  const order = db.orders.findById(req.params.orderId);
  if (!assertParticipant(req, res, order)) return;

  const { text } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
  }

  const message = {
    id: newId('msg'),
    orderId: order.id,
    senderId: req.user.id,
    text: String(text).slice(0, 2000),
    createdAt: new Date().toISOString(),
  };
  await db.messages.insert(message);
  res.status(201).json({ message: { ...message, senderName: req.user.name } });
});

module.exports = router;
