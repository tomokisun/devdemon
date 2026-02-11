import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { InteractionLog } from '../../../src/ui/components/interaction-log.js';
import type { LogEntry } from '../../../src/agent/message-stream.js';

function makeEntry(overrides: Partial<LogEntry> & { kind: LogEntry['kind'] }): LogEntry {
  return {
    text: 'test entry',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('InteractionLog', () => {
  test('entriesが空でstreamingTextがなければnullを返す', () => {
    const { lastFrame } = render(
      <InteractionLog entries={[]} streamingText="" />
    );
    expect(lastFrame()).toBe('');
  });

  test('assistant_textエントリはprefixなしで表示される', () => {
    const entries: LogEntry[] = [
      makeEntry({ kind: 'assistant_text', text: 'Hello from assistant' }),
    ];
    const { lastFrame } = render(
      <InteractionLog entries={entries} streamingText="" />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Hello from assistant');
  });

  test('tool_useエントリは▶ prefixで表示される', () => {
    const entries: LogEntry[] = [
      makeEntry({ kind: 'tool_use', text: 'bash echo hello', toolName: 'bash' }),
    ];
    const { lastFrame } = render(
      <InteractionLog entries={entries} streamingText="" />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('bash echo hello');
  });

  test('tool_progressエントリは表示される', () => {
    const entries: LogEntry[] = [
      makeEntry({ kind: 'tool_progress', text: 'bash running (3s)', toolName: 'bash' }),
    ];
    const { lastFrame } = render(
      <InteractionLog entries={entries} streamingText="" />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('bash running (3s)');
  });

  test('result_successエントリは表示される', () => {
    const entries: LogEntry[] = [
      makeEntry({ kind: 'result_success', text: 'Task completed successfully' }),
    ];
    const { lastFrame } = render(
      <InteractionLog entries={entries} streamingText="" />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Task completed successfully');
  });

  test('result_errorエントリは表示される', () => {
    const entries: LogEntry[] = [
      makeEntry({ kind: 'result_error', text: 'Something went wrong' }),
    ];
    const { lastFrame } = render(
      <InteractionLog entries={entries} streamingText="" />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Something went wrong');
  });

  test('maxVisibleで最後のN件のみ表示される', () => {
    const entries: LogEntry[] = [
      makeEntry({ kind: 'assistant_text', text: 'First message' }),
      makeEntry({ kind: 'assistant_text', text: 'Second message' }),
      makeEntry({ kind: 'assistant_text', text: 'Third message' }),
    ];
    const { lastFrame } = render(
      <InteractionLog entries={entries} streamingText="" maxVisible={2} />
    );
    const frame = lastFrame()!;
    expect(frame).not.toContain('First message');
    expect(frame).toContain('Second message');
    expect(frame).toContain('Third message');
  });

  test('長いテキストは120文字に切り詰められる', () => {
    const longText = 'A'.repeat(200);
    const entries: LogEntry[] = [
      makeEntry({ kind: 'assistant_text', text: longText }),
    ];
    const { lastFrame } = render(
      <InteractionLog entries={entries} streamingText="" />
    );
    const frame = lastFrame()!;
    // The component truncates text to 120 chars (117 + '...')
    // Verify truncation occurred: 200 As should not all be present
    const allText = frame.replace(/\n/g, '').replace(/ /g, '');
    expect(allText).not.toContain('A'.repeat(200));
    // Verify the ellipsis is in the output
    expect(frame).toContain('...');
    // The truncated text should have exactly 117 As followed by '...'
    expect(allText).toContain('A'.repeat(117) + '...');
  });

  test('streamingTextは末尾にdimスタイルで表示される', () => {
    const { lastFrame } = render(
      <InteractionLog entries={[]} streamingText="streaming content..." />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('streaming content...');
  });

  test('tool_batchエントリが正しく表示される', () => {
    const entries: LogEntry[] = [{
      kind: 'tool_batch',
      text: 'Searched for 2 patterns, read 3 files',
      timestamp: Date.now(),
      batchedTools: [
        { toolName: 'Grep', count: 2 },
        { toolName: 'Read', count: 3 },
      ],
    }];

    const { lastFrame } = render(
      <InteractionLog entries={entries} streamingText="" />
    );

    expect(lastFrame()).toContain('⏺');
    expect(lastFrame()).toContain('Searched for 2 patterns, read 3 files');
  });

  test('thinking_timeエントリがmagentaで表示される', () => {
    const entries: LogEntry[] = [{
      kind: 'thinking_time',
      text: 'Cooked for 2m 15s',
      timestamp: Date.now(),
    }];

    const { lastFrame } = render(
      <InteractionLog entries={entries} streamingText="" />
    );

    expect(lastFrame()).toContain('✻');
    expect(lastFrame()).toContain('Cooked for 2m 15s');
  });

  test('task_agents_summaryがツリー構造で表示される', () => {
    const entries: LogEntry[] = [{
      kind: 'task_agents_summary',
      text: '2 Task agents finished',
      timestamp: Date.now(),
      childEntries: [
        {
          kind: 'tool_group',
          text: 'Task(Fix auth)',
          timestamp: Date.now(),
          toolName: 'Task',
          toolStats: { totalToolUseCount: 3, totalTokens: 19100 },
        },
        {
          kind: 'tool_group',
          text: 'Task(Update tests)',
          timestamp: Date.now(),
          toolName: 'Task',
          toolStats: { totalToolUseCount: 4, totalTokens: 20600 },
        },
      ],
    }];

    const { lastFrame } = render(
      <InteractionLog entries={entries} streamingText="" />
    );

    expect(lastFrame()).toContain('2 Task agents finished');
    expect(lastFrame()).toContain('├─');
    expect(lastFrame()).toContain('└─');
    expect(lastFrame()).toContain('Done');
  });

  test('スピナーがtool_group後に表示される', () => {
    const entries: LogEntry[] = [{
      kind: 'tool_group',
      text: 'Read(src/app.tsx)',
      timestamp: Date.now(),
      toolName: 'Read',
      resultLines: ['import React...'],
    }];

    const { lastFrame } = render(
      <InteractionLog
        entries={entries}
        streamingText=""
        isProcessing={true}
        cycleStartedAt={Date.now() - 5000}
      />
    );

    expect(lastFrame()).toContain('✶');
    expect(lastFrame()).toContain('Processing...');
  });

  test('複数種類のエントリが正しい順序で表示される', () => {
    const entries: LogEntry[] = [
      makeEntry({ kind: 'assistant_text', text: 'Analyzing code' }),
      makeEntry({ kind: 'tool_use', text: 'bash ls -la', toolName: 'bash' }),
      makeEntry({ kind: 'tool_progress', text: 'bash running (1s)', toolName: 'bash' }),
      makeEntry({ kind: 'result_success', text: 'Done' }),
    ];
    const { lastFrame } = render(
      <InteractionLog entries={entries} streamingText="" />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Analyzing code');
    expect(frame).toContain('bash ls -la');
    expect(frame).toContain('bash running (1s)');
    expect(frame).toContain('Done');
    // Verify order: 'Analyzing code' comes before 'bash ls -la'
    expect(frame.indexOf('Analyzing code')).toBeLessThan(frame.indexOf('bash ls -la'));
    expect(frame.indexOf('bash ls -la')).toBeLessThan(frame.indexOf('bash running (1s)'));
    expect(frame.indexOf('bash running (1s)')).toBeLessThan(frame.indexOf('Done'));
  });
});
