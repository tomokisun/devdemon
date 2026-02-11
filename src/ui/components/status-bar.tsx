import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  queueLength: number;
  totalCostUsd: number;
  startedAt: string;
  model?: string;
  permissionMode?: string;
  gitBranch?: string;
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

function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export function StatusBar({ queueLength, totalCostUsd, startedAt, model, permissionMode, gitBranch }: StatusBarProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
    <Box gap={1}>
      {model ? (
        <>
          <Text dimColor>{model}</Text>
          <Text dimColor>│</Text>
        </>
      ) : null}
      {permissionMode ? (
        <>
          <Text dimColor>{permissionMode}</Text>
          <Text dimColor>│</Text>
        </>
      ) : null}
      {gitBranch ? (
        <>
          <Text dimColor>git:</Text>
          <Text color="green">{gitBranch}</Text>
          <Text dimColor> │</Text>
        </>
      ) : null}
      <Text>Queue: </Text>
      <Text color="yellow">{queueLength}</Text>
      <Text> │ Cost: </Text>
      <Text color="green">{formatCost(totalCostUsd)}</Text>
      <Text> │ Uptime: </Text>
      <Text color="cyan">{formatUptime(startedAt)}</Text>
    </Box>
    <Text> </Text>
    </Box>
  );
}
