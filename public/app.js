const authBarEl = document.getElementById('auth-bar');
const signedOutEl = document.getElementById('signed-out');
const surveyControlsEl = document.getElementById('survey-controls');
const surveyBtn = document.getElementById('survey-btn');
const surveyClearBtn = document.getElementById('survey-clear-btn');
const surveyFormEl = document.getElementById('survey-form');
const recsSectionEl = document.getElementById('recs-section');
const recsSubtitleEl = document.getElementById('recs-subtitle');
const recsStatusEl = document.getElementById('recs-status');
const recsListEl = document.getElementById('recs-list');

let surveyDef = null; // { sections, questions }
let currentAnswers = {};

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
    surveyControlsEl.hidden = true;
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
    recsStatusEl.textContent = 'No matches found in the current storefront listings yet — try clearing a filter or two.';
    recsListEl.innerHTML = '';
    recsSubtitleEl.textContent = '';
    return;
  }

  recsStatusEl.textContent = '';

  const subtitleParts = [];
  if (data.surveyApplied && data.topSurveyTags?.length) {
    subtitleParts.push(`Right now: ${data.topSurveyTags.map((t) => t.tag).join(', ')}`);
  }
  if (data.topGenres?.length) {
    subtitleParts.push(`Your top genres: ${data.topGenres.map((t) => `${t.genre} (${t.hours}h)`).join(', ')}`);
  }
  recsSubtitleEl.textContent = subtitleParts.join(' · ');

  recsListEl.innerHTML = data.recommendations
    .map((g) => {
      const lines = [];
      if (g.matchedSurvey?.length) {
        lines.push(
          `<div class="players mood-match">Matches what you want right now: <strong>${escapeHtml(
            g.matchedSurvey.map((m) => m.tag).join(', ')
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
    const hasAnswers = Object.keys(currentAnswers).length > 0;
    const res = await fetch('/api/recommendations', {
      method: hasAnswers ? 'POST' : 'GET',
      headers: hasAnswers ? { 'Content-Type': 'application/json' } : undefined,
      body: hasAnswers ? JSON.stringify(currentAnswers) : undefined,
    });
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

function questionFieldHtml(q) {
  const showIfAttrs = q.showIf
    ? `data-show-if-question="${escapeHtml(q.showIf.question)}" data-show-if-values="${escapeHtml(q.showIf.in.join('|'))}"`
    : '';

  if (q.type === 'text') {
    return `
      <fieldset class="mood-question" ${showIfAttrs}>
        <legend>${escapeHtml(q.question)}</legend>
        <input type="text" name="${escapeHtml(q.id)}" placeholder="${escapeHtml(q.placeholder || '')}" class="survey-text" />
      </fieldset>`;
  }

  const inputType = q.type === 'multi' ? 'checkbox' : 'radio';
  return `
    <fieldset class="mood-question" ${showIfAttrs} ${q.type === 'multi' ? `data-max-select="${q.maxSelect || ''}"` : ''}>
      <legend>${escapeHtml(q.question)}${q.type === 'multi' && q.maxSelect ? ` <span class="max-select-note">(choose up to ${q.maxSelect})</span>` : ''}</legend>
      ${q.note ? `<p class="mood-question-note">${escapeHtml(q.note)}</p>` : ''}
      ${q.options
        .map(
          (o) => `
          <label class="mood-option">
            <input type="${inputType}" name="${escapeHtml(q.id)}" value="${escapeHtml(o.id)}" />
            ${escapeHtml(o.label)}
          </label>`
        )
        .join('')}
    </fieldset>`;
}

function renderSurveyForm() {
  const bySection = surveyDef.sections
    .map((section) => {
      const questions = surveyDef.questions.filter((q) => q.section === section.id);
      if (questions.length === 0) return '';
      return `
        <div class="survey-section">
          <h3>${escapeHtml(section.title)}</h3>
          ${questions.map(questionFieldHtml).join('')}
        </div>`;
    })
    .join('');

  surveyFormEl.innerHTML =
    bySection +
    `<div class="mood-form-actions">
       <button type="submit" class="steam-login">Get recommendations</button>
       <button type="button" id="survey-cancel-btn" class="link-btn">Cancel</button>
     </div>`;

  document.getElementById('survey-cancel-btn').addEventListener('click', () => {
    surveyFormEl.hidden = true;
  });

  enforceMultiSelectLimits();
  updateConditionalVisibility();
}

function enforceMultiSelectLimits() {
  surveyFormEl.querySelectorAll('fieldset[data-max-select]').forEach((fieldset) => {
    const max = Number(fieldset.dataset.maxSelect);
    if (!max) return;
    const checkboxes = [...fieldset.querySelectorAll('input[type="checkbox"]')];
    const checkedCount = checkboxes.filter((c) => c.checked).length;
    checkboxes.forEach((c) => {
      c.disabled = !c.checked && checkedCount >= max;
    });
  });
}

function updateConditionalVisibility() {
  const formData = new FormData(surveyFormEl);
  surveyFormEl.querySelectorAll('fieldset[data-show-if-question]').forEach((fieldset) => {
    const question = fieldset.dataset.showIfQuestion;
    const allowed = fieldset.dataset.showIfValues.split('|');
    const currentValue = formData.get(question);
    fieldset.hidden = !allowed.includes(currentValue);
  });
}

surveyFormEl.addEventListener('change', () => {
  enforceMultiSelectLimits();
  updateConditionalVisibility();
});

async function openSurveyForm() {
  if (!surveyDef) {
    try {
      const res = await fetch('/api/survey-questions');
      surveyDef = await res.json();
    } catch (err) {
      recsStatusEl.textContent = 'Could not load the survey. Please try again.';
      recsStatusEl.classList.add('error');
      return;
    }
  }
  renderSurveyForm();
  surveyFormEl.hidden = false;
  surveyFormEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

surveyBtn.addEventListener('click', () => {
  surveyFormEl.hidden ? openSurveyForm() : (surveyFormEl.hidden = true);
});

surveyFormEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(surveyFormEl);
  const answers = {};

  for (const q of surveyDef.questions) {
    if (q.type === 'multi') {
      const values = formData.getAll(q.id);
      if (values.length) answers[q.id] = values;
    } else {
      const value = formData.get(q.id);
      if (value) answers[q.id] = value.toString().trim();
    }
  }

  currentAnswers = answers;
  surveyClearBtn.hidden = Object.keys(currentAnswers).length === 0;
  surveyFormEl.hidden = true;
  await loadRecommendations();
});

surveyClearBtn.addEventListener('click', async () => {
  currentAnswers = {};
  surveyClearBtn.hidden = true;
  surveyFormEl.hidden = true;
  await loadRecommendations();
});

async function loadAuth() {
  try {
    const res = await fetch('/api/me');
    const me = await res.json();
    renderAuthBar(me);
    if (me.loggedIn) {
      surveyControlsEl.hidden = false;
      await loadRecommendations();
    }
  } catch (err) {
    renderAuthBar({ loggedIn: false });
  }
}

loadAuth();
