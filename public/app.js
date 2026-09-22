const listEl = document.getElementById('game-list');
const statusEl = document.getElementById('status');
const updatedAtEl = document.getElementById('updated-at');
const refreshBtn = document.getElementById('refresh-btn');

function formatPlayers(n) {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString();
}

function render(games) {
  listEl.innerHTML = games
    .map(
      (g) => `
      <li>
        <a class="game-card" href="${g.storeUrl}" target="_blank" rel="noopener noreferrer">
          <span class="rank">${g.rank}</span>
          ${g.headerImage ? `<img class="thumb" src="${g.headerImage}" alt="" loading="lazy" />` : '<span class="thumb"></span>'}
          <span class="info">
            <div class="name">${g.name}</div>
            <div class="players"><strong>${formatPlayers(g.currentPlayers)}</strong> playing now</div>
          </span>
        </a>
      </li>`
    )
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

refreshBtn.addEventListener('click', loadGames);
loadGames();
