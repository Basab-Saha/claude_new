const authBarEl = document.getElementById('auth-bar');
const signedOutEl = document.getElementById('signed-out');
const recsSectionEl = document.getElementById('recs-section');
const recsSubtitleEl = document.getElementById('recs-subtitle');
const recsStatusEl = document.getElementById('recs-status');
const recsListEl = document.getElementById('recs-list');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
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

function renderAuthBar(me) {
  if (!me.loggedIn) {
    authBarEl.innerHTML = '';
    signedOutEl.hidden = false;
    recsSectionEl.hidden = true;
    return;
  }

  signedOutEl.hidden = true;
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
    ? `Based on hours played by genre: ${data.topGenres.map((t) => `${t.genre} (${t.hours}h)`).join(', ')}`
    : '';

  recsListEl.innerHTML = data.recommendations
    .map((g) =>
      gameCard(
        g,
        g.matchedGenres?.length
          ? `<div class="players">Matches: <strong>${escapeHtml(
              g.matchedGenres.map((m) => `${m.genre} (${m.hours}h)`).join(', ')
            )}</strong></div>`
          : ''
      )
    )
    .join('');
}

async function loadRecommendations() {
  recsSectionEl.hidden = false;
  recsStatusEl.textContent = 'Loading...';
  recsStatusEl.classList.remove('error');
  recsListEl.innerHTML = '';

  try {
    const res = await fetch('/api/recommendations');
    if (res.status === 401) {
      recsSectionEl.hidden = true;
      return;
    }
    if (!res.ok) throw new Error('Request failed');
    renderRecommendations(await res.json());
  } catch (err) {
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
    }
  } catch (err) {
    renderAuthBar({ loggedIn: false });
  }
}

loadAuth();
