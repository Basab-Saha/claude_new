# Steam Game Recommendations

A simple website that recommends games to you based on your own Steam library — and, if you take the "what do you want right now" survey, your current mood and preferences outweigh that library.

## How it works

- "Sign in through Steam" uses Steam's OpenID 2.0 login — you authenticate directly on steamcommunity.com, and Steam redirects back with your SteamID. No password ever touches this app.
- Once signed in, the server calls `IPlayerService/GetOwnedGames` to read your library (this **requires a Steam Web API key** and your profile's *Game details* privacy set to **Public**).
- It looks at up to 40 of your most-played owned games and sums **actual hours played per genre** across them (a game's full playtime counts toward every genre it's tagged with).
- The **"Personalize my recommendations"** button opens a 35-question survey (current mood/energy/focus/stress, gameplay preferences, what keeps you playing, story/atmosphere, social preference, session length, budget, dealbreakers, and games you love/hate). Answers map to Steam genres, categories, and (best-effort) community tags, and are combined with your play-history profile — **survey answers are weighted 3x over history**, so they can genuinely override what your library alone would suggest.
- Games you name as loved/disliked/most-played/want-to-replay are resolved to real Steam apps via the storefront search API and folded into the same weighted profile — loved games pull recommendations toward their genres/tags, disliked games pull away.
- Budget and "deal-breakers" (PvP, Early Access, gore, etc.) are hard filters, not just weights — a candidate that violates one is excluded outright, not just scored lower.
- The "what kind of recommendation" question changes strategy: popular picks from top sellers, new releases for something less mainstream, or a "similar to what I love" bias that leans harder on your named favorite games.
- Candidates come from Steam's current top sellers / new releases / specials (fetched live, not a hardcoded list). Exposed at `GET/POST /api/recommendations` (requires being signed in; POST carries the survey answers as JSON).

A backend is required throughout because Steam's APIs don't send CORS headers, so the browser can't call them directly.

## Setup

### 1. Get a Steam Web API key
Go to https://steamcommunity.com/dev/apikey (requires a Steam account). For local development, you can register it with domain `localhost`.

### 2. Run the server
```bash
STEAM_API_KEY=your_key_here node server.js
```

Then open http://localhost:3000.

Optional environment variables:
- `PORT` — custom port (default `3000`).
- `BASE_URL` — the public URL of the site, used to build the Steam login redirect (default `http://localhost:$PORT`). Set this if you deploy it somewhere other than localhost.

### 3. Make your library readable
Steam only returns your owned-games list if your profile's **Game details** privacy setting is Public: Steam profile → Edit Profile → Privacy Settings → Game details → Public. Signing in via OpenID proves who you are but doesn't bypass this setting.

## Known limitations

Steam's official `genres`/`categories` vocabulary is small (no "Horror", "Cozy", "Souls-like", "Story Rich", etc.), so richer survey answers (atmosphere, difficulty feel, pacing) are matched against **SteamSpy's community tags** as a best-effort enrichment layer — SteamSpy is a third-party service, not an official Steam API, so if it's unreachable or changes shape, those matches just silently contribute nothing rather than breaking anything.

A few things in the survey are intentionally not enforced because there's no reliable public signal for them:
- **Always-online requirement** and **very long cutscenes** dealbreakers — no API field for either.
- **"Hidden/underrated games"** — approximated by pulling from new releases instead of top sellers, not a true low-ownership metric (Steam doesn't publish one).
- **Steam Deck / handheld compatibility** — only loosely approximated via the "Full controller support" category, since Deck verification status isn't in the public API.

## Notes

- Requires Node.js 18+ (uses the built-in `fetch`).
- Sessions are stored in memory (a random session ID cookie mapped to your SteamID), so they reset if the server restarts. Fine for local/personal use; swap in a real session/data store for production.
- The `featuredcategories`, `storesearch`, and SteamSpy endpoints are undocumented/third-party but widely used; their shape could change without notice, in which case the affected signal degrades to no-op rather than erroring.
- Taking the full survey does more work per request (resolving named games, fetching community tags for every candidate), so results may take a few seconds longer than the plain library-based view.
