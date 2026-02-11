import React from 'react';
import { Box, Text } from 'ink';

interface ProgressProps {
  messages: string[];
}

export function Progress({ messages }: ProgressProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {messages.map((msg, i) => (
        <Text key={i} dimColor>{msg}</Text>
      ))}
    </Box>
  );
}
