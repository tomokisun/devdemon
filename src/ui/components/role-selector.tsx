import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { RoleConfig } from '../../roles/types.js';
import { colors } from '../theme.js';

interface RoleSelectorProps {
  roles: RoleConfig[];
  onSelect: (role: RoleConfig) => void;
}

export function RoleSelector({ roles, onSelect }: RoleSelectorProps) {
  useInput((input) => {
    const num = parseInt(input, 10);
    if (num >= 1 && num <= roles.length) {
      onSelect(roles[num - 1]!);
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color={colors.primary}>Select a role:</Text>
      <Box flexDirection="column" marginTop={1}>
        {roles.map((role, i) => (
          <Text key={role.frontmatter.name}>
            {'  '}{i + 1}. <Text bold>{role.frontmatter.name}</Text>
            {role.frontmatter.description ? <Text color={colors.muted}> - {role.frontmatter.description}</Text> : null}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
