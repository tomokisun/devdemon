import React from 'react';
import { Box, Text } from 'ink';
import { MAX_TASK_PROMPT_LENGTH } from '../../constants.js';
import { taskStatusStyles } from '../theme.js';

export interface TaskLogEntry {
  id: string;
  status: 'running' | 'completed' | 'failed';
  prompt: string;
  timestamp: string;
}

interface TaskLogProps {
  entries: TaskLogEntry[];
}

function statusMark(status: TaskLogEntry['status']): { mark: string; color: string } {
  return taskStatusStyles[status];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `[${h}:${m}]`;
}

function truncate(text: string, max = MAX_TASK_PROMPT_LENGTH): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

export function TaskLog({ entries }: TaskLogProps) {
  if (entries.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No tasks yet</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {entries.map((entry) => {
        const { mark, color } = statusMark(entry.status);
        return (
          <Box key={entry.id} gap={1}>
            <Text color={color}>{mark}</Text>
            <Text dimColor>{formatTime(entry.timestamp)}</Text>
            <Text>{truncate(entry.prompt)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
