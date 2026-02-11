import React from 'react';
import { Box, Text } from 'ink';
import type { LogEntry } from '../../agent/message-stream.js';
import type { DiffLine } from '../hooks/diff-parser.js';
import { formatMs } from '../../utils/format.js';
import { colors, diffStyles } from '../theme.js';
import { truncateLine, formatTokens } from './interaction-log-styles.js';

interface ToolGroupEntryProps {
  entry: LogEntry;
}

// ---------------------------------------------------------------------------
// Diff line renderer
// ---------------------------------------------------------------------------

function DiffLineRow({ line, maxLineNumWidth }: { line: DiffLine; maxLineNumWidth: number }) {
  const lineNumStr = String(line.lineNumber).padStart(maxLineNumWidth, ' ');

  if (line.type === 'removed') {
    return (
      <Box>
        <Text>{'    '}</Text>
        <Text color={diffStyles.lineNumber.color}>{lineNumStr}</Text>
        <Text> </Text>
        <Text backgroundColor={diffStyles.removed.bg} color={diffStyles.removed.fg}>{`-${line.text}`}</Text>
      </Box>
    );
  }

  if (line.type === 'added') {
    return (
      <Box>
        <Text>{'    '}</Text>
        <Text color={diffStyles.lineNumber.color}>{lineNumStr}</Text>
        <Text> </Text>
        <Text backgroundColor={diffStyles.added.bg} color={diffStyles.added.fg}>{`+${line.text}`}</Text>
      </Box>
    );
  }

  // context line
  return (
    <Box>
      <Text>{'    '}</Text>
      <Text dimColor>{lineNumStr}</Text>
      <Text> </Text>
      <Text dimColor>{` ${line.text}`}</Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ToolGroupEntry({ entry }: ToolGroupEntryProps) {
  // Split tool name from arguments (e.g. "Bash(npm test)" -> bold "Bash" + normal "(npm test)")
  const text = truncateLine(entry.text);
  const parenIdx = text.indexOf('(');
  const toolName = parenIdx >= 0 ? text.slice(0, parenIdx) : text;
  const toolArgs = parenIdx >= 0 ? text.slice(parenIdx) : '';

  // Determine if we have diff data to render
  const hasDiff = entry.diffData && entry.diffData.lines.length > 0;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.primary}>{'⏺ '}</Text>
        <Text color={colors.primary} bold>{toolName}</Text>
        {toolArgs ? <Text color={colors.primary}>{toolArgs}</Text> : null}
      </Box>
      {entry.toolStats ? (
        <Box>
          <Text dimColor>{'  ⎿ '}</Text>
          <Text dimColor>
            {'Done'}
            {entry.toolStats.totalToolUseCount != null ? ` (${entry.toolStats.totalToolUseCount} tool${entry.toolStats.totalToolUseCount !== 1 ? 's' : ''}` : ' ('}
            {entry.toolStats.totalTokens ? ` · ${formatTokens(entry.toolStats.totalTokens)}` : ''}
            {entry.toolStats.totalDurationMs ? ` · ${formatMs(entry.toolStats.totalDurationMs)}` : ''}
            {')'}
          </Text>
        </Box>
      ) : hasDiff ? (
        <DiffDisplay diffData={entry.diffData!} />
      ) : entry.resultLines && entry.resultLines.length > 0 ? (
        <Box flexDirection="column">
          {entry.resultLines.map((line, j) => (
            <Box key={j}>
              <Text dimColor>{j === 0 ? '  ⎿ ' : '    '}</Text>
              <Text dimColor>{truncateLine(line)}</Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Diff display component
// ---------------------------------------------------------------------------

function DiffDisplay({ diffData }: { diffData: NonNullable<LogEntry['diffData']> }) {
  const maxLineNum = Math.max(...diffData.lines.map(l => l.lineNumber));
  const maxLineNumWidth = String(maxLineNum).length;

  // Build summary text
  const parts: string[] = [];
  if (diffData.addedCount > 0) {
    parts.push(`Added ${diffData.addedCount} line${diffData.addedCount !== 1 ? 's' : ''}`);
  }
  if (diffData.removedCount > 0) {
    parts.push(`removed ${diffData.removedCount} line${diffData.removedCount !== 1 ? 's' : ''}`);
  }
  const summary = parts.join(', ');

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{'  ⎿ '}</Text>
        <Text dimColor>{summary}</Text>
      </Box>
      {diffData.lines.map((line, i) => (
        <DiffLineRow key={i} line={line} maxLineNumWidth={maxLineNumWidth} />
      ))}
    </Box>
  );
}
