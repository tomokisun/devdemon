export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

/**
 * Format a duration in milliseconds to a human-readable string.
 *
 * - >= 60 000 ms -> "Xm Ys"
 * - < 60 000 ms  -> "Xs"
 */
export function formatMs(ms: number): string {
  if (ms >= 60000) {
    const m = Math.floor(ms / 60000);
    const s = Math.round((ms % 60000) / 1000);
    return `${m}m ${s}s`;
  }
  return `${Math.round(ms / 1000)}s`;
}
