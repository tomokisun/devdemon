import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { LogEntry, LogEntryKind } from '../../agent/message-stream.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InteractionLogProps {
  entries: LogEntry[];
  streamingText: string;
  maxVisible?: number;
  isProcessing?: boolean;      // NEW for spinner
  cycleStartedAt?: number;     // NEW for spinner
}

interface StyleDef {
  prefix: string;
  color: string | undefined;
  dim: boolean;
  bold: boolean;
}

// ---------------------------------------------------------------------------
// Style mapping
// ---------------------------------------------------------------------------

const STYLE_MAP: Record<LogEntryKind, StyleDef> = {
  assistant_text:   { prefix: '⏺ ',  color: undefined, dim: false, bold: false },
  tool_use:         { prefix: '⏺ ',  color: 'cyan',    dim: false, bold: false },
  tool_result:      { prefix: '  ⎿ ', color: undefined, dim: true,  bold: false },
  tool_progress:    { prefix: '⏳ ',  color: 'yellow',  dim: false, bold: false },
  tool_use_summary: { prefix: '📋 ',  color: 'cyan',    dim: true,  bold: false },
  tool_group:       { prefix: '⏺ ',  color: 'cyan',    dim: false, bold: false },
  tool_batch:          { prefix: '⏺ ',  color: 'cyan',    dim: true,  bold: false },
  thinking_time:       { prefix: '✻ ',  color: 'magenta', dim: false, bold: false },
  task_agents_summary: { prefix: '⏺ ',  color: 'cyan',    dim: false, bold: false },
  system_init:      { prefix: '⚡ ',  color: 'green',   dim: false, bold: false },
  system_status:    { prefix: '● ',   color: 'yellow',  dim: false, bold: false },
  system_hook:      { prefix: '🪝 ',  color: 'yellow',  dim: true,  bold: false },
  result_success:   { prefix: '✓ ',   color: 'green',   dim: false, bold: true  },
  result_error:     { prefix: '✗ ',   color: 'red',     dim: false, bold: true  },
  compact_boundary: { prefix: '─ ',   color: 'magenta', dim: false, bold: false },
  stream_text:      { prefix: '',     color: undefined, dim: true,  bold: false },
  cycle_separator:  { prefix: '',     color: undefined, dim: true,  bold: false },
  user_task:        { prefix: '❯ ',   color: 'cyan',    dim: false, bold: true  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_LINE_LENGTH = 120;

function truncateLine(text: string): string {
  const firstLine = text.split('\n')[0];
  if (firstLine.length <= MAX_LINE_LENGTH) {
    return firstLine;
  }
  return firstLine.slice(0, MAX_LINE_LENGTH - 3) + '...';
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k tokens`;
  }
  return `${tokens} tokens`;
}

function formatDuration(ms: number): string {
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
  return `${Math.round(ms / 1000)}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function InteractionLogInner({
  entries,
  streamingText,
  maxVisible = 30,
  isProcessing = false,
  cycleStartedAt,
}: InteractionLogProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isProcessing || !cycleStartedAt) {
      setElapsed(0);
      return;
    }

    setElapsed(Math.floor((Date.now() - cycleStartedAt) / 1000));
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - cycleStartedAt) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [isProcessing, cycleStartedAt]);

  if (entries.length === 0 && !streamingText && !isProcessing) {
    return null;
  }

  const visible = entries.slice(-maxVisible);

  // Show spinner when processing and waiting for response
  const lastEntry = entries[entries.length - 1];
  const showSpinner = isProcessing && (
    entries.length === 0 ||
    (lastEntry && (
      lastEntry.kind === 'tool_use' ||
      lastEntry.kind === 'tool_group' ||
      lastEntry.kind === 'tool_batch' ||
      lastEntry.kind === 'user_task'
    ))
  );

  return (
    <Box flexDirection="column" paddingX={1}>
      {visible.map((entry, i) => {
        // Special rendering for tool_group (merged tool call + result)
        if (entry.kind === 'tool_group') {
          return (
            <Box key={i} flexDirection="column">
              <Box>
                <Text color="cyan">{'⏺ '}</Text>
                <Text color="cyan">{truncateLine(entry.text)}</Text>
              </Box>
              {entry.toolStats ? (
                <Box>
                  <Text dimColor>{'  ⎿ '}</Text>
                  <Text dimColor>
                    {'Done'}
                    {entry.toolStats.totalToolUseCount != null ? ` (${entry.toolStats.totalToolUseCount} tool${entry.toolStats.totalToolUseCount !== 1 ? 's' : ''}` : ' ('}
                    {entry.toolStats.totalTokens ? ` · ${formatTokens(entry.toolStats.totalTokens)}` : ''}
                    {entry.toolStats.totalDurationMs ? ` · ${formatDuration(entry.toolStats.totalDurationMs)}` : ''}
                    {')'}
                  </Text>
                </Box>
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

        // tool_batch: grouped consecutive tool calls
        if (entry.kind === 'tool_batch') {
          return (
            <Box key={i}>
              <Text color="cyan" dimColor>{'⏺ '}</Text>
              <Text color="cyan" dimColor>{truncateLine(entry.text)}</Text>
            </Box>
          );
        }

        // thinking_time: "✻ Baked for 3m 34s"
        if (entry.kind === 'thinking_time') {
          return (
            <Box key={i}>
              <Text color="magenta">{'✻ '}</Text>
              <Text color="magenta">{entry.text}</Text>
            </Box>
          );
        }

        // task_agents_summary: tree view of completed tasks
        if (entry.kind === 'task_agents_summary' && entry.childEntries) {
          const children = entry.childEntries;
          return (
            <Box key={i} flexDirection="column">
              <Box>
                <Text color="cyan">{'⏺ '}</Text>
                <Text color="cyan">{entry.text}</Text>
              </Box>
              {children.map((child, j) => {
                const isLast = j === children.length - 1;
                const prefix = isLast ? '   └─ ' : '   ├─ ';
                const stats = child.toolStats;
                const statText = stats
                  ? ` · ${stats.totalToolUseCount ?? 0} tool uses · ${formatTokens(stats.totalTokens ?? 0)}`
                  : '';
                return (
                  <Box key={j} flexDirection="column">
                    <Box>
                      <Text dimColor>{prefix}</Text>
                      <Text>{truncateLine(child.text)}{statText}</Text>
                    </Box>
                    <Box>
                      <Text dimColor>{isLast ? '      ⎿  ' : '   │  ⎿  '}</Text>
                      <Text dimColor>Done</Text>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          );
        }

        // Special rendering for cycle_separator
        if (entry.kind === 'cycle_separator') {
          return (
            <Text key={i} dimColor>{entry.text}</Text>
          );
        }

        // Default rendering for other kinds
        const style = STYLE_MAP[entry.kind];
        const truncated = truncateLine(entry.text);

        if (!style.prefix) {
          return (
            <Text
              key={i}
              color={style.color}
              dimColor={style.dim}
              bold={style.bold}
            >
              {truncated}
            </Text>
          );
        }

        return (
          <Box key={i}>
            <Text
              color={style.color}
              dimColor={style.dim}
              bold={style.bold}
            >
              {style.prefix}
            </Text>
            <Text
              color={style.color}
              dimColor={style.dim}
              bold={style.bold}
            >
              {truncated}
            </Text>
          </Box>
        );
      })}

      {streamingText ? (
        <Text dimColor>{truncateLine(streamingText)}</Text>
      ) : null}

      {showSpinner ? (
        <Box>
          <Text color="cyan">{'✶ '}</Text>
          <Text color="cyan">{`Processing... (${elapsed}s)`}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

export const InteractionLog = React.memo(InteractionLogInner);
