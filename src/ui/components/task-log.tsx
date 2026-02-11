import React from 'react';
import { Box, Text } from 'ink';

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
  switch (status) {
    case 'completed':
      return { mark: '✓', color: 'green' };
    case 'failed':
      return { mark: '✗', color: 'red' };
    case 'running':
      return { mark: '⟳', color: 'yellow' };
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `[${h}:${m}]`;
}

function truncate(text: string, max = 60): string {
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
