const authBarEl = document.getElementById('auth-bar');
const signedOutEl = document.getElementById('signed-out');
const moodControlsEl = document.getElementById('mood-controls');
const moodBtn = document.getElementById('mood-btn');
const moodClearBtn = document.getElementById('mood-clear-btn');
const moodFormEl = document.getElementById('mood-form');
const recsSectionEl = document.getElementById('recs-section');
const recsSubtitleEl = document.getElementById('recs-subtitle');
const recsStatusEl = document.getElementById('recs-status');
const recsListEl = document.getElementById('recs-list');

let moodQuestions = null;
let currentMoodAnswers = {};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function gameCard(g, extraLines) {
  return `
    <li>
      <a class="game-card" href="${g.storeUrl}" target="_blank" rel="noopener noreferrer">
        <span class="rank">${g.rank}</span>
        ${g.headerImage ? `<img class="thumb" src="${escapeHtml(g.headerImage)}" alt="" loading="lazy" />` : '<span class="thumb"></span>'}
        <span class="info">
          <div class="name">${escapeHtml(g.name)}</div>
          ${extraLines.join('')}
        </span>
      </a>
    </li>`;
}

function renderAuthBar(me) {
  if (!me.loggedIn) {
    authBarEl.innerHTML = '';
    signedOutEl.hidden = false;
    moodControlsEl.hidden = true;
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

  const subtitleParts = [];
  if (data.moodApplied && data.topMoodTags?.length) {
    subtitleParts.push(`Right now: ${data.topMoodTags.map((t) => t.tag).join(', ')}`);
  }
  if (data.topGenres?.length) {
    subtitleParts.push(`Your top genres: ${data.topGenres.map((t) => `${t.genre} (${t.hours}h)`).join(', ')}`);
  }
  recsSubtitleEl.textContent = subtitleParts.join(' · ');

  recsListEl.innerHTML = data.recommendations
    .map((g) => {
      const lines = [];
      if (g.matchedMood?.length) {
        lines.push(
          `<div class="players mood-match">Matches your mood: <strong>${escapeHtml(
            g.matchedMood.map((m) => m.tag).join(', ')
          )}</strong></div>`
        );
      }
      if (g.matchedGenres?.length) {
        lines.push(
          `<div class="players">From your library: <strong>${escapeHtml(
            g.matchedGenres.map((m) => `${m.genre} (${m.hours}h)`).join(', ')
          )}</strong></div>`
        );
      }
      return gameCard(g, lines);
    })
    .join('');
}

async function loadRecommendations() {
  recsSectionEl.hidden = false;
  recsStatusEl.textContent = 'Loading...';
  recsStatusEl.classList.remove('error');
  recsListEl.innerHTML = '';

  try {
    const params = new URLSearchParams(currentMoodAnswers);
    const res = await fetch(`/api/recommendations?${params.toString()}`);
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

function renderMoodForm() {
  moodFormEl.innerHTML =
    moodQuestions
      .map(
        (q) => `
        <fieldset class="mood-question">
          <legend>${escapeHtml(q.question)}</legend>
          ${q.options
            .map(
              (o) => `
              <label class="mood-option">
                <input type="radio" name="${escapeHtml(q.id)}" value="${escapeHtml(o.id)}"
                  ${currentMoodAnswers[q.id] === o.id ? 'checked' : ''} />
                ${escapeHtml(o.label)}
              </label>`
            )
            .join('')}
        </fieldset>`
      )
      .join('') +
    `<div class="mood-form-actions">
       <button type="submit" class="steam-login">Get recommendations</button>
       <button type="button" id="mood-cancel-btn" class="link-btn">Cancel</button>
     </div>`;

  document.getElementById('mood-cancel-btn').addEventListener('click', () => {
    moodFormEl.hidden = true;
  });
}

async function openMoodForm() {
  if (!moodQuestions) {
    try {
      const res = await fetch('/api/mood-questions');
      const data = await res.json();
      moodQuestions = data.questions;
    } catch (err) {
      recsStatusEl.textContent = 'Could not load the mood check-in. Please try again.';
      recsStatusEl.classList.add('error');
      return;
    }
  }
  renderMoodForm();
  moodFormEl.hidden = false;
}

moodBtn.addEventListener('click', () => {
  moodFormEl.hidden ? openMoodForm() : (moodFormEl.hidden = true);
});

moodFormEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(moodFormEl);
  currentMoodAnswers = Object.fromEntries(formData.entries());
  moodClearBtn.hidden = Object.keys(currentMoodAnswers).length === 0;
  moodFormEl.hidden = true;
  await loadRecommendations();
});

moodClearBtn.addEventListener('click', async () => {
  currentMoodAnswers = {};
  moodClearBtn.hidden = true;
  moodFormEl.hidden = true;
  await loadRecommendations();
});

async function loadAuth() {
  try {
    const res = await fetch('/api/me');
    const me = await res.json();
    renderAuthBar(me);
    if (me.loggedIn) {
      moodControlsEl.hidden = false;
      await loadRecommendations();
    }
  } catch (err) {
    renderAuthBar({ loggedIn: false });
  }
}

loadAuth();
