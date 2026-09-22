const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const STEAM_API_KEY = process.env.STEAM_API_KEY || '';

if (!STEAM_API_KEY) {
  console.warn(
    '[warning] STEAM_API_KEY is not set. Steam sign-in and library-based recommendations ' +
      'will not work until you set it. Get a free key at https://steamcommunity.com/dev/apikey ' +
      'and run with STEAM_API_KEY=your_key node server.js'
  );
}

module.exports = { PORT, BASE_URL, STEAM_API_KEY };
