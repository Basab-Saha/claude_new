// A short check-in used to bias recommendations toward how the user feels
// right now, on top of (and weighted above) their long-term play history.
// Weights target Steam store "genres" and "categories" — whichever a
// candidate game actually carries is what gets matched.
const MOOD_QUESTIONS = [
  {
    id: 'vibe',
    question: 'What are you in the mood for right now?',
    options: [
      { id: 'relaxed', label: 'Relaxed, low-pressure', weights: { Casual: 3, Simulation: 2, Puzzle: 2 } },
      { id: 'thrilling', label: 'Thrilling and intense', weights: { Action: 3, Racing: 2 } },
      { id: 'emotional', label: 'Story-driven or emotional', weights: { RPG: 3, Adventure: 3 } },
      { id: 'mindbending', label: 'Something that makes me think', weights: { Strategy: 3, Puzzle: 2, Simulation: 1 } },
      {
        id: 'competitive',
        label: 'Competitive or social',
        weights: { 'Massively Multiplayer': 2, Sports: 2, 'Multi-player': 2, PvP: 2 },
      },
    ],
  },
  {
    id: 'energy',
    question: "How's your energy level?",
    options: [
      { id: 'low', label: 'Low — I want to unwind', weights: { Casual: 2, Simulation: 1, Puzzle: 1 } },
      { id: 'medium', label: 'Somewhere in the middle', weights: {} },
      { id: 'high', label: 'High — I want action', weights: { Action: 2, Racing: 1, Sports: 1 } },
    ],
  },
  {
    id: 'time',
    question: 'How much time do you have?',
    options: [
      { id: 'short', label: 'Just a few minutes', weights: { Casual: 2, Puzzle: 1 } },
      { id: 'medium', label: 'An hour or so', weights: {} },
      { id: 'long', label: 'I can sink hours into it', weights: { RPG: 2, Strategy: 2, 'Massively Multiplayer': 1 } },
    ],
  },
  {
    id: 'company',
    question: 'Playing alone or with others?',
    options: [
      { id: 'alone', label: 'Solo', weights: { 'Single-player': 2 } },
      { id: 'others', label: 'With friends / other people', weights: { 'Multi-player': 2, 'Co-op': 2, PvP: 1 } },
      { id: 'either', label: 'Either is fine', weights: {} },
    ],
  },
];

// What the frontend gets: questions and option labels, no weights. Keeping
// the weight mapping server-side is both simpler (one source of truth) and
// means a tampered request can't reweight scoring beyond picking a valid
// option id.
function publicMoodQuestions() {
  return MOOD_QUESTIONS.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options.map((o) => ({ id: o.id, label: o.label })),
  }));
}

// answers: { [questionId]: optionId }
function computeMoodWeights(answers) {
  const weights = new Map();
  if (!answers) return weights;

  for (const q of MOOD_QUESTIONS) {
    const chosenId = answers[q.id];
    if (!chosenId) continue;
    const option = q.options.find((o) => o.id === chosenId);
    if (!option) continue;
    for (const [tag, w] of Object.entries(option.weights)) {
      weights.set(tag, (weights.get(tag) || 0) + w);
    }
  }
  return weights;
}

module.exports = { MOOD_QUESTIONS, publicMoodQuestions, computeMoodWeights };
