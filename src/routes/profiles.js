const express = require('express');
const db = require('../db');
const { newId, publicUser, averageRating } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function profileWithStats(user) {
  const gigs = db.gigs.find((g) => g.ownerId === user.id && g.status === 'active');
  const reviews = db.reviews.find((r) => r.sellerId === user.id);
  const { average, count } = averageRating(reviews);
  const safe = publicUser(user);
  delete safe.email; // email tidak ditampilkan di profil publik
  delete safe.balance;
  return { ...safe, gigCount: gigs.length, rating: average, reviewCount: count };
}

// Cari freelancer berdasarkan nama/keahlian
router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  let users = db.users.all();
  if (q) {
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.title.toLowerCase().includes(q) ||
        (u.skills || []).some((s) => s.toLowerCase().includes(q))
    );
  }
  res.json({ profiles: users.slice(0, 50).map(profileWithStats) });
});

router.get('/:id', (req, res) => {
  const user = db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Profil tidak ditemukan.' });
  res.json({ profile: profileWithStats(user) });
});

router.put('/me', requireAuth, async (req, res) => {
  const { name, title, bio, skills, role } = req.body || {};
  const patch = {};
  if (typeof name === 'string' && name.trim()) patch.name = name.trim();
  if (typeof title === 'string') patch.title = title.slice(0, 120);
  if (typeof bio === 'string') patch.bio = bio.slice(0, 2000);
  if (Array.isArray(skills)) patch.skills = skills.map(String).slice(0, 30);
  if (['freelancer', 'client', 'both'].includes(role)) patch.role = role;

  const updated = await db.users.updateById(req.user.id, patch);
  res.json({ user: publicUser(updated) });
});

// --- Portofolio ---
router.post('/me/portfolio', requireAuth, async (req, res) => {
  const { title, description, link, imageUrl, tags } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Judul karya wajib diisi.' });
  const item = {
    id: newId('port'),
    title: String(title).slice(0, 150),
    description: String(description || '').slice(0, 1000),
    link: link ? String(link).slice(0, 500) : '',
    imageUrl: imageUrl ? String(imageUrl).slice(0, 500) : '',
    tags: Array.isArray(tags) ? tags.map(String).slice(0, 10) : [],
    createdAt: new Date().toISOString(),
  };
  const portfolio = [...(req.user.portfolio || []), item];
  const updated = await db.users.updateById(req.user.id, { portfolio });
  res.status(201).json({ user: publicUser(updated) });
});

router.delete('/me/portfolio/:itemId', requireAuth, async (req, res) => {
  const portfolio = (req.user.portfolio || []).filter((p) => p.id !== req.params.itemId);
  const updated = await db.users.updateById(req.user.id, { portfolio });
  res.json({ user: publicUser(updated) });
});

// --- Sertifikasi ---
router.post('/me/certifications', requireAuth, async (req, res) => {
  const { title, issuer, year, link } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Nama sertifikasi wajib diisi.' });
  const item = {
    id: newId('cert'),
    title: String(title).slice(0, 150),
    issuer: String(issuer || '').slice(0, 150),
    year: year ? String(year).slice(0, 4) : '',
    link: link ? String(link).slice(0, 500) : '',
  };
  const certifications = [...(req.user.certifications || []), item];
  const updated = await db.users.updateById(req.user.id, { certifications });
  res.status(201).json({ user: publicUser(updated) });
});

router.delete('/me/certifications/:itemId', requireAuth, async (req, res) => {
  const certifications = (req.user.certifications || []).filter((c) => c.id !== req.params.itemId);
  const updated = await db.users.updateById(req.user.id, { certifications });
  res.json({ user: publicUser(updated) });
});

module.exports = router;
