// ---------------------------------------------------------------------------
// Diff parser utility
//
// Parses tool result text from Edit/Write tools into structured diff lines
// for colored rendering in the UI.
// ---------------------------------------------------------------------------

export interface DiffLine {
  type: 'added' | 'removed' | 'context';
  lineNumber: number;
  text: string;
}

export interface DiffData {
  addedCount: number;
  removedCount: number;
  lines: DiffLine[];
}

/**
 * Parse Edit tool input (old_string / new_string) into structured diff data.
 *
 * Uses the tool's `old_string` and `new_string` input fields to produce a
 * unified-diff-style output with context lines, removed lines, and added lines.
 */
export function parseDiffFromEditInput(
  toolInput: Record<string, unknown>,
): DiffData | null {
  const oldStr = toolInput.old_string;
  const newStr = toolInput.new_string;

  if (typeof oldStr !== 'string' || typeof newStr !== 'string') {
    return null;
  }

  // Split into lines
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');

  // Build diff using a simple approach: show context + removals + additions
  const lines: DiffLine[] = [];
  let addedCount = 0;
  let removedCount = 0;

  // Simple LCS-based diff for better line alignment
  const diffResult = computeLineDiff(oldLines, newLines);

  // We want to show only a few context lines around changes
  const CONTEXT_LINES = 2;
  const changeIndices = new Set<number>();
  for (let i = 0; i < diffResult.length; i++) {
    if (diffResult[i].type !== 'context') {
      for (let j = Math.max(0, i - CONTEXT_LINES); j <= Math.min(diffResult.length - 1, i + CONTEXT_LINES); j++) {
        changeIndices.add(j);
      }
    }
  }

  for (let i = 0; i < diffResult.length; i++) {
    if (!changeIndices.has(i)) continue;
    const entry = diffResult[i];
    lines.push(entry);
    if (entry.type === 'added') addedCount++;
    if (entry.type === 'removed') removedCount++;
  }

  if (lines.length === 0) {
    return null;
  }

  return { addedCount, removedCount, lines };
}

/**
 * Compute a line-level diff between old and new lines.
 *
 * Uses a simple approach: finds matching lines using LCS (Longest Common
 * Subsequence) to determine context vs added/removed.
 */
function computeLineDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  // Find LCS to determine which lines are shared
  const lcs = longestCommonSubsequence(oldLines, newLines);

  const result: DiffLine[] = [];
  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  // Track line numbers for old and new separately
  let oldLineNum = 1;
  let newLineNum = 1;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length) {
      // Remove old lines not in LCS
      while (oldIdx < oldLines.length && oldLines[oldIdx] !== lcs[lcsIdx]) {
        result.push({ type: 'removed', lineNumber: oldLineNum, text: oldLines[oldIdx] });
        oldIdx++;
        oldLineNum++;
      }
      // Add new lines not in LCS
      while (newIdx < newLines.length && newLines[newIdx] !== lcs[lcsIdx]) {
        result.push({ type: 'added', lineNumber: newLineNum, text: newLines[newIdx] });
        newIdx++;
        newLineNum++;
      }
      // Matching line (context)
      if (oldIdx < oldLines.length && newIdx < newLines.length) {
        result.push({ type: 'context', lineNumber: newLineNum, text: lcs[lcsIdx] });
        oldIdx++;
        newIdx++;
        oldLineNum++;
        newLineNum++;
        lcsIdx++;
      }
    } else {
      // Remaining old lines are removals
      while (oldIdx < oldLines.length) {
        result.push({ type: 'removed', lineNumber: oldLineNum, text: oldLines[oldIdx] });
        oldIdx++;
        oldLineNum++;
      }
      // Remaining new lines are additions
      while (newIdx < newLines.length) {
        result.push({ type: 'added', lineNumber: newLineNum, text: newLines[newIdx] });
        newIdx++;
        newLineNum++;
      }
    }
  }

  return result;
}

/**
 * Compute the Longest Common Subsequence of two string arrays.
 */
function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the actual subsequence
  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * Parse result text lines for lines starting with `+` or `-` and colorize them.
 *
 * This is a fallback parser when we don't have the structured old_string/new_string
 * data. It detects unified-diff-style lines in the result text.
 */
export function parseDiffFromResultLines(resultLines: string[]): DiffData | null {
  const lines: DiffLine[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let lineNum = 1;
  let hasDiffLines = false;

  for (const line of resultLines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      lines.push({ type: 'added', lineNumber: lineNum, text: line.slice(1) });
      addedCount++;
      hasDiffLines = true;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      lines.push({ type: 'removed', lineNumber: lineNum, text: line.slice(1) });
      removedCount++;
      hasDiffLines = true;
    } else {
      lines.push({ type: 'context', lineNumber: lineNum, text: line });
    }
    lineNum++;
  }

  if (!hasDiffLines) {
    return null;
  }

  return { addedCount, removedCount, lines };
}
