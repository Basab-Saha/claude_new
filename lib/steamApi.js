const { fetchJson } = require('./http');
const { STEAM_API_KEY } = require('./config');

const APP_DETAILS_TTL_MS = 24 * 60 * 60 * 1000;
const appDetailsCache = new Map(); // appid -> { data, fetchedAt }

async function getOwnedGames(steamid) {
  const url =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/` +
    `?key=${STEAM_API_KEY}&steamid=${steamid}&include_appinfo=1&include_played_free_games=1&format=json`;
  const json = await fetchJson(url);
  const games = json?.response?.games;
  return Array.isArray(games) ? games : [];
}

async function getPlayerSummary(steamid) {
  try {
    const url =
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/` +
      `?key=${STEAM_API_KEY}&steamids=${steamid}`;
    const json = await fetchJson(url);
    const player = json?.response?.players?.[0];
    if (!player) return null;
    return {
      personaName: player.personaname || 'Steam user',
      avatar: player.avatarmedium || player.avatar || null,
    };
  } catch (err) {
    console.error(`Failed to fetch player summary for ${steamid}:`, err.message);
    return null;
  }
}

// Full store app details (name, header image, genres, categories), cached
// since this data barely changes and both the recommender and library
// lookups need it. Categories (Single-player, Co-op, PvP, ...) are fetched
// alongside genres so mood-based matching can target "playing with others"
// style answers, not just genre.
async function getAppDetails(appid) {
  const cached = appDetailsCache.get(appid);
  if (cached && Date.now() - cached.fetchedAt < APP_DETAILS_TTL_MS) {
    return cached.data;
  }

  let data;
  try {
    const json = await fetchJson(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=en`);
    const entry = json?.[appid];
    if (entry && entry.success && entry.data) {
      data = {
        name: entry.data.name,
        headerImage: entry.data.header_image || null,
        genres: (entry.data.genres || []).map((g) => g.description).filter(Boolean),
        categories: (entry.data.categories || []).map((c) => c.description).filter(Boolean),
      };
    } else {
      data = { name: `App ${appid}`, headerImage: null, genres: [], categories: [] };
    }
  } catch (err) {
    console.error(`Failed to fetch appdetails for ${appid}:`, err.message);
    data = { name: `App ${appid}`, headerImage: null, genres: [], categories: [] };
  }

  appDetailsCache.set(appid, { data, fetchedAt: Date.now() });
  return data;
}

// Pulls currently-relevant app IDs (top sellers / new releases / specials)
// from Steam's public storefront to use as a recommendation candidate pool,
// instead of a hand-maintained game list.
async function getFeaturedCandidateAppIds() {
  try {
    const json = await fetchJson('https://store.steampowered.com/api/featuredcategories?cc=us&l=en');
    const ids = new Set();
    for (const bucket of ['top_sellers', 'new_releases', 'specials']) {
      const items = json?.[bucket]?.items;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (item && typeof item.id === 'number') ids.add(item.id);
      }
    }
    return Array.from(ids);
  } catch (err) {
    console.error('Failed to fetch featured categories:', err.message);
    return [];
  }
}

module.exports = { getOwnedGames, getPlayerSummary, getAppDetails, getFeaturedCandidateAppIds };
