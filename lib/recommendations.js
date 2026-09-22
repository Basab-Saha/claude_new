const { mapWithConcurrency } = require('./http');
const { getOwnedGames, getAppDetails, getFeaturedCandidateAppIds } = require('./steamApi');

const CACHE_TTL_MS = 5 * 60 * 1000;
const TOP_OWNED_SAMPLE = 20;
const CONCURRENCY = 5;
const RESULT_COUNT = 10;

const cache = new Map(); // steamid -> { data, fetchedAt }

// Genre weight per owned game is a damped function of playtime so one
// mega-played game can't single-handedly dominate the whole profile.
function playtimeWeight(minutes) {
  return Math.log2((minutes || 0) + 2);
}

async function buildRecommendations(steamid) {
  const cached = cache.get(steamid);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const result = await computeRecommendations(steamid);
  cache.set(steamid, { data: result, fetchedAt: Date.now() });
  return result;
}

async function computeRecommendations(steamid) {
  const owned = await getOwnedGames(steamid);

  if (owned.length === 0) {
    return {
      ownedCount: 0,
      topGenres: [],
      recommendations: [],
      message:
        "Couldn't read your library. Make sure your Steam profile's \"Game details\" privacy is set to Public.",
    };
  }

  const ownedIds = new Set(owned.map((g) => g.appid));
  const topOwned = [...owned]
    .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
    .slice(0, TOP_OWNED_SAMPLE);

  const topOwnedDetails = await mapWithConcurrency(topOwned, CONCURRENCY, (g) => getAppDetails(g.appid));

  const affinity = new Map();
  topOwned.forEach((g, i) => {
    const weight = playtimeWeight(g.playtime_forever);
    for (const genre of topOwnedDetails[i].genres) {
      affinity.set(genre, (affinity.get(genre) || 0) + weight);
    }
  });

  if (affinity.size === 0) {
    return {
      ownedCount: owned.length,
      topGenres: [],
      recommendations: [],
      message: "Couldn't determine genre preferences from your library yet.",
    };
  }

  const candidateIds = (await getFeaturedCandidateAppIds()).filter((id) => !ownedIds.has(id));
  const candidates = await mapWithConcurrency(candidateIds, CONCURRENCY, async (appid) => ({
    appid,
    ...(await getAppDetails(appid)),
  }));

  const recommendations = candidates
    .map((c) => {
      const matchedGenres = c.genres.filter((g) => affinity.has(g));
      const score = matchedGenres.reduce((sum, g) => sum + affinity.get(g), 0);
      return { ...c, score, matchedGenres };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, RESULT_COUNT)
    .map((c, i) => ({
      rank: i + 1,
      appid: c.appid,
      name: c.name,
      headerImage: c.headerImage,
      matchedGenres: c.matchedGenres,
      storeUrl: `https://store.steampowered.com/app/${c.appid}`,
    }));

  const topGenres = [...affinity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre]) => genre);

  return { ownedCount: owned.length, topGenres, recommendations };
}

module.exports = { buildRecommendations };
