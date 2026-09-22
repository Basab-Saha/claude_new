const { mapWithConcurrency } = require('./http');
const { getOwnedGames, getAppDetails, getFeaturedCandidates } = require('./steamApi');
const { getCommunityTags } = require('./steamSpy');
const { resolveGameName } = require('./steamSearch');
const { computeSurveyWeights, BUDGET_CAPS, DEALBREAKER_RULES } = require('./survey');

const CACHE_TTL_MS = 5 * 60 * 1000;
// How many of your most-played games to sample when building the genre
// profile. Capped (rather than using the whole library) to bound how many
// store-page lookups a single request makes.
const PLAYED_GAMES_SAMPLE = 40;
const CONCURRENCY = 6;
const RESULT_COUNT = 10;
const MAX_NAMED_GAMES = 8;

// The survey (current mood/preferences, plus loved/disliked games) is
// weighted above long-term play history, per the priority it was asked to
// have. "Loved games" get an even stronger pull than a quiz answer since
// naming a specific favorite is a stronger signal than picking a multiple
// choice option; "disliked games" pull the same amount in the negative
// direction.
const HISTORY_PRIORITY = 1;
const SURVEY_PRIORITY = 3;
const LOVED_GAME_WEIGHT = 4;
const DISLIKED_GAME_WEIGHT = -4;
const MOST_PLAYED_GAME_WEIGHT = 2;
const REPLAY_WISH_WEIGHT = 2;

const cache = new Map(); // "steamid::answersKey" -> { data, fetchedAt }

function hours(minutes) {
  return (minutes || 0) / 60;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// Scales a tag -> weight map so its largest-magnitude entry is ±1.0, so
// history (measured in hours), survey answers (small integer weights) and
// named-game bonuses combine on a comparable scale instead of raw magnitude
// deciding the outcome. Sign is preserved so negative (disliked / "quit
// trigger") weights still pull scores down after normalizing.
function normalize(map) {
  if (map.size === 0) return new Map();
  const maxAbs = Math.max(...[...map.values()].map(Math.abs));
  if (!(maxAbs > 0)) return new Map();
  const out = new Map();
  for (const [key, value] of map) out.set(key, value / maxAbs);
  return out;
}

function answersCacheKey(answers) {
  if (!answers) return 'none';
  const parts = Object.keys(answers)
    .filter((k) => answers[k] !== undefined && answers[k] !== null && answers[k] !== '')
    .sort()
    .map((k) => {
      let v = answers[k];
      if (Array.isArray(v)) v = [...v].sort().join('|');
      else if (typeof v === 'string') v = v.trim().toLowerCase();
      return `${k}:${v}`;
    });
  return parts.length ? parts.join(',') : 'none';
}

function parseNames(text) {
  return (text || '')
    .split(',')
    .map((s) => s.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, MAX_NAMED_GAMES);
}

// Resolves free-typed game names to Steam apps and returns a tag -> weight
// map (genres + categories + community tags, each contributing the given
// weight) so "games you love/hate" can bias scoring the same way a quiz
// answer does.
async function namesToTagWeights(text, weight) {
  const weights = new Map();
  const names = parseNames(text);
  if (names.length === 0) return weights;

  const resolved = (await mapWithConcurrency(names, CONCURRENCY, resolveGameName)).filter(Boolean);
  const tagSets = await mapWithConcurrency(resolved, CONCURRENCY, async (g) => {
    const [details, communityTags] = await Promise.all([getAppDetails(g.appid), getCommunityTags(g.appid)]);
    return [...new Set([...details.genres, ...details.categories, ...communityTags])];
  });

  for (const tags of tagSets) {
    for (const tag of tags) {
      weights.set(tag, (weights.get(tag) || 0) + weight);
    }
  }
  return weights;
}

function mergeInto(target, source) {
  for (const [tag, w] of source) {
    target.set(tag, (target.get(tag) || 0) + w);
  }
}

async function buildRecommendations(steamid, answers) {
  const cacheKey = `${steamid}::${answersCacheKey(answers)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const result = await computeRecommendations(steamid, answers || {});
  cache.set(cacheKey, { data: result, fetchedAt: Date.now() });
  return result;
}

async function computeRecommendations(steamid, answers) {
  const owned = await getOwnedGames(steamid);
  const ownedIds = new Set(owned.map((g) => g.appid));

  // 1. Play-history genre-hours: each played game's hours count fully
  // toward every genre it's tagged with.
  const playedGames = owned
    .filter((g) => (g.playtime_forever || 0) > 0)
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, PLAYED_GAMES_SAMPLE);

  const genreHours = new Map();
  if (playedGames.length > 0) {
    const playedDetails = await mapWithConcurrency(playedGames, CONCURRENCY, (g) => getAppDetails(g.appid));
    playedGames.forEach((g, i) => {
      const gameHours = hours(g.playtime_forever);
      for (const genre of playedDetails[i].genres) {
        genreHours.set(genre, (genreHours.get(genre) || 0) + gameHours);
      }
    });
  }

  // 2. Survey quiz weights (mood, energy, preferences, "quit triggers" as
  // negative weights, ...), plus named loved/disliked/most-played/replay
  // games resolved through Steam's search API and folded into the same map.
  const surveyWeights = computeSurveyWeights(answers);
  const [lovedWeights, dislikedWeights, mostPlayedWeights, replayWeights] = await Promise.all([
    namesToTagWeights(answers.lovedGames, LOVED_GAME_WEIGHT),
    namesToTagWeights(answers.dislikedGames, DISLIKED_GAME_WEIGHT),
    namesToTagWeights(answers.mostPlayedGame, MOST_PLAYED_GAME_WEIGHT),
    namesToTagWeights(answers.replayWish, REPLAY_WISH_WEIGHT),
  ]);
  mergeInto(surveyWeights, lovedWeights);
  mergeInto(surveyWeights, dislikedWeights);
  mergeInto(surveyWeights, mostPlayedWeights);
  mergeInto(surveyWeights, replayWeights);

  const surveyApplied = surveyWeights.size > 0;

  if (genreHours.size === 0 && !surveyApplied) {
    let message = "You don't have any playtime yet, so there's nothing to base recommendations on.";
    if (owned.length === 0) {
      message = "Couldn't read your library. Make sure your Steam profile's \"Game details\" privacy is set to Public.";
    }
    return {
      ownedCount: owned.length,
      topGenres: [],
      topSurveyTags: [],
      surveyApplied: false,
      recommendations: [],
      message,
    };
  }

  // 3. Candidate pool: which storefront bucket(s) to pull from depends on
  // what kind of recommendation was asked for (Q35).
  const buckets = await getFeaturedCandidates();
  const style = answers.recommendationStyle;
  let poolIds;
  if (style === 'D') {
    // "Hidden/underrated" — approximated with new releases over top sellers,
    // since a true low-ownership signal isn't available from public APIs.
    poolIds = buckets.newReleases.length ? buckets.newReleases : [...buckets.topSellers, ...buckets.newReleases];
  } else if (style === 'E') {
    poolIds = buckets.topSellers;
  } else {
    poolIds = [...buckets.topSellers, ...buckets.newReleases, ...buckets.specials];
  }
  poolIds = [...new Set(poolIds)].filter((id) => !ownedIds.has(id));

  const candidates = await mapWithConcurrency(poolIds, CONCURRENCY, async (appid) => {
    const [details, communityTags] = await Promise.all([getAppDetails(appid), getCommunityTags(appid)]);
    return { appid, ...details, communityTags };
  });

  // 4. Hardware/practical filters: dealbreakers and budget rule candidates
  // out entirely rather than just scoring them lower.
  const dealbreakerIds = Array.isArray(answers.dealbreakers)
    ? answers.dealbreakers
    : answers.dealbreakers
      ? [answers.dealbreakers]
      : [];
  const budgetId = answers.budget;

  const filtered = candidates.filter((c) => {
    const tags = new Set([...c.genres, ...c.categories, ...c.communityTags]);
    for (const dbId of dealbreakerIds) {
      const rule = DEALBREAKER_RULES[dbId];
      if (rule && rule.some((t) => tags.has(t))) return false;
    }
    if (budgetId === 'A') {
      if (!c.isFree) return false;
    } else if (budgetId && BUDGET_CAPS[budgetId] != null && c.priceUsd != null) {
      if (c.priceUsd > BUDGET_CAPS[budgetId]) return false;
    }
    return true;
  });

  // 5. Score: history and survey signals are each normalized to a ±1.0
  // scale, then combined with survey weighted above history. "Experimental"
  // style flips history into a mild novelty penalty instead of a bonus;
  // "similar to games I love" leans survey weight (which is where loved
  // games live) even harder.
  const normalizedHistory = normalize(genreHours);
  const normalizedSurvey = normalize(surveyWeights);
  const effectiveHistoryPriority = style === 'C' ? -0.5 : HISTORY_PRIORITY;
  const effectiveSurveyPriority = style === 'B' ? SURVEY_PRIORITY * 1.5 : SURVEY_PRIORITY;

  const recommendations = filtered
    .map((c) => {
      const tags = [...new Set([...c.genres, ...c.categories, ...c.communityTags])];

      const matchedGenres = c.genres
        .filter((g) => genreHours.has(g))
        .map((g) => ({ genre: g, hours: round1(genreHours.get(g)) }));
      const historyScore = c.genres.reduce((sum, g) => sum + (normalizedHistory.get(g) || 0), 0) * effectiveHistoryPriority;

      const matchedSurvey = tags
        .filter((t) => surveyWeights.has(t) && surveyWeights.get(t) > 0)
        .map((t) => ({ tag: t, weight: round1(surveyWeights.get(t)) }));
      const surveyScore = tags.reduce((sum, t) => sum + (normalizedSurvey.get(t) || 0), 0) * effectiveSurveyPriority;

      const discountBonus = budgetId === 'G' && c.discountPercent > 0 ? (c.discountPercent / 100) * 0.5 : 0;

      return { ...c, score: historyScore + surveyScore + discountBonus, matchedGenres, matchedSurvey };
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
      matchedSurvey: c.matchedSurvey,
      storeUrl: `https://store.steampowered.com/app/${c.appid}`,
    }));

  const topGenres = [...genreHours.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, h]) => ({ genre, hours: round1(h) }));

  const topSurveyTags = [...surveyWeights.entries()]
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, weight]) => ({ tag, weight: round1(weight) }));

  return { ownedCount: owned.length, topGenres, topSurveyTags, surveyApplied, recommendations };
}

module.exports = { buildRecommendations };
