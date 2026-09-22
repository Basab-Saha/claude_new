# Steam Game Recommendations

A simple website that recommends games to you based on your own Steam library.

## How it works

- "Sign in through Steam" uses Steam's OpenID 2.0 login — you authenticate directly on steamcommunity.com, and Steam redirects back with your SteamID. No password ever touches this app.
- Once signed in, the server calls `IPlayerService/GetOwnedGames` to read your library (this **requires a Steam Web API key** and your profile's *Game details* privacy set to **Public**).
- It looks at your 20 most-played owned games, fetches their genres, and builds a weighted genre profile (playtime-weighted, so one 2,000-hour game doesn't dominate).
- It compares that profile against Steam's current top sellers / new releases / specials (fetched live, not a hardcoded list), scores each by genre overlap, and returns your top 10 matches that you don't already own.
- Exposed at `GET /api/recommendations` (requires being signed in).

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

## Notes

- Requires Node.js 18+ (uses the built-in `fetch`).
- Sessions are stored in memory (a random session ID cookie mapped to your SteamID), so they reset if the server restarts. Fine for local/personal use; swap in a real session/data store for production.
- The `featuredcategories` (top sellers / new releases / specials) endpoint is undocumented but widely used; Valve could change its shape without notice.
