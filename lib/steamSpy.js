const { fetchJson } = require('./http');

const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map(); // appid -> { data, fetchedAt }

// SteamSpy mirrors Steam's community tags (Horror, Cozy, Souls-like, Story
// Rich, ...) that the official appdetails API doesn't expose, only genres
// and categories. This is a best-effort enrichment: SteamSpy is a
// third-party service, so failures or shape drift just fall back to an
// empty tag list rather than breaking anything that depends on it.
async function getCommunityTags(appid) {
  const cached = cache.get(appid);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.data;
  }

  let tags = [];
  try {
    const json = await fetchJson(`https://steamspy.com/api.php?request=appdetails&appid=${appid}`);
    if (json && json.tags && typeof json.tags === 'object' && !Array.isArray(json.tags)) {
      tags = Object.keys(json.tags);
    }
  } catch (err) {
    console.error(`SteamSpy tags failed for ${appid}:`, err.message);
  }

  cache.set(appid, { data: tags, fetchedAt: Date.now() });
  return tags;
}

module.exports = { getCommunityTags };
