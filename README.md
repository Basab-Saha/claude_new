# Steam Top 10 Games

A simple website that shows the top 10 Steam games ranked by current concurrent player count, and — once you sign in with Steam — personalized recommendations based on your own library.

## How it works

### Top 10 games
- Calls Steam's public `ISteamChartsService/GetMostPlayedGames` endpoint to get the most-played app IDs.
- Fetches each game's real live player count from `ISteamUserStats/GetNumberOfCurrentPlayers`, and its name/header image from the Steam Store `appdetails` API.
- Caches the combined result for 60 seconds. Exposed at `GET /api/top-games`. No API key required.

### Recommendations
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
- Sessions are stored in memory (a signed-cookie session ID mapped to your SteamID), so they reset if the server restarts. Fine for local/personal use; swap in a real session/data store for production.
- The `GetMostPlayedGames` and `featuredcategories` (top sellers / new releases) endpoints are undocumented but widely used; Valve could change their shape without notice.
