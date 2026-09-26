const { v4: uuidv4 } = require('uuid');

function newId(prefix) {
  return `${prefix}_${uuidv4()}`;
}

// Jangan pernah mengirim passwordHash ke klien
function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function averageRating(reviews) {
  if (!reviews.length) return { average: 0, count: 0 };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}

module.exports = { newId, publicUser, averageRating };
