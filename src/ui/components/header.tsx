import React from 'react';
import { Box, Text } from 'ink';
import path from 'path';

interface HeaderProps {
  roleName: string;
  repoPath: string;
  cycle: number;
}

export function Header({ roleName, repoPath, cycle }: HeaderProps) {
  return (
    <Box borderStyle="single" paddingX={1}>
      <Text bold color="magenta">DevDemon</Text>
      <Text> │ Role: </Text>
      <Text color="cyan">{roleName}</Text>
      <Text> │ Repo: </Text>
      <Text color="green">{path.basename(repoPath)}</Text>
      <Text> │ </Text>
      <Text color="yellow">#{cycle}</Text>
    </Box>
  );
}
