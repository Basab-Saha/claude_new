// The full "what do you want right now" survey. Most questions map to a
// weighted set of tags (Steam genres/categories, plus best-effort SteamSpy
// community tags for things Steam's official genre list doesn't cover, like
// "Horror", "Cozy", "Souls-like" or "Story Rich"). A few questions (budget,
// dealbreakers, loved/disliked games, recommendation style) need different
// handling than "add a weight" and are computed separately in
// lib/recommendations.js — they're marked `special` here and carry no
// `options[].weights`.

const SECTIONS = [
  { id: 'A', title: 'What do you want right now?' },
  { id: 'B', title: 'Gameplay preferences' },
  { id: 'C', title: 'Progression & motivation' },
  { id: 'D', title: 'Story & atmosphere' },
  { id: 'E', title: 'Social preference' },
  { id: 'F', title: 'Time & commitment' },
  { id: 'G', title: 'Current player state' },
  { id: 'H', title: 'Hardware & practical filters' },
  { id: 'I', title: 'Previous games' },
];

const QUESTIONS = [
  {
    id: 'mainGoal',
    section: 'A',
    type: 'single',
    question: 'What are you mainly looking for from a game today?',
    options: [
      { id: 'A', label: 'Relax and switch my brain off', weights: { Casual: 3, Relaxing: 2, Simulation: 1 } },
      { id: 'B', label: 'Escape into another world', weights: { RPG: 3, Adventure: 2, Fantasy: 1, 'Open World': 1 } },
      { id: 'C', label: 'Feel excitement/adrenaline', weights: { Action: 3, Racing: 1 } },
      { id: 'D', label: 'Challenge myself mentally', weights: { Strategy: 3, Puzzle: 2, Tactical: 1 } },
      { id: 'E', label: 'Feel powerful and make progress', weights: { RPG: 2, Action: 1, Simulation: 1 } },
      { id: 'F', label: 'Experience a great story', weights: { 'Story Rich': 3, Adventure: 2, RPG: 1 } },
      {
        id: 'G',
        label: 'Socialize with other players',
        weights: { 'Multi-player': 2, 'Massively Multiplayer': 2, 'Co-op': 1 },
      },
      { id: 'H', label: 'Explore and discover things', weights: { Adventure: 2, Exploration: 2, 'Open World': 1 } },
      { id: 'I', label: 'Create/build something', weights: { Simulation: 2, 'Base Building': 2, Crafting: 2 } },
      { id: 'J', label: "I don't really know—I just want something that hooks me", weights: {} },
    ],
  },
  {
    id: 'energy',
    section: 'A',
    type: 'single',
    question: 'How is your current energy level?',
    options: [
      { id: 'A', label: 'Very low — I want minimal effort', weights: { Casual: 3, Relaxing: 2 } },
      { id: 'B', label: 'Low — I can play, but nothing demanding', weights: { Casual: 2 } },
      { id: 'C', label: 'Normal', weights: {} },
      { id: 'D', label: 'High — I want something active', weights: { Action: 2, Sports: 1 } },
      { id: 'E', label: 'Very high — give me something intense', weights: { Action: 3, Racing: 1 } },
    ],
  },
  {
    id: 'focus',
    section: 'A',
    type: 'single',
    question: 'How mentally focused do you feel right now?',
    options: [
      { id: 'A', label: 'Very unfocused', weights: { Casual: 2, Relaxing: 1 } },
      { id: 'B', label: 'Slightly distracted', weights: { Casual: 1 } },
      { id: 'C', label: 'Moderately focused', weights: {} },
      { id: 'D', label: 'Very focused', weights: { Strategy: 2, Puzzle: 1 } },
      {
        id: 'E',
        label: 'I actively want something complicated to think about',
        weights: { Strategy: 3, 'Turn-Based Strategy': 2, Simulation: 1 },
      },
    ],
  },
  {
    id: 'stress',
    section: 'A',
    type: 'single',
    question: 'How stressed or mentally overloaded do you currently feel?',
    options: [
      { id: 'A', label: 'Very stressed — I want something comforting', weights: { Casual: 2, Cozy: 2, Relaxing: 2 } },
      { id: 'B', label: 'Somewhat stressed', weights: { Casual: 1 } },
      { id: 'C', label: 'Neutral', weights: {} },
      { id: 'D', label: 'Pretty relaxed', weights: {} },
      { id: 'E', label: "I'm relaxed and actively want tension/challenge", weights: { Difficult: 2, Horror: 1 } },
    ],
  },
  {
    id: 'patience',
    section: 'A',
    type: 'single',
    question: 'How patient are you feeling?',
    options: [
      { id: 'A', label: 'Almost no patience', weights: { Casual: 2 } },
      { id: 'B', label: 'I can tolerate a little learning', weights: {} },
      { id: 'C', label: 'Average patience', weights: {} },
      { id: 'D', label: "I don't mind learning complicated systems", weights: { Strategy: 2, Simulation: 1 } },
      { id: 'E', label: 'I love games that take hours to understand', weights: { Strategy: 3, Simulation: 2, Management: 1 } },
    ],
  },
  {
    id: 'frustrationTolerance',
    section: 'A',
    type: 'single',
    question: 'How much frustration can you tolerate today?',
    options: [
      { id: 'A', label: 'Almost none', weights: { Casual: 2 } },
      { id: 'B', label: 'A little', weights: {} },
      { id: 'C', label: 'Moderate amounts', weights: {} },
      { id: 'D', label: 'Quite a lot', weights: { Difficult: 2 } },
      { id: 'E', label: 'I specifically want a difficult game', weights: { Difficult: 3, 'Souls-like': 2 } },
    ],
  },
  {
    id: 'gameplayTypes',
    section: 'B',
    type: 'multi',
    maxSelect: 3,
    question: 'Which type of gameplay sounds most appealing?',
    options: [
      { id: 'A', label: 'Shooting/combat', weights: { Action: 2, Shooter: 2 } },
      { id: 'B', label: 'Melee combat', weights: { Action: 2, 'Hack and Slash': 1 } },
      { id: 'C', label: 'Exploration', weights: { Adventure: 2, Exploration: 2 } },
      { id: 'D', label: 'Building/crafting', weights: { Simulation: 2, 'Base Building': 2, Crafting: 2 } },
      { id: 'E', label: 'Strategy/management', weights: { Strategy: 2, Management: 2 } },
      { id: 'F', label: 'Puzzle solving', weights: { Puzzle: 3 } },
      { id: 'G', label: 'Driving/racing', weights: { Racing: 3 } },
      { id: 'H', label: 'Stealth', weights: { Stealth: 3, Action: 1 } },
      { id: 'I', label: 'Survival', weights: { Survival: 3 } },
      { id: 'J', label: 'Platforming/movement', weights: { Platformer: 3 } },
      { id: 'K', label: 'RPG progression', weights: { RPG: 3 } },
      { id: 'L', label: 'Simulation', weights: { Simulation: 3 } },
      { id: 'M', label: 'Automation/optimization', weights: { Automation: 3, Management: 1 } },
      { id: 'N', label: 'Dialogue/decision-making', weights: { 'Story Rich': 2, Adventure: 1, RPG: 1 } },
      { id: 'O', label: 'Horror/suspense', weights: { Horror: 3 } },
      { id: 'P', label: 'Sandbox/freeform gameplay', weights: { Sandbox: 2, 'Open World': 2 } },
    ],
  },
  {
    id: 'combatImportance',
    section: 'B',
    type: 'single',
    question: 'How important is combat?',
    options: [
      { id: 'A', label: 'I prefer games with no combat', weights: {} },
      { id: 'B', label: 'Fine occasionally', weights: {} },
      { id: 'C', label: 'I like a balance', weights: {} },
      { id: 'D', label: 'Combat should be a major part', weights: { Action: 2 } },
      { id: 'E', label: "Combat is basically what I'm here for", weights: { Action: 3, Shooter: 1 } },
    ],
  },
  {
    id: 'combatPace',
    section: 'B',
    type: 'single',
    question: 'What combat pace do you prefer?',
    options: [
      { id: 'A', label: 'Turn-based/tactical', weights: { 'Turn-Based': 2, Strategy: 2, Tactical: 1 } },
      { id: 'B', label: 'Slow and methodical', weights: { Simulation: 1, Strategy: 1 } },
      { id: 'C', label: 'Moderate', weights: {} },
      { id: 'D', label: 'Fast action', weights: { Action: 2 } },
      { id: 'E', label: 'Extremely fast/intense', weights: { Action: 3, Racing: 1 } },
      { id: 'F', label: "I don't care about combat", weights: {} },
    ],
  },
  {
    id: 'freedom',
    section: 'B',
    type: 'single',
    question: 'How much freedom do you want?',
    options: [
      { id: 'A', label: 'Very linear — tell me where to go', weights: {} },
      { id: 'B', label: 'Mostly linear with some exploration', weights: { Adventure: 1 } },
      { id: 'C', label: 'A mixture', weights: {} },
      { id: 'D', label: 'Large areas with freedom', weights: { 'Open World': 2, Adventure: 1 } },
      { id: 'E', label: 'Full sandbox/open world', weights: { Sandbox: 3, 'Open World': 3 } },
    ],
  },
  {
    id: 'systemComplexity',
    section: 'B',
    type: 'single',
    question: "How complicated can the game's systems be?",
    options: [
      { id: 'A', label: 'Extremely simple', weights: { Casual: 2 } },
      { id: 'B', label: 'Easy to learn', weights: { Casual: 1 } },
      { id: 'C', label: 'Moderate complexity', weights: {} },
      { id: 'D', label: 'Complex systems are welcome', weights: { Strategy: 2, Simulation: 2 } },
      {
        id: 'E',
        label: 'Give me spreadsheets, skill trees, economies, crafting systems, optimization, etc.',
        weights: { Strategy: 3, Simulation: 3, Management: 2, RPG: 1 },
      },
    ],
  },
  {
    id: 'motivation',
    section: 'C',
    type: 'multi',
    maxSelect: 3,
    question: 'What makes you want to continue playing?',
    options: [
      { id: 'A', label: "Finding out what happens in the story", weights: { 'Story Rich': 3, Adventure: 1 } },
      { id: 'B', label: 'Becoming stronger', weights: { RPG: 2 } },
      { id: 'C', label: 'Unlocking abilities/equipment', weights: { RPG: 2, Action: 1 } },
      { id: 'D', label: 'Improving my own mechanical skill', weights: { Difficult: 1, Action: 1 } },
      { id: 'E', label: 'Building something impressive', weights: { 'Base Building': 2, Simulation: 2 } },
      { id: 'F', label: 'Discovering new places', weights: { Exploration: 2, Adventure: 1 } },
      { id: 'G', label: 'Collecting things', weights: { RPG: 1, Adventure: 1 } },
      { id: 'H', label: 'Solving difficult problems', weights: { Puzzle: 2, Strategy: 1 } },
      { id: 'I', label: 'Competing with others', weights: { PvP: 2, 'Multi-player': 1 } },
      { id: 'J', label: 'Completing objectives/achievements', weights: {} },
      { id: 'K', label: 'Watching numbers/resources grow', weights: { Simulation: 2, Management: 2 } },
      { id: 'L', label: 'Creating my own goals', weights: { Sandbox: 2, 'Open World': 1 } },
    ],
  },
  {
    id: 'rampUp',
    section: 'C',
    type: 'single',
    question: 'How quickly should a game become enjoyable?',
    options: [
      { id: 'A', label: 'Within 5–10 minutes', weights: { Casual: 2 } },
      { id: 'B', label: 'Within the first hour', weights: {} },
      { id: 'C', label: "I'm okay with 2–3 hours of setup", weights: { Strategy: 1, Simulation: 1 } },
      { id: 'D', label: "I'll tolerate a slow beginning for a great game", weights: { RPG: 1, 'Story Rich': 1 } },
      { id: 'E', label: 'I actually enjoy slowly learning complicated games', weights: { Strategy: 2, Simulation: 2 } },
    ],
  },
  {
    id: 'grinding',
    section: 'C',
    type: 'single',
    question: 'How do you feel about grinding?',
    options: [
      { id: 'A', label: 'Hate it', weights: {} },
      { id: 'B', label: 'Small amounts are okay', weights: {} },
      { id: 'C', label: "Don't mind it", weights: { RPG: 1 } },
      { id: 'D', label: 'I enjoy progression grinding', weights: { RPG: 2, 'Massively Multiplayer': 1 } },
      { id: 'E', label: 'Grinding is relaxing for me', weights: { RPG: 2, Simulation: 2, Relaxing: 1 } },
    ],
  },
  {
    id: 'difficulty',
    section: 'C',
    type: 'single',
    question: 'What kind of difficulty feels satisfying?',
    options: [
      { id: 'A', label: 'Very easy/cozy', weights: { Casual: 2, Cozy: 2 } },
      { id: 'B', label: 'Mostly easy', weights: { Casual: 1 } },
      { id: 'C', label: 'Balanced', weights: {} },
      { id: 'D', label: 'Challenging', weights: { Difficult: 2 } },
      { id: 'E', label: 'Very difficult', weights: { Difficult: 3 } },
      { id: 'F', label: 'Brutal—repeated failure is part of the fun', weights: { Difficult: 3, 'Souls-like': 3 } },
    ],
  },
  {
    id: 'storyImportance',
    section: 'D',
    type: 'single',
    question: 'How important is story?',
    options: [
      { id: 'A', label: 'Not important', weights: {} },
      { id: 'B', label: 'Nice bonus', weights: {} },
      { id: 'C', label: 'Moderately important', weights: { 'Story Rich': 1 } },
      { id: 'D', label: 'Very important', weights: { 'Story Rich': 2, Adventure: 1 } },
      { id: 'E', label: "Story is one of my main reasons for playing", weights: { 'Story Rich': 3, RPG: 1, Adventure: 1 } },
    ],
  },
  {
    id: 'atmosphere',
    section: 'D',
    type: 'multi',
    maxSelect: 3,
    question: 'What atmosphere are you in the mood for?',
    options: [
      { id: 'A', label: 'Cozy', weights: { Cozy: 3, Casual: 1 } },
      { id: 'B', label: 'Funny/lighthearted', weights: { Funny: 3 } },
      { id: 'C', label: 'Beautiful/peaceful', weights: { Relaxing: 2, Adventure: 1 } },
      { id: 'D', label: 'Mysterious', weights: { Mystery: 3 } },
      { id: 'E', label: 'Epic/adventurous', weights: { Adventure: 2, RPG: 1 } },
      { id: 'F', label: 'Dark', weights: { Dark: 3 } },
      { id: 'G', label: 'Melancholic/emotional', weights: { 'Story Rich': 2, Dark: 1 } },
      { id: 'H', label: 'Horror/disturbing', weights: { Horror: 3 } },
      { id: 'I', label: 'Realistic/gritty', weights: { Simulation: 1, Dark: 1 } },
      { id: 'J', label: 'Sci-fi/futuristic', weights: { 'Sci-fi': 3 } },
      { id: 'K', label: 'Fantasy/magical', weights: { Fantasy: 3, RPG: 1 } },
      { id: 'L', label: 'Historical', weights: { Historical: 3 } },
      { id: 'M', label: 'Weird/surreal', weights: { Surreal: 2 } },
    ],
  },
  {
    id: 'emotionalWeight',
    section: 'D',
    type: 'single',
    question: 'How emotionally heavy can the game be right now?',
    options: [
      { id: 'A', label: 'Keep it comforting and positive', weights: { Cozy: 2, Casual: 1, Funny: 1 } },
      { id: 'B', label: 'Some serious moments are fine', weights: {} },
      { id: 'C', label: 'Anything is okay', weights: {} },
      { id: 'D', label: 'I want something emotional', weights: { 'Story Rich': 2, Dark: 1 } },
      { id: 'E', label: 'Dark/heavy themes are specifically welcome', weights: { Dark: 2, 'Story Rich': 1 } },
    ],
  },
  {
    id: 'socialMode',
    section: 'E',
    type: 'single',
    question: 'How do you want to play?',
    options: [
      { id: 'A', label: 'Completely alone', weights: { 'Single-player': 3 } },
      { id: 'B', label: 'Mostly single-player', weights: { 'Single-player': 2 } },
      { id: 'C', label: 'Either single-player or multiplayer', weights: {} },
      { id: 'D', label: 'Cooperative multiplayer', weights: { 'Co-op': 3, 'Multi-player': 1 } },
      { id: 'E', label: 'Competitive multiplayer', weights: { PvP: 3, 'Multi-player': 1 } },
      { id: 'F', label: 'MMO/shared-world experience', weights: { 'Massively Multiplayer': 3, MMO: 2 } },
    ],
  },
  {
    id: 'interactionLevel',
    section: 'E',
    type: 'single',
    question: 'If multiplayer, how much interaction do you want?',
    showIf: { question: 'socialMode', in: ['D', 'E', 'F'] },
    options: [
      { id: 'A', label: 'Almost none', weights: { 'Single-player': 1 } },
      { id: 'B', label: 'Players around me, but little communication', weights: { 'Massively Multiplayer': 1 } },
      { id: 'C', label: 'Casual cooperation', weights: { 'Co-op': 2 } },
      { id: 'D', label: 'Teamwork and communication', weights: { 'Co-op': 2, 'Multi-player': 1 } },
      { id: 'E', label: 'Highly coordinated/competitive interaction', weights: { PvP: 2, 'Multi-player': 1 } },
    ],
  },
  {
    id: 'sessionLength',
    section: 'F',
    type: 'single',
    question: 'How long is your typical gaming session?',
    options: [
      { id: 'A', label: 'Under 20 minutes', weights: { Casual: 2 } },
      { id: 'B', label: '20–45 minutes', weights: { Casual: 1 } },
      { id: 'C', label: '45–90 minutes', weights: {} },
      { id: 'D', label: '1.5–3 hours', weights: { RPG: 1, Strategy: 1 } },
      { id: 'E', label: '3+ hours', weights: { RPG: 2, 'Massively Multiplayer': 1, Simulation: 1 } },
    ],
  },
  {
    id: 'totalLength',
    section: 'F',
    type: 'single',
    question: 'What total game length sounds best?',
    options: [
      { id: 'A', label: 'Under 5 hours', weights: { Casual: 1 } },
      { id: 'B', label: '5–15 hours', weights: {} },
      { id: 'C', label: '15–30 hours', weights: { Adventure: 1 } },
      { id: 'D', label: '30–60 hours', weights: { RPG: 1 } },
      { id: 'E', label: '60–100 hours', weights: { RPG: 2, Strategy: 1 } },
      { id: 'F', label: 'Hundreds of hours/replayable indefinitely', weights: { 'Massively Multiplayer': 2, RPG: 1, Roguelike: 1 } },
      { id: 'G', label: "Doesn't matter", weights: {} },
    ],
  },
  {
    id: 'pauseFriendliness',
    section: 'F',
    type: 'single',
    question: 'Do you want a game you can easily leave for several days and return to?',
    options: [
      { id: 'A', label: 'Very important', weights: { Casual: 1 } },
      { id: 'B', label: 'Preferably', weights: {} },
      { id: 'C', label: "Doesn't matter", weights: {} },
      { id: 'D', label: "I don't mind needing to remember systems/story", weights: { RPG: 1, Strategy: 1 } },
      { id: 'E', label: 'I want something I can become deeply invested in', weights: { RPG: 2, 'Story Rich': 1, 'Massively Multiplayer': 1 } },
    ],
  },
  {
    id: 'currentMood',
    section: 'G',
    type: 'single',
    question: 'What best describes your current mood?',
    options: [
      { id: 'A', label: 'Tired', weights: { Casual: 2, Relaxing: 2 } },
      { id: 'B', label: 'Stressed', weights: { Cozy: 2, Relaxing: 2 } },
      { id: 'C', label: 'Bored', weights: { Action: 1, Adventure: 1, Surreal: 1 } },
      { id: 'D', label: 'Restless', weights: { Action: 2 } },
      { id: 'E', label: 'Lonely/social', weights: { 'Multi-player': 2, 'Co-op': 1 } },
      { id: 'F', label: 'Curious', weights: { Exploration: 2, Mystery: 1 } },
      { id: 'G', label: 'Focused', weights: { Strategy: 2, Puzzle: 1 } },
      { id: 'H', label: 'Competitive', weights: { PvP: 2 } },
      { id: 'I', label: 'Creative', weights: { Simulation: 2, 'Base Building': 1 } },
      { id: 'J', label: 'Adventurous', weights: { Adventure: 2, 'Open World': 1 } },
      { id: 'K', label: 'Emotionally reflective', weights: { 'Story Rich': 2, Dark: 1 } },
      { id: 'L', label: 'Pretty neutral', weights: {} },
    ],
  },
  {
    id: 'quitTriggers',
    section: 'G',
    type: 'multi',
    maxSelect: 3,
    question: 'What would make you quit a game tonight?',
    note: 'These count against a game, not for it.',
    options: [
      { id: 'A', label: 'Too much reading', weights: { 'Story Rich': -2 } },
      { id: 'B', label: 'Too difficult', weights: { Difficult: -2, 'Souls-like': -2 } },
      { id: 'C', label: 'Too slow', weights: { Simulation: -1, Strategy: -1 } },
      { id: 'D', label: 'Too repetitive', weights: { 'Massively Multiplayer': -1, RPG: -1 } },
      { id: 'E', label: 'Too complicated', weights: { Strategy: -1, Simulation: -1 } },
      { id: 'F', label: 'Too stressful', weights: { Difficult: -1, PvP: -1 } },
      { id: 'G', label: 'Too much dialogue', weights: { 'Story Rich': -1 } },
      { id: 'H', label: 'Too much grinding', weights: { RPG: -1, 'Massively Multiplayer': -1 } },
      { id: 'I', label: 'Weak story', weights: {} },
      { id: 'J', label: 'Constant multiplayer competition', weights: { PvP: -2 } },
      { id: 'K', label: 'Having to memorize lots of controls', weights: { Action: -1, Strategy: -1 } },
      { id: 'L', label: 'Long tutorials', weights: { Strategy: -1, Simulation: -1 } },
    ],
  },
  {
    id: 'idealOutcome',
    section: 'G',
    type: 'single',
    question: "Imagine you've played for two hours. Which outcome would make you happiest?",
    options: [
      { id: 'A', label: '"That was incredibly relaxing."', weights: { Casual: 2, Relaxing: 2 } },
      { id: 'B', label: '"I completely forgot about everything else."', weights: { RPG: 2, Adventure: 1, 'Open World': 1 } },
      { id: 'C', label: '"I accomplished so much."', weights: { Simulation: 2, Management: 1, RPG: 1 } },
      { id: 'D', label: '"That story was amazing."', weights: { 'Story Rich': 3 } },
      { id: 'E', label: '"I finally mastered something difficult."', weights: { Difficult: 2, 'Souls-like': 1 } },
      { id: 'F', label: '"That was hilarious."', weights: { Funny: 3 } },
      { id: 'G', label: '"I discovered so many interesting things."', weights: { Exploration: 2, Adventure: 1 } },
      { id: 'H', label: '"I built something awesome."', weights: { 'Base Building': 2, Simulation: 2 } },
      { id: 'I', label: '"That was intense."', weights: { Action: 2, Horror: 1 } },
      { id: 'J', label: '"I had a great time with other people."', weights: { 'Multi-player': 2, 'Co-op': 2 } },
    ],
  },
  {
    id: 'device',
    section: 'H',
    type: 'single',
    question: 'What device are you playing on?',
    options: [
      { id: 'A', label: 'Low-end PC/laptop', weights: {} },
      { id: 'B', label: 'Mid-range PC', weights: {} },
      { id: 'C', label: 'High-end gaming PC', weights: {} },
      { id: 'D', label: 'Steam Deck', weights: { 'Full controller support': 2 } },
      { id: 'E', label: 'Other handheld PC', weights: { 'Full controller support': 2 } },
    ],
  },
  {
    id: 'controlMethod',
    section: 'H',
    type: 'single',
    question: 'Preferred control method?',
    options: [
      { id: 'A', label: 'Keyboard + mouse', weights: {} },
      { id: 'B', label: 'Controller', weights: { 'Full controller support': 2 } },
      { id: 'C', label: 'Either', weights: {} },
      { id: 'D', label: "Doesn't matter", weights: {} },
    ],
  },
  // --- special questions below: handled explicitly in lib/recommendations.js ---
  {
    id: 'budget',
    section: 'H',
    type: 'single',
    special: true,
    question: "What's your budget?",
    options: [
      { id: 'A', label: 'Free-to-play only' },
      { id: 'B', label: 'Under $10' },
      { id: 'C', label: 'Under $20' },
      { id: 'D', label: 'Under $40' },
      { id: 'E', label: 'Under $60' },
      { id: 'F', label: "Price isn't important" },
      { id: 'G', label: 'Prefer games currently discounted' },
    ],
  },
  {
    id: 'dealbreakers',
    section: 'H',
    type: 'multi',
    special: true,
    question: 'Are any of these deal-breakers?',
    options: [
      { id: 'A', label: 'Microtransactions' },
      { id: 'B', label: 'Always-online requirement' },
      { id: 'C', label: 'Early Access' },
      { id: 'D', label: 'PvP' },
      { id: 'E', label: 'Procedural generation' },
      { id: 'F', label: 'Permadeath' },
      { id: 'G', label: 'Roguelike structure' },
      { id: 'H', label: 'Horror/jump scares' },
      { id: 'I', label: 'Sexual content' },
      { id: 'J', label: 'Graphic violence/gore' },
      { id: 'K', label: 'Very long cutscenes' },
      { id: 'L', label: 'No deal-breakers here' },
    ],
  },
  {
    id: 'lovedGames',
    section: 'I',
    type: 'text',
    special: true,
    question: 'Name 3–5 games you LOVE.',
    placeholder: 'e.g. Hades, Stardew Valley, Elden Ring',
  },
  {
    id: 'dislikedGames',
    section: 'I',
    type: 'text',
    special: true,
    question: "Name 3–5 popular games you DIDN'T enjoy.",
    placeholder: 'e.g. Fortnite, Destiny 2',
  },
  {
    id: 'mostPlayedGame',
    section: 'I',
    type: 'text',
    special: true,
    question: 'What game have you played the most?',
    placeholder: 'Game name',
  },
  {
    id: 'replayWish',
    section: 'I',
    type: 'text',
    special: true,
    question: 'What game do you wish you could experience for the first time again?',
    placeholder: 'Game name',
  },
  {
    id: 'recommendationStyle',
    section: 'I',
    type: 'single',
    special: true,
    question: 'Finally, what kind of recommendation do you want?',
    options: [
      { id: 'A', label: 'Safest match for my preferences' },
      { id: 'B', label: 'Something similar to games I already love' },
      { id: 'C', label: 'Something completely different that I might unexpectedly enjoy' },
      { id: 'D', label: 'Hidden/underrated games' },
      { id: 'E', label: "Popular/highly regarded games I haven't tried" },
      { id: 'F', label: 'A mixture of safe and experimental recommendations' },
    ],
  },
];

// Steam's official appdetails "price is under a cap" style budget answers.
const BUDGET_CAPS = { B: 10, C: 20, D: 40, E: 60 };

// Dealbreaker id -> tags (genres/categories/community tags) that, if a
// candidate carries any of them, rule it out entirely. B (always-online) and
// K (long cutscenes) have no reliable public signal and are intentionally
// left unenforced.
const DEALBREAKER_RULES = {
  A: ['In-App Purchases'],
  C: ['Early Access'],
  D: ['PvP', 'Online PvP'],
  E: ['Procedural Generation'],
  F: ['Permadeath'],
  G: ['Roguelike', 'Rogue-like', 'Rogue-lite', 'Roguelite'],
  H: ['Horror'],
  I: ['Sexual Content', 'Nudity'],
  J: ['Violent', 'Gore'],
};

function publicSurveyQuestions() {
  return {
    sections: SECTIONS,
    questions: QUESTIONS.map((q) => ({
      id: q.id,
      section: q.section,
      type: q.type,
      question: q.question,
      note: q.note,
      maxSelect: q.maxSelect,
      placeholder: q.placeholder,
      showIf: q.showIf,
      options: q.options?.map((o) => ({ id: o.id, label: o.label })),
    })),
  };
}

// answers: { [questionId]: optionId | optionId[] } for single/multi
// questions only — special questions are read directly by the caller.
function computeSurveyWeights(answers) {
  const weights = new Map();
  if (!answers) return weights;

  for (const q of QUESTIONS) {
    if (q.special) continue;
    const answer = answers[q.id];
    if (!answer) continue;
    const chosenIds = Array.isArray(answer) ? answer : [answer];

    for (const chosenId of chosenIds) {
      const option = q.options.find((o) => o.id === chosenId);
      if (!option) continue;
      for (const [tag, w] of Object.entries(option.weights)) {
        weights.set(tag, (weights.get(tag) || 0) + w);
      }
    }
  }
  return weights;
}

module.exports = {
  SECTIONS,
  QUESTIONS,
  BUDGET_CAPS,
  DEALBREAKER_RULES,
  publicSurveyQuestions,
  computeSurveyWeights,
};
