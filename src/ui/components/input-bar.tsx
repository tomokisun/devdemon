import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { colors } from '../theme.js';

interface InputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

export function InputBar({ value, onChange, onSubmit }: InputBarProps) {
  const { stdout } = useStdout();
  const width = stdout.columns || 80;

  useInput((input, key) => {
    if (key.return) {
      // Shift+Enter or Meta+Enter (Option+Enter on macOS): insert newline
      if (key.shift || key.meta) {
        onChange(value + '\n');
        return;
      }
      // Regular Enter: submit
      if (value.trim().length > 0) {
        onSubmit(value);
        onChange('');
      }
      return;
    }
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      onChange(value + input);
    }
  });

  const lines = value.split('\n');

  return (
    <Box flexDirection="column">
      <Text> </Text>
      <Text dimColor>{'─'.repeat(width)}</Text>
      <Box flexDirection="column" paddingX={1}>
        {lines.map((line, i) => (
          <Box key={i}>
            <Text color={colors.primary} bold>{i === 0 ? '❯ ' : '  '}</Text>
            <Text>{line}</Text>
            {i === lines.length - 1 && (
              <Text color={colors.primary}>{'\u2588'}</Text>
            )}
          </Box>
        ))}
      </Box>
      <Text dimColor>{'─'.repeat(width)}</Text>
    </Box>
  );
}
