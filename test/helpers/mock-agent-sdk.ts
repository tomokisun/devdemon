import { mock } from 'bun:test';

export function mockQuery(messages: any[]) {
  return mock.module('@anthropic-ai/claude-agent-sdk', () => ({
    query: () => {
      return {
        async *[Symbol.asyncIterator]() {
          for (const msg of messages) yield msg;
        },
        interrupt: mock(() => Promise.resolve()),
      };
    },
  }));
}

export function createSuccessResult(overrides?: Record<string, any>) {
  return {
    type: 'result',
    subtype: 'success',
    result: 'Task completed successfully.',
    total_cost_usd: 0.05,
    num_turns: 3,
    session_id: 'test-session',
    ...overrides,
  };
}

export function createErrorResult(errors?: string[]) {
  return {
    type: 'result',
    subtype: 'error',
    errors: errors ?? ['Something went wrong'],
    total_cost_usd: 0.01,
    num_turns: 1,
    session_id: 'test-session',
  };
}

export function createToolProgressMessage(
  toolName: string,
  toolUseId: string,
  elapsedSeconds: number,
) {
  return {
    type: 'tool_progress',
    tool_name: toolName,
    tool_use_id: toolUseId,
    elapsed_time_seconds: elapsedSeconds,
  };
}

export function createToolUseSummaryMessage(summary: string) {
  return {
    type: 'tool_use_summary',
    summary,
    tool_name: 'unknown',
    tool_use_id: 'tus-1',
  };
}

export function createAssistantWithToolUse(
  textContent: string,
  toolUseBlocks: Array<{ id: string; name: string; input: unknown }>,
) {
  const content: any[] = [];
  if (textContent) {
    content.push({ type: 'text', text: textContent });
  }
  for (const block of toolUseBlocks) {
    content.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
  }
  return {
    type: 'assistant',
    message: { content },
  };
}

export function createStreamTextDelta(text: string) {
  return {
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      delta: {
        type: 'text_delta',
        text,
      },
    },
  };
}
