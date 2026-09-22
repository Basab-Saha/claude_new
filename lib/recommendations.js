const { mapWithConcurrency } = require('./http');
const { getOwnedGames, getAppDetails, getFeaturedCandidateAppIds } = require('./steamApi');
const { computeMoodWeights } = require('./moodQuestions');

const CACHE_TTL_MS = 5 * 60 * 1000;
// How many of your most-played games to sample when building the genre
// profile. Capped (rather than using the whole library) to bound how many
// store-page lookups a single request makes.
const PLAYED_GAMES_SAMPLE = 40;
const CONCURRENCY = 5;
const RESULT_COUNT = 10;

// Mood answers reflect how the user feels right now and are weighted above
// long-term play history, per the priority the feature was asked for.
const HISTORY_PRIORITY = 1;
const MOOD_PRIORITY = 3;

const cache = new Map(); // "steamid::moodKey" -> { data, fetchedAt }

function hours(minutes) {
  return (minutes || 0) / 60;
}

// Scales a tag -> weight map so its strongest entry is 1.0, so history
// (measured in hours) and mood (measured in small integer weights) combine
// on a comparable scale instead of one drowning out the other by magnitude.
function normalize(map) {
  if (map.size === 0) return new Map();
  const max = Math.max(...map.values());
  if (!(max > 0)) return new Map();
  const out = new Map();
  for (const [key, value] of map) out.set(key, value / max);
  return out;
}

function moodCacheKey(answers) {
  if (!answers) return 'none';
  const entries = Object.entries(answers)
    .filter(([, value]) => value)
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? entries.map(([k, v]) => `${k}:${v}`).join(',') : 'none';
}

async function buildRecommendations(steamid, moodAnswers) {
  const cacheKey = `${steamid}::${moodCacheKey(moodAnswers)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const result = await computeRecommendations(steamid, moodAnswers);
  cache.set(cacheKey, { data: result, fetchedAt: Date.now() });
  return result;
}

async function computeRecommendations(steamid, moodAnswers) {
  const owned = await getOwnedGames(steamid);
  const ownedIds = new Set(owned.map((g) => g.appid));
  const moodApplied = !!moodAnswers && Object.values(moodAnswers).some(Boolean);

  // Only played games carry a playtime signal; sample the most-played ones
  // (across your whole library, not just recently played) to build the
  // genre-hours profile.
  const playedGames = owned
    .filter((g) => (g.playtime_forever || 0) > 0)
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, PLAYED_GAMES_SAMPLE);

  const genreHours = new Map();
  if (playedGames.length > 0) {
    const playedDetails = await mapWithConcurrency(playedGames, CONCURRENCY, (g) => getAppDetails(g.appid));
    // Hours played per genre: each game's playtime counts fully toward every
    // genre it's tagged with (a genre tag describes the whole game, not a
    // fraction of it).
    playedGames.forEach((g, i) => {
      const gameHours = hours(g.playtime_forever);
      for (const genre of playedDetails[i].genres) {
        genreHours.set(genre, (genreHours.get(genre) || 0) + gameHours);
      }
    });
  }

  const moodWeights = computeMoodWeights(moodAnswers);

  if (genreHours.size === 0 && moodWeights.size === 0) {
    let message = "You don't have any playtime yet, so there's nothing to base recommendations on.";
    if (owned.length === 0) {
      message = "Couldn't read your library. Make sure your Steam profile's \"Game details\" privacy is set to Public.";
    } else if (moodApplied) {
      message = "Couldn't determine any preferences from those answers or your library.";
    }
    return { ownedCount: owned.length, topGenres: [], topMoodTags: [], moodApplied, recommendations: [], message };
  }

  const candidateIds = (await getFeaturedCandidateAppIds()).filter((id) => !ownedIds.has(id));
  const candidates = await mapWithConcurrency(candidateIds, CONCURRENCY, async (appid) => ({
    appid,
    ...(await getAppDetails(appid)),
  }));

  const normalizedHistory = normalize(genreHours);
  const normalizedMood = normalize(moodWeights);

  const recommendations = candidates
    .map((c) => {
      const matchedGenres = c.genres
        .filter((g) => genreHours.has(g))
        .map((g) => ({ genre: g, hours: Math.round(genreHours.get(g) * 10) / 10 }));
      const historyScore = c.genres.reduce((sum, g) => sum + (normalizedHistory.get(g) || 0), 0) * HISTORY_PRIORITY;

      const tags = [...new Set([...c.genres, ...c.categories])];
      const matchedMood = tags
        .filter((t) => moodWeights.has(t))
        .map((t) => ({ tag: t, weight: moodWeights.get(t) }));
      const moodScore = tags.reduce((sum, t) => sum + (normalizedMood.get(t) || 0), 0) * MOOD_PRIORITY;

      return { ...c, score: historyScore + moodScore, matchedGenres, matchedMood };
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
      matchedMood: c.matchedMood,
      storeUrl: `https://store.steampowered.com/app/${c.appid}`,
    }));

  const topGenres = [...genreHours.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, h]) => ({ genre, hours: Math.round(h * 10) / 10 }));

  const topMoodTags = [...moodWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, weight]) => ({ tag, weight }));

  return { ownedCount: owned.length, topGenres, topMoodTags, moodApplied, recommendations };
}

module.exports = { buildRecommendations };
