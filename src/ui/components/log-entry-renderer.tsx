import React from 'react';
import { Box, Text } from 'ink';
import type { LogEntry } from '../../agent/message-stream.js';
import { STYLE_MAP, colors } from '../theme.js';
import { truncateLine } from './interaction-log-styles.js';
import { ToolGroupEntry } from './tool-group-entry.js';
import { TaskAgentsSummaryEntry } from './task-agents-summary-entry.js';

interface LogEntryRendererProps {
  entry: LogEntry;
}

export function LogEntryRenderer({ entry }: LogEntryRendererProps) {
  // Special rendering for tool_group (merged tool call + result)
  if (entry.kind === 'tool_group') {
    return <ToolGroupEntry entry={entry} />;
  }

  // tool_batch: grouped consecutive tool calls
  if (entry.kind === 'tool_batch') {
    return (
      <Box>
        <Text color={colors.primary} bold>{'⏺ '}</Text>
        <Text color={colors.primary} bold>{truncateLine(entry.text)}</Text>
      </Box>
    );
  }

  // thinking_time: "* Baked for 3m 34s"
  if (entry.kind === 'thinking_time') {
    return (
      <Box>
        <Text color={colors.secondary}>{'* '}</Text>
        <Text color={colors.secondary}>{entry.text}</Text>
      </Box>
    );
  }

  // task_agents_summary: tree view of completed tasks
  if (entry.kind === 'task_agents_summary' && entry.childEntries) {
    return <TaskAgentsSummaryEntry entry={entry} />;
  }

  // Special rendering for cycle_separator
  if (entry.kind === 'cycle_separator') {
    return <Text dimColor>{entry.text}</Text>;
  }

  // Default rendering for other kinds
  const style = STYLE_MAP[entry.kind];
  const truncated = truncateLine(entry.text);

  if (!style.prefix) {
    return (
      <Text
        color={style.color}
        dimColor={style.dim}
        bold={style.bold}
        backgroundColor={style.bgColor}
      >
        {truncated}
      </Text>
    );
  }

  return (
    <Box>
      <Text
        color={style.color}
        dimColor={style.dim}
        bold={style.bold}
        backgroundColor={style.bgColor}
      >
        {style.prefix}
      </Text>
      <Text
        color={style.color}
        dimColor={style.dim}
        bold={style.bold}
        backgroundColor={style.bgColor}
      >
        {truncated}
      </Text>
    </Box>
  );
}
