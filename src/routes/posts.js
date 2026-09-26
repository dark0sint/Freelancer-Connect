const express = require('express');
const db = require('../db');
const { newId } = require('../utils/helpers');
const { requireAuth, attachUser } = require('../middleware/auth');

const router = express.Router();

function serialize(post, viewerId) {
  const author = db.users.findById(post.authorId);
  const likes = post.likedBy || [];
  return {
    id: post.id,
    text: post.text,
    imageUrl: post.imageUrl,
    createdAt: post.createdAt,
    likeCount: likes.length,
    likedByMe: viewerId ? likes.includes(viewerId) : false,
    author: author
      ? { id: author.id, name: author.name, title: author.title, avatarColor: author.avatarColor }
      : null,
  };
}

router.get('/', attachUser, (req, res) => {
  const posts = db.posts
    .all()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100)
    .map((p) => serialize(p, req.user && req.user.id));
  res.json({ posts });
});

router.post('/', requireAuth, async (req, res) => {
  const { text, imageUrl } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'Tulis sesuatu sebelum mengirim.' });
  }
  const post = {
    id: newId('post'),
    authorId: req.user.id,
    text: String(text).slice(0, 1000),
    imageUrl: imageUrl ? String(imageUrl).slice(0, 500) : '',
    likedBy: [],
    createdAt: new Date().toISOString(),
  };
  await db.posts.insert(post);
  res.status(201).json({ post: serialize(post, req.user.id) });
});

router.post('/:id/like', requireAuth, async (req, res) => {
  const post = db.posts.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Postingan tidak ditemukan.' });
  const likedBy = post.likedBy || [];
  const already = likedBy.includes(req.user.id);
  const nextLikedBy = already ? likedBy.filter((id) => id !== req.user.id) : [...likedBy, req.user.id];
  const updated = await db.posts.updateById(post.id, { likedBy: nextLikedBy });
  res.json({ post: serialize(updated, req.user.id) });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const post = db.posts.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Postingan tidak ditemukan.' });
  if (post.authorId !== req.user.id) return res.status(403).json({ error: 'Bukan postingan Anda.' });
  await db.posts.deleteById(post.id);
  res.json({ success: true });
});

module.exports = router;
