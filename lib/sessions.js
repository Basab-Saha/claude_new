const crypto = require('crypto');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();

function createSession(data) {
  const id = crypto.randomBytes(24).toString('hex');
  sessions.set(id, { data, expiresAt: Date.now() + SESSION_TTL_MS });
  return id;
}

function getSession(id) {
  if (!id) return null;
  const entry = sessions.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessions.delete(id);
    return null;
  }
  return entry.data;
}

function destroySession(id) {
  sessions.delete(id);
}

module.exports = { createSession, getSession, destroySession };
