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

describe('useDaemon', () => {
  test('初期statsをdaemon stateから読み込む', () => {
    const daemon = createMockDaemon({ totalCycles: 5, totalCostUsd: 1.23 });
    capturedState = null;
    render(React.createElement(HookCapture, { daemon }));
    expect(capturedState!.stats.totalCycles).toBe(5);
    expect(capturedState!.stats.totalCostUsd).toBe(1.23);
  });

  test('初期statusはidle', () => {
    const daemon = createMockDaemon();
    capturedState = null;
    render(React.createElement(HookCapture, { daemon }));
    expect(capturedState!.status).toBe('idle');
  });

  test('初期currentTaskはnull', () => {
    const daemon = createMockDaemon();
    capturedState = null;
    render(React.createElement(HookCapture, { daemon }));
    expect(capturedState!.currentTask).toBeNull();
  });

  test('初期taskLogは空配列', () => {
    const daemon = createMockDaemon();
    capturedState = null;
    render(React.createElement(HookCapture, { daemon }));
    expect(capturedState!.taskLog).toEqual([]);
  });

  test('cycle-startでcurrentTaskが設定されtaskLogに追加される', async () => {
    const daemon = createMockDaemon();
    capturedState = null;
    render(React.createElement(HookCapture, { daemon }));

    const task = createTestTask();
    daemon.emit('cycle-start', task);
    await new Promise(r => setTimeout(r, 50));

    expect(capturedState!.status).toBe('running');
    expect(capturedState!.currentTask).not.toBeNull();
    expect(capturedState!.currentTask!.task.id).toBe('task-1');
    // cycle-start now adds a user_task entry for the task prompt
    expect(capturedState!.currentTask!.entries).toHaveLength(1);
    expect(capturedState!.currentTask!.entries[0].kind).toBe('user_task');
    expect(capturedState!.currentTask!.entries[0].text).toBe('Fix the bug');
    expect(capturedState!.currentTask!.streamingText).toBe('');
    expect(capturedState!.taskLog).toHaveLength(1);
    expect(capturedState!.taskLog[0].id).toBe('task-1');
    expect(capturedState!.taskLog[0].status).toBe('running');
    expect(capturedState!.taskLog[0].prompt).toBe('Fix the bug');
  });

  test('cycle-completeでcurrentTaskがクリアされtaskLogがcompletedに更新される', async () => {
    const daemon = createMockDaemon();
    capturedState = null;
    render(React.createElement(HookCapture, { daemon }));

    const task = createTestTask();
    daemon.emit('cycle-start', task);
    await new Promise(r => setTimeout(r, 50));

    // Provide full AgentResult shape (costUsd, numTurns, durationMs are required)
    daemon.emit('cycle-complete', {
      task,
      result: { success: true, costUsd: 0.05, numTurns: 3, durationMs: 1200 },
    });
    // Source uses setTimeout(100) before clearing state, so wait longer
    await new Promise(r => setTimeout(r, 200));

    expect(capturedState!.status).toBe('waiting');
    expect(capturedState!.currentTask).toBeNull();
    expect(capturedState!.taskLog[0].status).toBe('completed');
  });

  test('cycle-errorでcurrentTaskがクリアされtaskLogがfailedに更新される', async () => {
    const daemon = createMockDaemon();
    capturedState = null;
    render(React.createElement(HookCapture, { daemon }));

    const task = createTestTask();
    daemon.emit('cycle-start', task);
    await new Promise(r => setTimeout(r, 50));

    daemon.emit('cycle-error', { task, error: new Error('boom') });
    // Source uses setTimeout(100) before clearing state, so wait longer
    await new Promise(r => setTimeout(r, 200));

    expect(capturedState!.status).toBe('waiting');
    expect(capturedState!.currentTask).toBeNull();
    expect(capturedState!.taskLog[0].status).toBe('failed');
  });

  test('agentのmessageイベントでcurrentTaskのentriesが更新される', async () => {
    const daemon = createMockDaemon();
    capturedState = null;
    render(React.createElement(HookCapture, { daemon }));

    const task = createTestTask();
    daemon.emit('cycle-start', task);
    await new Promise(r => setTimeout(r, 50));

    daemon.agent.emit('message', {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'Working on it...' }],
      },
    });
    await new Promise(r => setTimeout(r, 50));

    // entries[0] is the user_task entry from cycle-start, entries[1] is the assistant message
    expect(capturedState!.currentTask!.entries).toHaveLength(2);
    expect(capturedState!.currentTask!.entries[1].kind).toBe('assistant_text');
    expect(capturedState!.currentTask!.entries[1].text).toBe('Working on it...');
  });

  test('agentのmessageイベントでcontent配列からtext/tool_useを抽出する', async () => {
    const daemon = createMockDaemon();
    capturedState = null;
    render(React.createElement(HookCapture, { daemon }));

    const task = createTestTask();
    daemon.emit('cycle-start', task);
    await new Promise(r => setTimeout(r, 50));

    daemon.agent.emit('message', {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'tool_use', id: 't1', name: 'bash', input: {} },
          { type: 'text', text: 'world' },
        ],
      },
    });
    await new Promise(r => setTimeout(r, 50));

    // entries[0] is the user_task entry from cycle-start, then 2 assistant_text + 1 tool_use
    expect(capturedState!.currentTask!.entries).toHaveLength(4);
    expect(capturedState!.currentTask!.entries[0].kind).toBe('user_task');
    expect(capturedState!.currentTask!.entries[1].kind).toBe('assistant_text');
    expect(capturedState!.currentTask!.entries[1].text).toBe('Hello ');
    expect(capturedState!.currentTask!.entries[2].kind).toBe('tool_use');
    expect(capturedState!.currentTask!.entries[2].toolName).toBe('bash');
    expect(capturedState!.currentTask!.entries[3].kind).toBe('assistant_text');
    expect(capturedState!.currentTask!.entries[3].text).toBe('world');
  });

  test('unknownメッセージタイプはentriesに追加されない', async () => {
    const daemon = createMockDaemon();
    capturedState = null;
    render(React.createElement(HookCapture, { daemon }));

    const task = createTestTask();
    daemon.emit('cycle-start', task);
    await new Promise(r => setTimeout(r, 50));

    daemon.agent.emit('message', { type: 'auth_status', status: 'ok' });
    await new Promise(r => setTimeout(r, 50));

    // Only the user_task entry from cycle-start should be present; auth_status adds nothing
    expect(capturedState!.currentTask!.entries).toHaveLength(1);
    expect(capturedState!.currentTask!.entries[0].kind).toBe('user_task');
  });

  test('unmount時にイベントリスナーが削除される', () => {
    const daemon = createMockDaemon();
    capturedState = null;
    const { unmount } = render(React.createElement(HookCapture, { daemon }));

    expect(daemon.listenerCount('cycle-start')).toBe(1);
    expect(daemon.agent.listenerCount('message')).toBe(1);

    unmount();

    expect(daemon.listenerCount('cycle-start')).toBe(0);
    expect(daemon.listenerCount('cycle-complete')).toBe(0);
    expect(daemon.listenerCount('cycle-error')).toBe(0);
    expect(daemon.agent.listenerCount('message')).toBe(0);
  });

  test('cycle-completeでstatsが再取得される', async () => {
    const daemon = createMockDaemon();
    capturedState = null;
    render(React.createElement(HookCapture, { daemon }));

    const initialCallCount = daemon.state.getStats.mock.calls.length;

    const task = createTestTask();
    daemon.emit('cycle-start', task);
    await new Promise(r => setTimeout(r, 50));

    // Provide full AgentResult shape
    daemon.emit('cycle-complete', {
      task,
      result: { success: true, costUsd: 0.01, numTurns: 1, durationMs: 500 },
    });
    // Source uses setTimeout(100) before refreshing stats, so wait longer
    await new Promise(r => setTimeout(r, 200));

    expect(daemon.state.getStats.mock.calls.length).toBeGreaterThan(initialCallCount);
  });
});
