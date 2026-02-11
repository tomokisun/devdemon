import React from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import { colors } from '../theme.js';

interface HeaderProps {
  roleName: string;
  repoPath: string;
  cycle: number;
}

export function Header({ roleName, repoPath, cycle }: HeaderProps) {
  return (
    <Box borderStyle="single" paddingX={1}>
      <Text bold color={colors.secondary}>DevDemon</Text>
      <Text> │ Role: </Text>
      <Text color={colors.primary}>{roleName}</Text>
      <Text> │ Repo: </Text>
      <Text color={colors.success}>{path.basename(repoPath)}</Text>
      <Text> │ </Text>
      <Text color={colors.warning}>#{cycle}</Text>
    </Box>
  );
}
