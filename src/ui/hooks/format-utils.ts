const THINKING_VERBS = [
  'Baked', 'Cooked', 'Churned', 'Cogitated', 'Worked',
  'Mulled', 'Pondered', 'Brewed', 'Stewed', 'Crafted',
];

export function randomThinkingVerb(): string {
  return THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
}
