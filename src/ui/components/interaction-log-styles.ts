// ---------------------------------------------------------------------------
// Re-exports from the centralised theme module.
// Existing consumers (e.g. tool-group-entry.tsx) continue to work unchanged.
// ---------------------------------------------------------------------------

export { STYLE_MAP, MAX_LINE_LENGTH } from '../theme.js';
export type { StyleDef } from '../theme.js';

// ---------------------------------------------------------------------------
// Helpers (view-layer utilities – kept here rather than in the theme)
// ---------------------------------------------------------------------------

import { MAX_LINE_LENGTH } from '../theme.js';

export function truncateLine(text: string): string {
  const firstLine = text.split('\n')[0];
  if (firstLine.length <= MAX_LINE_LENGTH) {
    return firstLine;
  }
  return firstLine.slice(0, MAX_LINE_LENGTH - 3) + '...';
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k tokens`;
  }
  return `${tokens} tokens`;
}

export { formatMs, formatMs as formatDuration } from '../../utils/format.js';
