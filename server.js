const http = require('http');
const path = require('path');
const fs = require('fs');

const { PORT, BASE_URL } = require('./lib/config');
const { parseCookies, serializeCookie } = require('./lib/cookies');
const { createSession, getSession, destroySession } = require('./lib/sessions');
const { buildLoginUrl, verifyAssertion } = require('./lib/steamOpenId');
const { getPlayerSummary } = require('./lib/steamApi');
const { buildRecommendations } = require('./lib/recommendations');
const { publicSurveyQuestions } = require('./lib/survey');

const MAX_BODY_BYTES = 16 * 1024;

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function getSessionId(req) {
  return parseCookies(req.headers.cookie)['sid'];
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  const urlPath = pathname === '/' ? '/index.html' : pathname;
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
  const url = new URL(req.url, BASE_URL);
  const { pathname } = url;

  if (pathname === '/auth/steam') {
    const loginUrl = buildLoginUrl(`${BASE_URL}/auth/steam/callback`, BASE_URL);
    res.writeHead(302, { Location: loginUrl });
    res.end();
    return;
  }

  if (pathname === '/auth/steam/callback') {
    try {
      const query = Object.fromEntries(url.searchParams.entries());
      const steamid = await verifyAssertion(query);
      if (!steamid) {
        res.writeHead(302, { Location: '/?login=failed' });
        res.end();
        return;
      }
      const sid = createSession({ steamid });
      res.writeHead(302, {
        Location: '/',
        'Set-Cookie': serializeCookie('sid', sid, { maxAge: 7 * 24 * 60 * 60 }),
      });
      res.end();
    } catch (err) {
      console.error('Steam login verification failed:', err.message);
      res.writeHead(302, { Location: '/?login=failed' });
      res.end();
    }
    return;
  }

  if (pathname === '/auth/logout' && req.method === 'POST') {
    const sid = getSessionId(req);
    if (sid) destroySession(sid);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': serializeCookie('sid', '', { maxAge: 0 }),
    });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (pathname === '/api/me') {
    const session = getSession(getSessionId(req));
    if (!session) {
      sendJson(res, 200, { loggedIn: false });
      return;
    }
    const summary = await getPlayerSummary(session.steamid);
    sendJson(res, 200, {
      loggedIn: true,
      steamid: session.steamid,
      personaName: summary?.personaName || null,
      avatar: summary?.avatar || null,
    });
    return;
  }

  if (pathname === '/api/survey-questions') {
    sendJson(res, 200, publicSurveyQuestions());
    return;
  }

  // GET returns plain history-based recommendations (no survey answers).
  // POST carries the survey form as a JSON body, since it includes
  // multi-select arrays and free-text fields that don't fit cleanly in a
  // query string.
  if (pathname === '/api/recommendations' && (req.method === 'GET' || req.method === 'POST')) {
    const session = getSession(getSessionId(req));
    if (!session) {
      sendJson(res, 401, { error: 'not_authenticated' });
      return;
    }
    let answers = {};
    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        if (body && typeof body === 'object') answers = body;
      } catch (err) {
        sendJson(res, 400, { error: 'Invalid request body' });
        return;
      }
    }
    try {
      const data = await buildRecommendations(session.steamid, answers);
      sendJson(res, 200, data);
    } catch (err) {
      console.error('Failed to build recommendations:', err.message);
      sendJson(res, 502, { error: 'Failed to build recommendations' });
    }
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Steam Recommendations running at ${BASE_URL}`);
});
