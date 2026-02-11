import React from 'react';
import { Box, Text } from 'ink';
import { formatCost } from '../../utils/format.js';
import { colors } from '../theme.js';
import type { GitFileStats } from '../hooks/use-git-stats.js';

interface StatusBarProps {
  queueLength: number;
  totalCostUsd: number;
  startedAt: string;
  model?: string;
  permissionMode?: string;
  gitBranch?: string;
  fileStats?: GitFileStats | null;
}

function formatUptime(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - start);
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

/** Map permission mode strings to display labels and emphasis colors. */
function permissionDisplay(mode: string): { label: string; color: string } {
  switch (mode) {
    case 'bypassPermissions':
      return { label: '\u25B6\u25B6 bypass permissions on', color: colors.error };
    case 'acceptEdits':
      return { label: '\u25B6 accept edits', color: colors.warning };
    default:
      return { label: mode, color: colors.muted };
  }
}

export function StatusBar({ queueLength, totalCostUsd, startedAt, model, permissionMode, gitBranch, fileStats }: StatusBarProps) {
  const hasFileChanges = fileStats && fileStats.filesChanged > 0;

  return (
    <Box flexDirection="column" paddingX={1}>
    <Box gap={1}>
      {model ? (
        <>
          <Text dimColor>{model}</Text>
          <Text dimColor>│</Text>
        </>
      ) : null}
      {permissionMode ? (() => {
        const pd = permissionDisplay(permissionMode);
        return (
          <>
            <Text color={pd.color} bold>{pd.label}</Text>
            <Text dimColor>│</Text>
          </>
        );
      })() : null}
      {gitBranch ? (
        <>
          <Text dimColor>git:</Text>
          <Text color={colors.success}>{gitBranch}</Text>
          <Text dimColor> │</Text>
        </>
      ) : null}
      <Text>Queue: </Text>
      <Text color={colors.warning}>{queueLength}</Text>
      <Text> │ Cost: </Text>
      <Text color={colors.success}>{formatCost(totalCostUsd)}</Text>
      <Text> │ Uptime: </Text>
      <Text color={colors.info}>{formatUptime(startedAt)}</Text>
      {hasFileChanges ? (
        <>
          <Text dimColor> │</Text>
          <Text> {fileStats.filesChanged} file{fileStats.filesChanged !== 1 ? 's' : ''} </Text>
          <Text color={colors.success}>+{fileStats.insertions}</Text>
          <Text> </Text>
          <Text color={colors.error}>-{fileStats.deletions}</Text>
        </>
      ) : null}
    </Box>
    <Text> </Text>
    </Box>
  );
}
