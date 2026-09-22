const { fetchJson } = require('./http');

const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map(); // lowercased name -> { data, fetchedAt }

// Resolves a free-typed game name (from the "games you love/hate" survey
// questions) to a Steam appid via the public storefront search-suggest
// endpoint. Returns null if nothing matches or the lookup fails.
async function resolveGameName(name) {
  const key = (name || '').trim().toLowerCase();
  if (!key) return null;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.data;
  }

  let result = null;
  try {
    const json = await fetchJson(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&cc=us&l=en`
    );
    const item = json?.items?.[0];
    if (item && typeof item.id === 'number') {
      result = { appid: item.id, name: item.name };
    }
  } catch (err) {
    console.error(`Store search failed for "${name}":`, err.message);
  }

  cache.set(key, { data: result, fetchedAt: Date.now() });
  return result;
}

module.exports = { resolveGameName };
