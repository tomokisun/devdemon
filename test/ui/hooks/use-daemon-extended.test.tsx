import { describe, test, expect, mock } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { EventEmitter } from 'events';
import { useDaemon } from '../../../src/ui/hooks/use-daemon.js';
import type { Task } from '../../../src/queue/types.js';
import type { DevDemonStats } from '../../../src/state/types.js';

function createMockDaemon(statsOverride?: Partial<DevDemonStats>) {
  const daemon = new EventEmitter() as any;
  daemon.agent = new EventEmitter();
  daemon.state = {
    getStats: mock(() => ({
      totalCycles: 0,
      totalCostUsd: 0,
      totalTasks: 0,
      userTasks: 0,
      autonomousTasks: 0,
      failedTasks: 0,
      ...statsOverride,
    })),
  };
  daemon.queue = { length: 0 };
  daemon.role = {
    frontmatter: { name: 'test-role', interval: 10, maxTurns: 5, permissionMode: 'acceptEdits' },
    body: '',
    filePath: '/tmp/test.md',
  };
  daemon.repoPath = '/tmp/repo';
  return daemon;
}

function createTestTask(overrides?: Partial<Task>): Task {
  return {
    id: 'task-1',
    type: 'user',
    prompt: 'Fix the bug',
    enqueuedAt: new Date().toISOString(),
    priority: 0,
    ...overrides,
  };
}

// Shared captured state for hook testing
let capturedState: ReturnType<typeof useDaemon> | null = null;

function HookCapture({ daemon }: { daemon: any }) {
  const state = useDaemon(daemon);
  capturedState = state;
  return React.createElement('ink-text', null, state.status);
}

describe('useDaemon - Extended Coverage', () => {
  describe('formatMs helper', () => {
    test('cycle-completeで分単位の実行時間が表示される', async () => {
      const daemon = createMockDaemon();
      capturedState = null;
      const { unmount } = render(React.createElement(HookCapture, { daemon }));

      const task = createTestTask();
      daemon.emit('cycle-start', task);
      await new Promise(r => setTimeout(r, 50));

      daemon.emit('cycle-complete', {
        task,
        result: { success: true, costUsd: 0.05, numTurns: 3, durationMs: 125000 }, // 2m 5s
      });
      await new Promise(r => setTimeout(r, 50));

      const lastEntry = capturedState!.currentTask!.entries[capturedState!.currentTask!.entries.length - 1];
      expect(lastEntry.kind).toBe('result_success');
      expect(lastEntry.text).toContain('2m 5s');

      unmount();
    });
  });

  describe('cycle separator', () => {
    test('2回目のサイクルでseparatorが追加される', async () => {
      const daemon = createMockDaemon();
      capturedState = null;
      const { unmount } = render(React.createElement(HookCapture, { daemon }));

      // First cycle
      const task1 = createTestTask({ id: 'task-1' });
      daemon.emit('cycle-start', task1);
      await new Promise(r => setTimeout(r, 50));

      // First cycle should NOT have a separator - only user_task
      expect(capturedState!.currentTask!.entries).toHaveLength(1);
      expect(capturedState!.currentTask!.entries[0].kind).toBe('user_task');

      // Complete first cycle
      daemon.emit('cycle-complete', {
        task: task1,
        result: { success: true, costUsd: 0.01, numTurns: 1, durationMs: 1000 },
      });
      await new Promise(r => setTimeout(r, 200));

      // After completion, currentTask should be null
      expect(capturedState!.currentTask).toBeNull();

      // Second cycle
      const task2 = createTestTask({ id: 'task-2', prompt: 'Second task' });
      daemon.emit('cycle-start', task2);
      await new Promise(r => setTimeout(r, 50));

      // Second cycle SHOULD have a separator before user_task
      expect(capturedState!.currentTask!.entries).toHaveLength(2);
      expect(capturedState!.currentTask!.entries[0].kind).toBe('cycle_separator');
      expect(capturedState!.currentTask!.entries[0].text).toContain('─');
      expect(capturedState!.currentTask!.entries[1].kind).toBe('user_task');
      expect(capturedState!.currentTask!.entries[1].text).toBe('Second task');

      unmount();
    });
  });

  describe('stream processing', () => {
    test('stream_eventでstreamingTextが更新される', async () => {
      const daemon = createMockDaemon();
      capturedState = null;
      render(React.createElement(HookCapture, { daemon }));

      const task = createTestTask();
      daemon.emit('cycle-start', task);
      await new Promise(r => setTimeout(r, 50));

      // Emit a stream_event with content_block_delta / text_delta
      // The MessageStream internally buffers text and flushes based on throttle.
      // We send multiple deltas to accumulate in the stream buffer, then send a
      // non-stream message to trigger flushStream which updates streamingText via
      // the stream_text log entry processing.
      daemon.agent.emit('message', {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello ' },
        },
      });
      // The first stream_event should flush immediately (lastStreamFlush starts at 0,
      // so the throttle condition is met). This produces a stream_text entry which
      // processEvents converts into streamingText accumulation.
      await new Promise(r => setTimeout(r, 50));

      expect(capturedState!.currentTask!.streamingText).toContain('Hello ');
    });
  });

  describe('tool progress', () => {
    test('tool_progressエントリが既存のものと置き換えられる', async () => {
      const daemon = createMockDaemon();
      capturedState = null;
      render(React.createElement(HookCapture, { daemon }));

      const task = createTestTask();
      daemon.emit('cycle-start', task);
      await new Promise(r => setTimeout(r, 50));

      // First tool_progress for tool_use_id 'tu-1'
      daemon.agent.emit('message', {
        type: 'tool_progress',
        tool_name: 'Bash',
        tool_use_id: 'tu-1',
        elapsed_time_seconds: 2,
      });
      await new Promise(r => setTimeout(r, 50));

      const progressEntries1 = capturedState!.currentTask!.entries.filter(
        e => e.kind === 'tool_progress'
      );
      expect(progressEntries1).toHaveLength(1);
      expect(progressEntries1[0].text).toContain('2s');

      // Second tool_progress for same tool_use_id - should replace, not add
      daemon.agent.emit('message', {
        type: 'tool_progress',
        tool_name: 'Bash',
        tool_use_id: 'tu-1',
        elapsed_time_seconds: 5,
      });
      await new Promise(r => setTimeout(r, 50));

      const progressEntries2 = capturedState!.currentTask!.entries.filter(
        e => e.kind === 'tool_progress'
      );
      expect(progressEntries2).toHaveLength(1);
      expect(progressEntries2[0].text).toContain('5s');
    });
  });

  describe('tool group', () => {
    test('tool_groupがtool_useとtool_progressを置き換える', async () => {
      const daemon = createMockDaemon();
      capturedState = null;
      render(React.createElement(HookCapture, { daemon }));

      const task = createTestTask();
      daemon.emit('cycle-start', task);
      await new Promise(r => setTimeout(r, 50));

      // Emit assistant message with tool_use
      daemon.agent.emit('message', {
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', id: 'tu-bash-1', name: 'Bash', input: { command: 'ls' } }],
        },
      });
      await new Promise(r => setTimeout(r, 50));

      // Emit tool_progress for same tool
      daemon.agent.emit('message', {
        type: 'tool_progress',
        tool_name: 'Bash',
        tool_use_id: 'tu-bash-1',
        elapsed_time_seconds: 3,
      });
      await new Promise(r => setTimeout(r, 50));

      // Verify tool_use and tool_progress are present
      const hasToolUse = capturedState!.currentTask!.entries.some(e => e.kind === 'tool_use' && e.toolUseId === 'tu-bash-1');
      const hasToolProgress = capturedState!.currentTask!.entries.some(e => e.kind === 'tool_progress' && e.toolUseId === 'tu-bash-1');
      expect(hasToolUse).toBe(true);
      expect(hasToolProgress).toBe(true);

      // Emit user message with tool_result referencing the same tool_use_id
      // This triggers MessageStream to create a tool_group that replaces tool_use + tool_progress
      daemon.agent.emit('message', {
        type: 'user',
        tool_use_result: 'file1.ts\nfile2.ts',
        message: { content: [{ type: 'tool_result', tool_use_id: 'tu-bash-1' }] },
      });
      await new Promise(r => setTimeout(r, 50));

      // After the tool_group is processed, tool_use and tool_progress should be replaced
      const hasToolUseAfter = capturedState!.currentTask!.entries.some(e => e.kind === 'tool_use' && e.toolUseId === 'tu-bash-1');
      const hasToolProgressAfter = capturedState!.currentTask!.entries.some(e => e.kind === 'tool_progress' && e.toolUseId === 'tu-bash-1');
      const hasToolGroup = capturedState!.currentTask!.entries.some(e => e.kind === 'tool_group' && e.toolUseId === 'tu-bash-1');

      expect(hasToolUseAfter).toBe(false);
      expect(hasToolProgressAfter).toBe(false);
      expect(hasToolGroup).toBe(true);

      // Verify the tool_group has result lines
      const toolGroup = capturedState!.currentTask!.entries.find(e => e.kind === 'tool_group');
      expect(toolGroup!.resultLines).toBeDefined();
      expect(toolGroup!.resultLines!.length).toBeGreaterThan(0);
    });
  });

  describe('init message', () => {
    test('initメッセージでinitInfoが設定されエントリが追加される', async () => {
      const daemon = createMockDaemon();
      capturedState = null;
      render(React.createElement(HookCapture, { daemon }));

      const task = createTestTask();
      daemon.emit('cycle-start', task);
      await new Promise(r => setTimeout(r, 50));

      // Emit a system init message
      daemon.agent.emit('message', {
        type: 'system',
        subtype: 'init',
        session_id: 'sess-abc-123',
        model: 'claude-sonnet-4-20250514',
        tools: ['Bash', 'Read', 'Write'],
      });
      await new Promise(r => setTimeout(r, 50));

      // initInfo should be set
      expect(capturedState!.initInfo).not.toBeNull();
      expect(capturedState!.initInfo!.model).toBe('claude-sonnet-4-20250514');

      // A system_init entry should be added to entries
      const initEntry = capturedState!.currentTask!.entries.find(e => e.kind === 'system_init');
      expect(initEntry).toBeDefined();
      expect(initEntry!.text).toContain('sess-abc-123');
      expect(initEntry!.text).toContain('claude-sonnet-4-20250514');
      expect(initEntry!.text).toContain('3'); // Tools: 3
    });
  });

  describe('error handling', () => {
    test('cycle-errorで文字列エラーも処理される', async () => {
      const daemon = createMockDaemon();
      capturedState = null;
      render(React.createElement(HookCapture, { daemon }));

      const task = createTestTask();
      daemon.emit('cycle-start', task);
      await new Promise(r => setTimeout(r, 50));

      // 文字列エラー
      daemon.emit('cycle-error', { task, error: 'Something went wrong' });
      await new Promise(r => setTimeout(r, 50));

      const lastEntry = capturedState!.currentTask!.entries[capturedState!.currentTask!.entries.length - 1];
      expect(lastEntry.kind).toBe('result_error');
      expect(lastEntry.text).toBe('Failed: Something went wrong');
    });
  });

  describe('MAX_ENTRIES limit', () => {
    test('エントリが200件を超えると古いものが削除される', async () => {
      const daemon = createMockDaemon();
      capturedState = null;
      render(React.createElement(HookCapture, { daemon }));

      const task = createTestTask();
      daemon.emit('cycle-start', task);
      await new Promise(r => setTimeout(r, 50));

      // 200件以上のメッセージを送信
      for (let i = 0; i < 205; i++) {
        daemon.agent.emit('message', {
          type: 'assistant',
          message: { content: [{ type: 'text', text: `Message ${i}` }] },
        });
      }
      await new Promise(r => setTimeout(r, 100));

      expect(capturedState!.currentTask!.entries.length).toBeLessThanOrEqual(200);
      // 最初のuser_taskエントリは削除されている可能性がある
      const hasOriginalUserTask = capturedState!.currentTask!.entries.some(
        e => e.kind === 'user_task' && e.text === 'Fix the bug'
      );
      expect(hasOriginalUserTask).toBe(false);
    });
  });

  describe('flush stream on non-stream message', () => {
    test('非stream messageの前にstream bufferがフラッシュされる', async () => {
      const daemon = createMockDaemon();
      capturedState = null;
      render(React.createElement(HookCapture, { daemon }));

      const task = createTestTask();
      daemon.emit('cycle-start', task);
      await new Promise(r => setTimeout(r, 50));

      // Send stream events that will accumulate in buffer
      // The first stream_event should flush immediately due to lastStreamFlush=0
      daemon.agent.emit('message', {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'streaming ' },
        },
      });
      await new Promise(r => setTimeout(r, 50));

      // Send another stream_event quickly (within throttle window) so it buffers
      daemon.agent.emit('message', {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'buffered ' },
        },
      });
      // Don't wait for throttle to flush - immediately send a non-stream message
      // This should trigger flushStream() which creates a stream_text entry
      daemon.agent.emit('message', {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Done thinking' }],
        },
      });
      await new Promise(r => setTimeout(r, 100));

      // The stream buffer should have been flushed before processing the assistant message
      const entries = capturedState!.currentTask!.entries;
      const hasAssistantText = entries.some(
        e => e.kind === 'assistant_text' && e.text === 'Done thinking'
      );
      expect(hasAssistantText).toBe(true);
    });
  });

  describe('tool stats in tool_group', () => {
    test('tool統計情報を含むtool_resultを処理', async () => {
      const daemon = createMockDaemon();
      capturedState = null;
      render(React.createElement(HookCapture, { daemon }));

      const task = createTestTask();
      daemon.emit('cycle-start', task);
      await new Promise(r => setTimeout(r, 50));

      // Emit assistant message with Task tool_use
      daemon.agent.emit('message', {
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', id: 'tu-task-stats', name: 'Task', input: { description: 'Run analysis' } }],
        },
      });
      await new Promise(r => setTimeout(r, 50));

      // Emit user message with tool_result containing stats
      daemon.agent.emit('message', {
        type: 'user',
        tool_use_result: {
          content: 'Analysis complete',
          totalToolUseCount: 7,
          totalTokens: 15000,
          totalDurationMs: 45000,
        },
        message: { content: [{ type: 'tool_result', tool_use_id: 'tu-task-stats' }] },
      });
      await new Promise(r => setTimeout(r, 50));

      // Find the tool_group entry
      const toolGroup = capturedState!.currentTask!.entries.find(
        e => e.kind === 'tool_group' && e.toolUseId === 'tu-task-stats'
      );
      expect(toolGroup).toBeDefined();
      expect(toolGroup!.toolName).toBe('Task');
      expect(toolGroup!.toolStats).toBeDefined();
      expect(toolGroup!.toolStats!.totalToolUseCount).toBe(7);
      expect(toolGroup!.toolStats!.totalTokens).toBe(15000);
      expect(toolGroup!.toolStats!.totalDurationMs).toBe(45000);
    });
  });
});