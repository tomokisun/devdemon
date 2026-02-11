import React from 'react';
import { Text, Box } from 'ink';
import { colors } from '../theme.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserAnswer {
  question: string;
  answer: string;
}

// ---------------------------------------------------------------------------
// Detection & extraction utilities
// ---------------------------------------------------------------------------

/**
 * Returns true if the given line looks like a "User answered" header block.
 */
export function isUserAnswerBlock(line: string): boolean {
  return /User answered/i.test(line);
}

/**
 * Parse indented `⎿` lines to extract question → answer pairs.
 *
 * Expected format (each line after the header):
 *   ⎿  · <question> → <answer>
 */
export function extractUserAnswers(text: string): UserAnswer[] {
  const answers: UserAnswer[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // Match lines that contain the tree char followed by a middle-dot and an arrow separator
    const match = line.match(/⎿\s+·\s+(.+?)\s+→\s+(.+)/);
    if (match) {
      answers.push({
        question: match[1]!.trim(),
        answer: match[2]!.trim(),
      });
    }
  }

  return answers;
}

// ---------------------------------------------------------------------------
// Answer line renderer (handles "(Recommended)" highlighting)
// ---------------------------------------------------------------------------

function AnswerText({ answer }: { answer: string }) {
  const recommendedMatch = answer.match(/^(.*?)(\(Recommended\))(.*)$/);

  if (recommendedMatch) {
    const before = recommendedMatch[1]!;
    const recommended = recommendedMatch[2]!;
    const after = recommendedMatch[3]!;
    return (
      <>
        {before ? <Text color={colors.primary} bold>{before}</Text> : null}
        <Text color={colors.success}>{recommended}</Text>
        {after ? <Text color={colors.primary} bold>{after}</Text> : null}
      </>
    );
  }

  return <Text color={colors.primary} bold>{answer}</Text>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const UserAnswerEntry: React.FC<{ answers: UserAnswer[] }> = ({ answers }) => {
  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Text color={colors.info}>{'● '}</Text>
        <Text>{"User answered Claude's questions:"}</Text>
      </Box>

      {/* Q&A pairs */}
      {answers.map((qa, i) => (
        <Box key={i}>
          <Text>{'  ⎿  · '}</Text>
          <Text color={colors.muted}>{qa.question}</Text>
          <Text color={colors.muted}>{' → '}</Text>
          <AnswerText answer={qa.answer} />
        </Box>
      ))}
    </Box>
  );
};
