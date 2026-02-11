import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Width of the horizontal rule lines (in '─' characters). */
const BORDER_WIDTH = 48;

/** The horizontal rule string used for top/bottom borders. */
const HR = '─'.repeat(BORDER_WIDTH);

/** Pattern that marks the beginning of an insight block. */
const INSIGHT_START_RE = /^★\s*Insight(?:\s*─|$)/;

/** Pattern that matches a closing horizontal rule line. */
const CLOSING_RULE_RE = /^─{5,}$/;

// ---------------------------------------------------------------------------
// InsightBlock component
// ---------------------------------------------------------------------------

interface InsightBlockProps {
  content: string;
}

/**
 * Renders a "★ Insight" bordered block in the terminal.
 *
 * ```
 * ★ Insight ─────────────────────────────────────
 * Some important finding or learning here.
 * Could be multiple lines.
 * ─────────────────────────────────────────────────
 * ```
 */
export const InsightBlock: React.FC<InsightBlockProps> = ({ content }) => {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      {/* Top border with title */}
      <Box>
        <Text bold color={colors.secondary}>★ Insight </Text>
        <Text color={colors.muted}>{HR}</Text>
      </Box>

      {/* Content area */}
      <Box paddingLeft={2} flexDirection="column">
        {content.split('\n').map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>

      {/* Bottom border */}
      <Text color={colors.muted}>{HR}</Text>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Detection utilities
// ---------------------------------------------------------------------------

/**
 * Check whether a line marks the start of an insight block.
 *
 * Matches lines like:
 * - `★ Insight`
 * - `★ Insight ──────────────────`
 */
export function isInsightBlockStart(line: string): boolean {
  return INSIGHT_START_RE.test(line.trim());
}

/**
 * Extract an insight block from an array-like text starting at `startIndex`.
 *
 * The function splits `text` into lines, expects `lines[startIndex]` to be an
 * insight-block header, and then collects every subsequent line until it finds
 * a closing horizontal rule (`─────…`).
 *
 * @returns `null` if no insight block was found at the given position, or an
 *          object with the extracted `content` and the `endIndex` (the line
 *          index of the closing border).
 */
export function extractInsightBlock(
  text: string,
  startIndex: number,
): { content: string; endIndex: number } | null {
  const lines = text.split('\n');

  // Bounds check
  if (startIndex < 0 || startIndex >= lines.length) {
    return null;
  }

  // The line at startIndex must be an insight block header
  if (!isInsightBlockStart(lines[startIndex]!)) {
    return null;
  }

  const contentLines: string[] = [];

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i]!;

    // A line consisting solely of 5+ '─' characters closes the block.
    if (CLOSING_RULE_RE.test(line.trim())) {
      return {
        content: contentLines.join('\n'),
        endIndex: i,
      };
    }

    contentLines.push(line);
  }

  // No closing border found – not a valid insight block.
  return null;
}
