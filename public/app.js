const listEl = document.getElementById('game-list');
const statusEl = document.getElementById('status');
const updatedAtEl = document.getElementById('updated-at');
const refreshBtn = document.getElementById('refresh-btn');

const authBarEl = document.getElementById('auth-bar');
const recsSectionEl = document.getElementById('recs-section');
const recsSubtitleEl = document.getElementById('recs-subtitle');
const recsStatusEl = document.getElementById('recs-status');
const recsListEl = document.getElementById('recs-list');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatPlayers(n) {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString();
}

function gameCard(g, extraLine) {
  return `
    <li>
      <a class="game-card" href="${g.storeUrl}" target="_blank" rel="noopener noreferrer">
        <span class="rank">${g.rank}</span>
        ${g.headerImage ? `<img class="thumb" src="${escapeHtml(g.headerImage)}" alt="" loading="lazy" />` : '<span class="thumb"></span>'}
        <span class="info">
          <div class="name">${escapeHtml(g.name)}</div>
          ${extraLine}
        </span>
      </a>
    </li>`;
}

function render(games) {
  listEl.innerHTML = games
    .map((g) => gameCard(g, `<div class="players"><strong>${formatPlayers(g.currentPlayers)}</strong> playing now</div>`))
    .join('');
}

async function loadGames() {
  refreshBtn.disabled = true;
  statusEl.textContent = 'Loading...';
  statusEl.classList.remove('error');

  try {
    const res = await fetch('/api/top-games');
    if (!res.ok) throw new Error('Request failed');
    const data = await res.json();
    render(data.games);
    statusEl.textContent = '';
    updatedAtEl.textContent = `Updated ${formatTime(data.fetchedAt)}`;
  } catch (err) {
    statusEl.textContent = 'Could not load data from the Steam API. Please try again.';
    statusEl.classList.add('error');
  } finally {
    refreshBtn.disabled = false;
  }
}

function renderAuthBar(me) {
  if (!me.loggedIn) {
    authBarEl.innerHTML = `
      <a class="steam-login" href="/auth/steam">Sign in through Steam</a>`;
    return;
  }

  authBarEl.innerHTML = `
    <div class="account">
      ${me.avatar ? `<img class="avatar" src="${escapeHtml(me.avatar)}" alt="" />` : ''}
      <span>Signed in as <strong>${escapeHtml(me.personaName || 'Steam user')}</strong></span>
      <button id="logout-btn" class="link-btn">Sign out</button>
    </div>`;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/auth/logout', { method: 'POST' });
    window.location.reload();
  });
}

function renderRecommendations(data) {
  recsSectionEl.hidden = false;

  if (data.message) {
    recsStatusEl.textContent = data.message;
    recsStatusEl.classList.add('error');
    recsListEl.innerHTML = '';
    recsSubtitleEl.textContent = '';
    return;
  }

  if (!data.recommendations || data.recommendations.length === 0) {
    recsStatusEl.textContent = 'No matches found in the current top sellers / new releases yet.';
    recsListEl.innerHTML = '';
    recsSubtitleEl.textContent = '';
    return;
  }

  recsStatusEl.textContent = '';
  recsSubtitleEl.textContent = data.topGenres?.length
    ? `Based on your library's top genres: ${data.topGenres.join(', ')}`
    : '';

  recsListEl.innerHTML = data.recommendations
    .map((g) =>
      gameCard(
        g,
        g.matchedGenres?.length
          ? `<div class="players">Matches: <strong>${escapeHtml(g.matchedGenres.join(', '))}</strong></div>`
          : ''
      )
    )
    .join('');
}

async function loadRecommendations() {
  try {
    const res = await fetch('/api/recommendations');
    if (res.status === 401) {
      recsSectionEl.hidden = true;
      return;
    }
    if (!res.ok) throw new Error('Request failed');
    renderRecommendations(await res.json());
  } catch (err) {
    recsSectionEl.hidden = false;
    recsStatusEl.textContent = 'Could not load recommendations. Please try again.';
    recsStatusEl.classList.add('error');
  }
}

async function loadAuth() {
  try {
    const res = await fetch('/api/me');
    const me = await res.json();
    renderAuthBar(me);
    if (me.loggedIn) {
      await loadRecommendations();
    } else {
      recsSectionEl.hidden = true;
    }
  } catch (err) {
    renderAuthBar({ loggedIn: false });
  }
}

refreshBtn.addEventListener('click', loadGames);
loadGames();
loadAuth();
