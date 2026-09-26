const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { newId, publicUser } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function sign(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nama, email, dan kata sandi wajib diisi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
  }
  const emailNorm = String(email).trim().toLowerCase();
  const existing = db.users.findOne((u) => u.email === emailNorm);
  if (existing) {
    return res.status(409).json({ error: 'Email sudah terdaftar. Silakan login.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: newId('usr'),
    name: name.trim(),
    email: emailNorm,
    passwordHash,
    role: ['freelancer', 'client', 'both'].includes(role) ? role : 'both',
    title: '',
    bio: '',
    skills: [],
    portfolio: [],
    certifications: [],
    avatarColor: `hsl(${Math.floor(Math.random() * 360)}, 55%, 45%)`,
    balance: 0,
    createdAt: new Date().toISOString(),
  };
  await db.users.insert(user);

  const token = sign(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
  }
  const emailNorm = String(email).trim().toLowerCase();
  const user = db.users.findOne((u) => u.email === emailNorm);
  if (!user) return res.status(401).json({ error: 'Email atau kata sandi salah.' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Email atau kata sandi salah.' });

  const token = sign(user);
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
