import React from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import type { RoleConfig } from '../../roles/types.js';
import type { DevDemonStats } from '../../state/types.js';
import { formatCost } from '../../utils/format.js';
import { MAX_PATH_DISPLAY_LENGTH, WELCOME_COLUMN_WIDTH } from '../../constants.js';
import { colors } from '../theme.js';

interface WelcomeScreenProps {
  role: RoleConfig;
  roles: RoleConfig[];
  repoPath: string;
  stats: DevDemonStats | null;
  version: string;
}

function truncatePath(repoPath: string): string {
  if (repoPath.length <= MAX_PATH_DISPLAY_LENGTH) return repoPath;
  const segments = repoPath.split(path.sep);
  if (segments.length >= 2) {
    return `…/${segments.slice(-2).join('/')}`;
  }
  return repoPath;
}

const DEMON_ART = [
  '    /\\_/\\',
  '   ( o.o )',
  '    > ^ <',
  '   /|   |\\',
  '  (_|   |_)',
];

export function WelcomeScreen({ role, roles, repoPath, stats, version }: WelcomeScreenProps) {
  const { frontmatter } = role;

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" paddingX={1} flexDirection="column">
        {/* Title embedded at top of border area */}
        <Box>
          <Text dimColor>───</Text>
          <Text bold color={colors.secondary}> DevDemon</Text>
          <Text> v{version} </Text>
          <Text dimColor>───</Text>
        </Box>

        <Box flexDirection="row">
          {/* Left column */}
          <Box flexDirection="column" width={WELCOME_COLUMN_WIDTH} alignItems="center" justifyContent="center" paddingY={1}>
            <Text bold>Welcome back!</Text>
            <Text> </Text>
            {DEMON_ART.map((line, i) => (
              <Text key={i} color={colors.secondary}>{line}</Text>
            ))}
            <Text> </Text>
            <Text dimColor>claude-agent-sdk · {frontmatter.permissionMode}</Text>
            <Text>
              <Text>Repo: </Text>
              <Text color={colors.success}>{path.basename(repoPath)}</Text>
            </Text>
            <Text dimColor>{truncatePath(repoPath)}</Text>
          </Box>

          {/* Right column */}
          <Box flexDirection="column" width={WELCOME_COLUMN_WIDTH} paddingY={1} paddingLeft={1} borderLeft>
            <Text bold>Active Role</Text>
            <Text>
              <Text>  </Text>
              <Text color={colors.primary}>{frontmatter.name}</Text>
              <Text dimColor>{frontmatter.description ? ` (${frontmatter.description})` : ''}</Text>
            </Text>
            <Text dimColor>  interval: {frontmatter.interval}s · maxTurns: {frontmatter.maxTurns}</Text>
            <Text dimColor>  permission: {frontmatter.permissionMode}</Text>
            <Text> </Text>
            <Text dimColor>────────────────────────────────────</Text>
            <Text> </Text>
            <Text bold>Available Roles</Text>
            {roles.map((r, i) => (
              <Text key={r.frontmatter.name}>
                <Text>  {i + 1}. </Text>
                <Text color={colors.primary}>{r.frontmatter.name.padEnd(12)}</Text>
                <Text dimColor>{r.frontmatter.description ? `- ${r.frontmatter.description}` : ''}</Text>
              </Text>
            ))}
            <Text> </Text>
            <Text dimColor>────────────────────────────────────</Text>
            <Text> </Text>
            {stats ? (
              <>
                <Text bold>Stats (last session)</Text>
                <Text>
                  <Text>  Completed: </Text>
                  <Text color={colors.warning}>{stats.totalTasks - stats.failedTasks}</Text>
                  <Text> · Failed: </Text>
                  <Text color={colors.warning}>{stats.failedTasks}</Text>
                </Text>
                <Text>
                  <Text>  Cost: </Text>
                  <Text color={colors.warning}>{formatCost(stats.totalCostUsd)}</Text>
                  <Text> · Cycles: </Text>
                  <Text color={colors.warning}>{stats.totalCycles}</Text>
                </Text>
              </>
            ) : (
              <Text dimColor>No previous session</Text>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
