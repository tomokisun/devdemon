import React from 'react';
import { Box, Text } from 'ink';
import type { LogEntry } from '../../agent/message-stream.js';
import { colors } from '../theme.js';
import { truncateLine, formatTokens } from './interaction-log-styles.js';

interface TaskAgentsSummaryEntryProps {
  entry: LogEntry;
}

export function TaskAgentsSummaryEntry({ entry }: TaskAgentsSummaryEntryProps) {
  const children = entry.childEntries ?? [];
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.primary}>{'⏺ '}</Text>
        <Text color={colors.primary}>{entry.text}</Text>
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
              <Text color="white" bold>{truncateLine(child.text)}</Text>
              {statText ? <Text dimColor>{statText}</Text> : null}
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
