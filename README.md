# Steam Top 10 Games

A simple website that shows the top 10 Steam games ranked by current concurrent player count.

## How it works

- `server.js` is a small Node.js HTTP server (no external dependencies) that:
  - Calls Steam's public `ISteamChartsService/GetMostPlayedGames` endpoint to get the most-played app IDs and their current player counts.
  - Looks up each game's name and header image via the Steam Store `appdetails` API.
  - Caches the combined result for 60 seconds to avoid hammering Steam's API.
  - Exposes it at `GET /api/top-games`.
- `public/` is a static frontend (`index.html` + `app.js` + `style.css`) that fetches `/api/top-games` and renders a ranked list, each linking to the game's Steam store page.

A backend is required because Steam's API does not send CORS headers, so the browser can't call it directly — no Steam API key is needed for these endpoints.

## Running it

```bash
node server.js
```

Then open http://localhost:3000 in your browser.

Optionally set a custom port:

```bash
PORT=8080 node server.js
```

## Notes

- Requires Node.js 18+ (uses the built-in `fetch`).
- No API key is required for the endpoints used here.
