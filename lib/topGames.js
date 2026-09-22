const { fetchJson, mapWithConcurrency } = require('./http');

const TOP_N = 10;
const CACHE_TTL_MS = 60 * 1000;

const CHARTS_URL = 'https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/';
const APPDETAILS_URL = 'https://store.steampowered.com/api/appdetails';
const CURRENT_PLAYERS_URL = 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/';

let cache = { data: null, fetchedAt: 0 };

async function fetchGameDetails(appid) {
  try {
    const json = await fetchJson(`${APPDETAILS_URL}?appids=${appid}&filters=basic`);
    const entry = json[appid];
    if (entry && entry.success && entry.data) {
      return {
        name: entry.data.name,
        headerImage: entry.data.header_image || null,
      };
    }
  } catch (err) {
    console.error(`Failed to fetch details for appid ${appid}:`, err.message);
  }
  return { name: `App ${appid}`, headerImage: null };
}

async function fetchCurrentPlayers(appid) {
  try {
    const json = await fetchJson(`${CURRENT_PLAYERS_URL}?appid=${appid}&format=json`);
    const count = json?.response?.player_count;
    return typeof count === 'number' ? count : 0;
  } catch (err) {
    console.error(`Failed to fetch current players for appid ${appid}:`, err.message);
    return 0;
  }
}

async function getTopGames() {
  const now = Date.now();
  if (cache.data && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  // GetMostPlayedGames gives us the candidate app IDs (ranked by Steam's own
  // charts), but doesn't include a live player count in its response, so we
  // fetch the actual current player count for each one separately.
  const chartsJson = await fetchJson(CHARTS_URL);
  const ranks = chartsJson?.response?.ranks || [];
  const topRanks = ranks.slice(0, TOP_N);

  const [details, currentPlayers] = await Promise.all([
    mapWithConcurrency(topRanks, 5, (r) => fetchGameDetails(r.appid)),
    mapWithConcurrency(topRanks, 5, (r) => fetchCurrentPlayers(r.appid)),
  ]);

  const games = topRanks.map((rank, i) => ({
    rank: rank.rank ?? i + 1,
    appid: rank.appid,
    name: details[i].name,
    headerImage: details[i].headerImage,
    currentPlayers: currentPlayers[i],
    storeUrl: `https://store.steampowered.com/app/${rank.appid}`,
  }));

  cache = { data: games, fetchedAt: now };
  return games;
}

module.exports = { getTopGames };
