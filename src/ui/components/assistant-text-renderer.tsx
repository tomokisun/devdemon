import React from 'react';
import { Box } from 'ink';
import { MarkdownText } from './markdown-text.js';
import { InsightBlock, isInsightBlockStart } from './insight-block.js';
import { MarkdownTable, isTableLine, extractTableLines } from './markdown-table.js';
import { CommandBadge, hasCommandPattern } from './command-badge.js';
import { UserAnswerEntry, isUserAnswerBlock } from './user-answer-entry.js';
import type { UserAnswer } from './user-answer-entry.js';

// ---------------------------------------------------------------------------
// Block types produced by the parser
// ---------------------------------------------------------------------------

interface TextBlock {
  type: 'text';
  content: string;
}

interface InsightBlockDef {
  type: 'insight';
  content: string;
}

interface TableBlock {
  type: 'table';
  lines: string[];
}

interface CommandBlock {
  type: 'command';
  command: string;
}

interface UserAnswerBlockDef {
  type: 'user-answer';
  answers: UserAnswer[];
}

type Block =
  | TextBlock
  | InsightBlockDef
  | TableBlock
  | CommandBlock
  | UserAnswerBlockDef;

// ---------------------------------------------------------------------------
// Closing rule pattern (matches 5+ consecutive '─' characters)
// ---------------------------------------------------------------------------

const CLOSING_RULE_RE = /^─{5,}$/;

// ---------------------------------------------------------------------------
// User answer extraction (parses ⎿ lines following a header)
// ---------------------------------------------------------------------------

function extractUserAnswerLines(
  lines: string[],
  startIndex: number,
): { answers: UserAnswer[]; endIndex: number } {
  const answers: UserAnswer[] = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i]!;
    const match = line.match(/⎿\s+·\s+(.+?)\s+→\s+(.+)/);
    if (match) {
      answers.push({
        question: match[1]!.trim(),
        answer: match[2]!.trim(),
      });
      i++;
    } else {
      break;
    }
  }

  return { answers, endIndex: i };
}

// ---------------------------------------------------------------------------
// Block parser
// ---------------------------------------------------------------------------

/**
 * Parse raw assistant text into an ordered list of typed blocks.
 *
 * The parser scans lines sequentially and detects:
 * 1. Insight blocks (★ Insight ... ───)
 * 2. Markdown tables (consecutive lines starting with `|`)
 * 3. User answer blocks (● User answered Claude's questions:)
 * 4. Slash command lines (/some-command)
 * 5. Regular text (everything else)
 */
function parseBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let pendingTextLines: string[] = [];

  function flushPendingText(): void {
    if (pendingTextLines.length > 0) {
      blocks.push({ type: 'text', content: pendingTextLines.join('\n') });
      pendingTextLines = [];
    }
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    // --- Insight block ---
    if (isInsightBlockStart(line)) {
      flushPendingText();

      const contentLines: string[] = [];
      let j = i + 1;
      let foundClose = false;

      while (j < lines.length) {
        if (CLOSING_RULE_RE.test(lines[j]!.trim())) {
          foundClose = true;
          break;
        }
        contentLines.push(lines[j]!);
        j++;
      }

      if (foundClose) {
        blocks.push({ type: 'insight', content: contentLines.join('\n') });
        i = j + 1;
      } else {
        // No closing border found; treat the header as regular text
        pendingTextLines.push(line);
        i++;
      }
      continue;
    }

    // --- Markdown table ---
    if (isTableLine(line)) {
      flushPendingText();

      const { tableLines, endIndex } = extractTableLines(lines, i);
      blocks.push({ type: 'table', lines: tableLines });
      i = endIndex;
      continue;
    }

    // --- User answer block ---
    if (isUserAnswerBlock(line)) {
      flushPendingText();

      const { answers, endIndex } = extractUserAnswerLines(lines, i);
      if (answers.length > 0) {
        blocks.push({ type: 'user-answer', answers });
        i = endIndex;
      } else {
        // Header with no answer lines; treat as regular text
        pendingTextLines.push(line);
        i++;
      }
      continue;
    }

    // --- Slash command (entire line is a single command) ---
    if (hasCommandPattern(line) && line.trim().startsWith('/')) {
      flushPendingText();
      blocks.push({ type: 'command', command: line.trim() });
      i++;
      continue;
    }

    // --- Regular text ---
    pendingTextLines.push(line);
    i++;
  }

  flushPendingText();
  return blocks;
}

// ---------------------------------------------------------------------------
// AssistantTextRenderer component
// ---------------------------------------------------------------------------

/**
 * Main orchestrator for rendering rich assistant text output.
 *
 * Splits the input text into sequential blocks (insight blocks, markdown
 * tables, user answer entries, command badges, and regular text) and
 * delegates rendering to the appropriate specialised sub-component.
 */
export const AssistantTextRenderer: React.FC<{ text: string }> = ({ text }) => {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);

  if (!text || blocks.length === 0) {
    return null;
  }

  // Single text block fast path -- no wrapping Box needed.
  if (blocks.length === 1 && blocks[0]!.type === 'text') {
    return <MarkdownText text={(blocks[0] as TextBlock).content} />;
  }

  return (
    <Box flexDirection="column">
      {blocks.map((block, idx) => {
        const key = `block-${idx}`;
        const isFirst = idx === 0;

        switch (block.type) {
          case 'text':
            return (
              <Box key={key}>
                <MarkdownText text={block.content} />
              </Box>
            );

          case 'insight':
            return (
              <Box key={key} marginTop={isFirst ? 0 : 1}>
                <InsightBlock content={block.content} />
              </Box>
            );

          case 'table':
            return (
              <Box key={key} marginTop={isFirst ? 0 : 1}>
                <MarkdownTable lines={block.lines} />
              </Box>
            );

          case 'command':
            return (
              <Box key={key}>
                <CommandBadge command={block.command} />
              </Box>
            );

          case 'user-answer':
            return (
              <Box key={key} marginTop={isFirst ? 0 : 1}>
                <UserAnswerEntry answers={block.answers} />
              </Box>
            );
        }
      })}
    </Box>
  );
};
