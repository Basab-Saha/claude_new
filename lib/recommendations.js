const { mapWithConcurrency } = require('./http');
const { getOwnedGames, getAppDetails, getFeaturedCandidateAppIds } = require('./steamApi');

const CACHE_TTL_MS = 5 * 60 * 1000;
// How many of your most-played games to sample when building the genre
// profile. Capped (rather than using the whole library) to bound how many
// store-page lookups a single request makes.
const PLAYED_GAMES_SAMPLE = 40;
const CONCURRENCY = 5;
const RESULT_COUNT = 10;

const cache = new Map(); // steamid -> { data, fetchedAt }

function hours(minutes) {
  return (minutes || 0) / 60;
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

  // Only played games carry a playtime signal; sample the most-played ones
  // (across your whole library, not just recently played) to build the
  // genre-hours profile.
  const playedGames = owned
    .filter((g) => (g.playtime_forever || 0) > 0)
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, PLAYED_GAMES_SAMPLE);

  if (playedGames.length === 0) {
    return {
      ownedCount: owned.length,
      topGenres: [],
      recommendations: [],
      message: "You don't have any playtime yet, so there's nothing to base recommendations on.",
    };
  }

  const playedDetails = await mapWithConcurrency(playedGames, CONCURRENCY, (g) => getAppDetails(g.appid));

  // Hours played per genre: each game's playtime counts fully toward every
  // genre it's tagged with (a genre tag describes the whole game, not a
  // fraction of it).
  const genreHours = new Map();
  playedGames.forEach((g, i) => {
    const gameHours = hours(g.playtime_forever);
    for (const genre of playedDetails[i].genres) {
      genreHours.set(genre, (genreHours.get(genre) || 0) + gameHours);
    }
  });

  if (genreHours.size === 0) {
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
      const matchedGenres = c.genres
        .filter((g) => genreHours.has(g))
        .map((g) => ({ genre: g, hours: Math.round(genreHours.get(g) * 10) / 10 }));
      const score = matchedGenres.reduce((sum, m) => sum + m.hours, 0);
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

  const topGenres = [...genreHours.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, h]) => ({ genre, hours: Math.round(h * 10) / 10 }));

  return { ownedCount: owned.length, topGenres, recommendations };
}

module.exports = { buildRecommendations };
