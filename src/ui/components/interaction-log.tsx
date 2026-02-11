import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { LogEntry } from '../../agent/message-stream.js';
import type { TaskAgentProgress } from '../hooks/use-daemon-state.js';
import { colors } from '../theme.js';
import { truncateLine, formatTokens } from './interaction-log-styles.js';
import { LogEntryRenderer } from './log-entry-renderer.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InteractionLogProps {
  entries: LogEntry[];
  streamingText: string;
  maxVisible?: number;
  isProcessing?: boolean;
  cycleStartedAt?: number;
  currentTokens?: number;
  taskAgentProgress?: TaskAgentProgress;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function formatElapsed(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  return `${seconds}s`;
}

function InteractionLogInner({
  entries,
  streamingText,
  maxVisible = 30,
  isProcessing = false,
  cycleStartedAt,
  currentTokens = 0,
  taskAgentProgress,
}: InteractionLogProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isProcessing || !cycleStartedAt) {
      setElapsed(0);
      return;
    }

    setElapsed(Math.floor((Date.now() - cycleStartedAt) / 1000));
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - cycleStartedAt) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [isProcessing, cycleStartedAt]);

  if (entries.length === 0 && !streamingText && !isProcessing) {
    return null;
  }

  const visible = entries.slice(-maxVisible);

  // Show spinner when processing and waiting for response
  const lastEntry = entries[entries.length - 1];
  const showSpinner = isProcessing && (
    entries.length === 0 ||
    (lastEntry && (
      lastEntry.kind === 'tool_use' ||
      lastEntry.kind === 'tool_group' ||
      lastEntry.kind === 'tool_batch' ||
      lastEntry.kind === 'user_task'
    ))
  );

  // Determine whether to show Task agent progress
  const showTaskProgress = taskAgentProgress &&
    taskAgentProgress.total > 0 &&
    taskAgentProgress.completed < taskAgentProgress.total;

  // Find recently completed agents for notification display
  const completedAgents = taskAgentProgress
    ? taskAgentProgress.agents.filter(a => a.status === 'completed')
    : [];

  return (
    <Box flexDirection="column" paddingX={1}>
      {visible.map((entry, i) => (
        <LogEntryRenderer key={i} entry={entry} />
      ))}

      {streamingText ? (
        <Text dimColor>{truncateLine(streamingText)}</Text>
      ) : null}

      {showTaskProgress ? (
        <Box>
          <Text color={colors.info}>{'⏺ '}</Text>
          <Text color={colors.info}>{`${taskAgentProgress!.completed}/${taskAgentProgress!.total} Task agents completed`}</Text>
        </Box>
      ) : null}

      {completedAgents.map((agent, i) => (
        <Box key={`task-complete-${i}`}>
          <Text color={colors.success}>{'● '}</Text>
          <Text color={colors.success}>{`Agent "${agent.name}" completed`}</Text>
        </Box>
      ))}

      {showSpinner ? (
        <Box>
          <Text color={colors.warning}>{'● '}</Text>
          <Text color={colors.warning}>{`Processing... (${formatElapsed(elapsed)}${currentTokens > 0 ? ` \u00B7 \u2193 ${formatTokens(currentTokens)}` : ''})`}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

export const InteractionLog = React.memo(InteractionLogInner);
