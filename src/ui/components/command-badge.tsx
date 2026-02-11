import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Background color for the command badge (subtle dark blue-ish). */
const BADGE_BG_COLOR = '#2a2a3a';

/**
 * Pattern to detect slash commands in text.
 *
 * Matches a `/` followed by a lowercase letter, then at least 2 more
 * lowercase letters, digits, or hyphens. The slash must appear at the
 * start of the string or be preceded by whitespace so that file paths
 * like `/usr/bin` or `/src/ui` are not matched.
 */
const COMMAND_PATTERN = /(?:^|(?<=\s))\/[a-z][a-z0-9-]{2,}/g;

// ---------------------------------------------------------------------------
// CommandBadge component
// ---------------------------------------------------------------------------

interface CommandBadgeProps {
  /** The slash command text to display (e.g., `/commit-push-pr`). */
  command: string;
}

/**
 * Renders a slash command as a visual badge in the terminal.
 *
 * ```
 * ✔ /commit-push-pr
 * ```
 *
 * The command text is displayed with a colored background and the primary
 * (cyan) text color. A green checkmark prefix indicates completion.
 */
export const CommandBadge: React.FC<CommandBadgeProps> = ({ command }) => {
  return (
    <Box>
      <Text color={colors.success}>{'✔ '}</Text>
      <Box>
        <Text backgroundColor={BADGE_BG_COLOR} color={colors.primary}>
          {` ${command} `}
        </Text>
      </Box>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Detection utilities
// ---------------------------------------------------------------------------

/**
 * Detect slash command patterns in a string and return their positions.
 *
 * Each match includes the command text (including the leading `/`), the
 * zero-based `index` where it starts in `text`, and its `length`.
 *
 * File-path-like patterns (e.g., `/usr/bin`) are excluded because the
 * regex requires the slash to appear at the start of the string or after
 * whitespace.
 *
 * @example
 * ```ts
 * extractCommandBadges('ran /commit-push-pr successfully');
 * // => [{ command: '/commit-push-pr', index: 4, length: 16 }]
 * ```
 */
export function extractCommandBadges(
  text: string,
): { command: string; index: number; length: number }[] {
  const results: { command: string; index: number; length: number }[] = [];

  // Reset lastIndex in case the regex was previously used.
  COMMAND_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = COMMAND_PATTERN.exec(text)) !== null) {
    results.push({
      command: match[0],
      index: match.index,
      length: match[0].length,
    });
  }

  return results;
}

/**
 * Check whether `text` contains at least one slash command pattern.
 *
 * This is a lightweight check that avoids allocating an array of matches
 * when the caller only needs a boolean answer.
 */
export function hasCommandPattern(text: string): boolean {
  // Reset lastIndex before testing.
  COMMAND_PATTERN.lastIndex = 0;
  return COMMAND_PATTERN.test(text);
}
