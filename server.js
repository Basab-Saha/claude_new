const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const TOP_N = 10;
const CACHE_TTL_MS = 60 * 1000;

const CHARTS_URL = 'https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/';
const APPDETAILS_URL = 'https://store.steampowered.com/api/appdetails';

let cache = { data: null, fetchedAt: 0 };

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with status ${res.status}`);
  }
  return res.json();
}

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

async function getTopGames() {
  const now = Date.now();
  if (cache.data && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const chartsJson = await fetchJson(CHARTS_URL);
  const ranks = chartsJson?.response?.ranks || [];
  const topRanks = ranks.slice(0, TOP_N);

  const details = await Promise.all(topRanks.map((r) => fetchGameDetails(r.appid)));

  const games = topRanks.map((rank, i) => ({
    rank: rank.rank ?? i + 1,
    appid: rank.appid,
    name: details[i].name,
    headerImage: details[i].headerImage,
    currentPlayers: rank.concurrent_in_game,
    peakInGame: rank.peak_in_game,
    storeUrl: `https://store.steampowered.com/app/${rank.appid}`,
  }));

  cache = { data: games, fetchedAt: now };
  return games;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

const PUBLIC_DIR = path.join(__dirname, 'public');

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/top-games')) {
    try {
      const games = await getTopGames();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ games, fetchedAt: cache.fetchedAt }));
    } catch (err) {
      console.error('Failed to fetch top games:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch data from Steam API' }));
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Steam Top Games running at http://localhost:${PORT}`);
});
