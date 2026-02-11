import React from 'react';
import { Text, Box } from 'ink';
import { colors } from '../theme.js';

// ---------------------------------------------------------------------------
// Token types produced by the inline tokenizer
// ---------------------------------------------------------------------------

interface PlainToken {
  type: 'plain';
  value: string;
}

interface BoldToken {
  type: 'bold';
  value: string;
}

interface InlineCodeToken {
  type: 'code';
  value: string;
}

interface UrlToken {
  type: 'url';
  value: string;
}

interface FileNameToken {
  type: 'filename';
  value: string;
}

type Token = PlainToken | BoldToken | InlineCodeToken | UrlToken | FileNameToken;

// ---------------------------------------------------------------------------
// Regex patterns (ordered by priority – earlier patterns win)
// ---------------------------------------------------------------------------

const FILE_EXTENSIONS =
  'md|ts|tsx|js|json|yaml|yml|swift|graphql|css|html';

const TOKEN_PATTERNS: Array<{ type: Token['type']; regex: RegExp }> = [
  // Inline code: `...`
  { type: 'code',     regex: /`([^`]+)`/ },
  // Bold: **...**
  { type: 'bold',     regex: /\*\*([^*]+)\*\*/ },
  // URLs: https://... or http://...
  { type: 'url',      regex: /https?:\/\/\S+/ },
  // File names: word.ext (must be preceded by whitespace, start-of-string, or common delimiters)
  { type: 'filename', regex: new RegExp(`(?<=^|[\\s\`"'(\\[{,;:])\\w[\\w./-]*\\.(?:${FILE_EXTENSIONS})(?=$|[\\s\`"')\\]},;:])`) },
];

/**
 * Build a single combined regex from all token patterns.
 *
 * Each pattern is wrapped in a named capture group so we can identify which
 * type matched. The combined regex uses the global flag so we can walk
 * through all matches with `exec`.
 */
function buildCombinedRegex(): RegExp {
  const parts = TOKEN_PATTERNS.map(
    (p, i) => `(?<t${i}>${p.regex.source})`,
  );
  return new RegExp(parts.join('|'), 'g');
}

const COMBINED_RE = buildCombinedRegex();

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize a single line of text into a sequence of typed tokens.
 *
 * The function walks the combined regex over the input, emitting plain-text
 * tokens for any gaps between matches.
 */
function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;

  // Reset the sticky index each time we tokenize a new line.
  COMBINED_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = COMBINED_RE.exec(line)) !== null) {
    const matchStart = match.index;
    const fullMatch = match[0];

    // Emit any plain text before this match.
    if (matchStart > lastIndex) {
      tokens.push({ type: 'plain', value: line.slice(lastIndex, matchStart) });
    }

    // Determine which named group matched to find the token type.
    const groups = match.groups ?? {};
    let tokenType: Token['type'] = 'plain';
    for (let i = 0; i < TOKEN_PATTERNS.length; i++) {
      if (groups[`t${i}`] !== undefined) {
        tokenType = TOKEN_PATTERNS[i]!.type;
        break;
      }
    }

    // For bold and inline code, extract the inner content (capture group 1).
    let value: string;
    if (tokenType === 'bold') {
      // Strip the ** delimiters
      value = fullMatch.slice(2, -2);
    } else if (tokenType === 'code') {
      // Strip the backtick delimiters
      value = fullMatch.slice(1, -1);
    } else {
      value = fullMatch;
    }

    tokens.push({ type: tokenType, value });
    lastIndex = matchStart + fullMatch.length;
  }

  // Trailing plain text.
  if (lastIndex < line.length) {
    tokens.push({ type: 'plain', value: line.slice(lastIndex) });
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Renderers for individual tokens
// ---------------------------------------------------------------------------

function renderToken(token: Token, key: number): React.ReactNode {
  switch (token.type) {
    case 'bold':
      return (
        <Text key={key} bold>
          {token.value}
        </Text>
      );
    case 'code':
      return (
        <Text key={key} color={colors.warning}>
          {token.value}
        </Text>
      );
    case 'url':
      return (
        <Text key={key} color={colors.primary} underline>
          {token.value}
        </Text>
      );
    case 'filename':
      return (
        <Text key={key} color={colors.primary}>
          {token.value}
        </Text>
      );
    case 'plain':
    default:
      return <Text key={key}>{token.value}</Text>;
  }
}

// ---------------------------------------------------------------------------
// Line renderer (handles markdown headers)
// ---------------------------------------------------------------------------

function renderLine(line: string, lineKey: number): React.ReactNode {
  // Markdown headers: ## or ### at the start of a line
  const headerMatch = line.match(/^(#{2,3})\s+(.*)$/);
  if (headerMatch) {
    const content = headerMatch[2]!;
    return (
      <Text key={lineKey} bold>
        {content}
      </Text>
    );
  }

  // Normal line – tokenize for inline formatting.
  const tokens = tokenizeLine(line);

  // Optimisation: if the whole line is a single plain token, skip wrapping.
  if (tokens.length === 1 && tokens[0]!.type === 'plain') {
    return <Text key={lineKey}>{tokens[0]!.value}</Text>;
  }

  return (
    <Text key={lineKey}>
      {tokens.map((token, i) => renderToken(token, i))}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export const MarkdownText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');

  // Single-line fast path – no Box wrapper needed.
  if (lines.length === 1) {
    return <>{renderLine(lines[0]!, 0)}</>;
  }

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => renderLine(line, i))}
    </Box>
  );
};
