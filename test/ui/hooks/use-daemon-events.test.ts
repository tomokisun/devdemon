import { describe, test, expect, mock } from 'bun:test';
import { processEvents } from '../../../src/ui/hooks/use-daemon-events.js';
import type { LogEntry, UIEvent } from '../../../src/agent/message-stream.js';
import type { CurrentTaskState } from '../../../src/ui/hooks/use-daemon-state.js';

function makeCurrentTask(entries: LogEntry[] = []): CurrentTaskState {
  return {
    task: { id: 'task-1', type: 'user', prompt: 'test', enqueuedAt: new Date().toISOString(), priority: 0 },
    entries,
    streamingText: '',
    cycleStartedAt: Date.now(),
    currentTokens: 0,
  };
}

// Helper to create a setState mock that tracks updates
function createMockSetState(initialState: CurrentTaskState | null = makeCurrentTask()) {
  let state = initialState;
  const setter = mock((updater: any) => {
    if (typeof updater === 'function') {
      state = updater(state);
    } else {
      state = updater;
    }
  });
  return { setter, getState: () => state };
}

describe('processEvents', () => {
  describe('stream_text events', () => {
    test('stream_textエントリでstreamingTextが蓄積される', () => {
      const { setter, getState } = createMockSetState();
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        {
          type: 'log',
          entry: { kind: 'stream_text', text: 'Hello ', timestamp: Date.now() },
        },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      expect(setter).toHaveBeenCalled();
      const state = getState();
      expect(state!.streamingText).toBe('Hello ');
    });

    test('複数のstream_textが連結される', () => {
      const { setter, getState } = createMockSetState();
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        {
          type: 'log',
          entry: { kind: 'stream_text', text: 'Hello ', timestamp: Date.now() },
        },
        {
          type: 'log',
          entry: { kind: 'stream_text', text: 'World', timestamp: Date.now() },
        },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      const state = getState();
      expect(state!.streamingText).toBe('Hello World');
    });
  });

  describe('token_update events', () => {
    test('token_updateでcurrentTokensが更新される', () => {
      const { setter, getState } = createMockSetState();
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        { type: 'token_update', totalTokens: 5000 },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      const state = getState();
      expect(state!.currentTokens).toBe(5000);
    });

    test('prevがnullの場合はそのまま返す', () => {
      const { setter, getState } = createMockSetState(null);
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        { type: 'token_update', totalTokens: 1000 },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      expect(getState()).toBeNull();
    });
  });

  describe('init events', () => {
    test('initイベントでsetInitInfoとsystem_initエントリが追加される', () => {
      const { setter, getState } = createMockSetState();
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        {
          type: 'init',
          sessionId: 'sess-123',
          model: 'claude-sonnet-4-20250514',
          tools: ['Bash', 'Read', 'Write'],
        },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      expect(setInitInfo).toHaveBeenCalledWith({ model: 'claude-sonnet-4-20250514' });
      const state = getState();
      const initEntry = state!.entries.find(e => e.kind === 'system_init');
      expect(initEntry).toBeDefined();
      expect(initEntry!.text).toContain('sess-123');
      expect(initEntry!.text).toContain('claude-sonnet-4-20250514');
      expect(initEntry!.text).toContain('3');
    });
  });

  describe('tool_progress events', () => {
    test('tool_progressエントリが追加される', () => {
      const { setter, getState } = createMockSetState();
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        {
          type: 'log',
          entry: {
            kind: 'tool_progress',
            text: 'Bash running (3s)',
            timestamp: Date.now(),
            toolName: 'Bash',
            toolUseId: 'tu-1',
          },
        },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      const state = getState();
      const progressEntry = state!.entries.find(e => e.kind === 'tool_progress');
      expect(progressEntry).toBeDefined();
      expect(progressEntry!.toolUseId).toBe('tu-1');
    });

    test('同じtoolUseIdのtool_progressが置換される', () => {
      const initialEntries: LogEntry[] = [
        {
          kind: 'tool_progress',
          text: 'Bash running (2s)',
          timestamp: Date.now(),
          toolName: 'Bash',
          toolUseId: 'tu-1',
        },
      ];
      const { setter, getState } = createMockSetState(makeCurrentTask(initialEntries));
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        {
          type: 'log',
          entry: {
            kind: 'tool_progress',
            text: 'Bash running (5s)',
            timestamp: Date.now(),
            toolName: 'Bash',
            toolUseId: 'tu-1',
          },
        },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      const state = getState();
      const progressEntries = state!.entries.filter(e => e.kind === 'tool_progress');
      expect(progressEntries).toHaveLength(1);
      expect(progressEntries[0].text).toContain('5s');
    });

    test('toolUseIdがない場合は通常のエントリとして追加される', () => {
      const { setter, getState } = createMockSetState();
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        {
          type: 'log',
          entry: {
            kind: 'tool_progress',
            text: 'Running...',
            timestamp: Date.now(),
            toolName: 'Bash',
            // no toolUseId
          },
        },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      const state = getState();
      // Without toolUseId it falls through to normal entry addition
      expect(state!.entries.some(e => e.kind === 'tool_progress')).toBe(true);
    });
  });

  describe('tool_group events', () => {
    test('tool_groupでtool_useとtool_progressが置換される', () => {
      const initialEntries: LogEntry[] = [
        {
          kind: 'tool_use',
          text: 'Bash(ls)',
          timestamp: Date.now(),
          toolName: 'Bash',
          toolUseId: 'tu-bash-1',
        },
        {
          kind: 'tool_progress',
          text: 'Bash running (3s)',
          timestamp: Date.now(),
          toolName: 'Bash',
          toolUseId: 'tu-bash-1',
        },
      ];
      const { setter, getState } = createMockSetState(makeCurrentTask(initialEntries));
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        {
          type: 'log',
          entry: {
            kind: 'tool_group',
            text: 'Bash(ls)',
            timestamp: Date.now(),
            toolName: 'Bash',
            toolUseId: 'tu-bash-1',
            resultLines: ['file1.ts', 'file2.ts'],
          },
        },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      const state = getState();
      expect(state!.entries.some(e => e.kind === 'tool_use')).toBe(false);
      expect(state!.entries.some(e => e.kind === 'tool_progress')).toBe(false);
      const toolGroup = state!.entries.find(e => e.kind === 'tool_group');
      expect(toolGroup).toBeDefined();
    });

    test('対応するtool_useがない場合はtool_groupが追加される', () => {
      const { setter, getState } = createMockSetState();
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        {
          type: 'log',
          entry: {
            kind: 'tool_group',
            text: 'Bash(ls)',
            timestamp: Date.now(),
            toolName: 'Bash',
            toolUseId: 'tu-bash-no-match',
            resultLines: ['output'],
          },
        },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      const state = getState();
      expect(state!.entries.some(e => e.kind === 'tool_group')).toBe(true);
    });

    test('batchable tool_groupがtool_batchにマージされる', () => {
      const initialEntries: LogEntry[] = [
        {
          kind: 'tool_group',
          text: 'Read(a.ts)',
          timestamp: Date.now(),
          toolName: 'Read',
          toolUseId: 'tu-read-1',
        },
      ];
      const { setter, getState } = createMockSetState(makeCurrentTask(initialEntries));
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        {
          type: 'log',
          entry: {
            kind: 'tool_group',
            text: 'Read(b.ts)',
            timestamp: Date.now(),
            toolName: 'Read',
            toolUseId: 'tu-read-2',
          },
        },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      const state = getState();
      const batchEntry = state!.entries.find(e => e.kind === 'tool_batch');
      expect(batchEntry).toBeDefined();
      expect(batchEntry!.text).toContain('read 2 files');
    });
  });

  describe('Task agent summary', () => {
    test('2つの連続したTask tool_groupがtask_agents_summaryにまとまる', () => {
      const initialEntries: LogEntry[] = [
        {
          kind: 'tool_group',
          text: 'Task(Fix auth)',
          timestamp: Date.now(),
          toolName: 'Task',
          toolUseId: 'tu-task-1',
          toolStats: { totalToolUseCount: 3, totalTokens: 10000 },
        },
      ];
      const { setter, getState } = createMockSetState(makeCurrentTask(initialEntries));
      const setInitInfo = mock(() => {});

      const newTaskEntry: LogEntry = {
        kind: 'tool_group',
        text: 'Task(Update tests)',
        timestamp: Date.now(),
        toolName: 'Task',
        toolUseId: 'tu-task-2',
        toolStats: { totalToolUseCount: 4, totalTokens: 15000 },
      };

      const events: UIEvent[] = [
        { type: 'log', entry: newTaskEntry },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      const state = getState();
      const summary = state!.entries.find(e => e.kind === 'task_agents_summary');
      expect(summary).toBeDefined();
      expect(summary!.text).toContain('2 Task agents finished');
      expect(summary!.childEntries).toHaveLength(2);
    });

    test('既存のtask_agents_summaryに3つ目のTaskを追加する', () => {
      const task1: LogEntry = {
        kind: 'tool_group',
        text: 'Task(First)',
        timestamp: Date.now(),
        toolName: 'Task',
        toolUseId: 'tu-task-1',
        toolStats: { totalToolUseCount: 2 },
      };
      const task2: LogEntry = {
        kind: 'tool_group',
        text: 'Task(Second)',
        timestamp: Date.now(),
        toolName: 'Task',
        toolUseId: 'tu-task-2',
        toolStats: { totalToolUseCount: 3 },
      };
      const initialEntries: LogEntry[] = [
        {
          kind: 'task_agents_summary',
          text: '2 Task agents finished',
          timestamp: Date.now(),
          childEntries: [task1, task2],
        },
      ];
      const { setter, getState } = createMockSetState(makeCurrentTask(initialEntries));
      const setInitInfo = mock(() => {});

      const newTaskEntry: LogEntry = {
        kind: 'tool_group',
        text: 'Task(Third)',
        timestamp: Date.now(),
        toolName: 'Task',
        toolUseId: 'tu-task-3',
        toolStats: { totalToolUseCount: 5 },
      };

      const events: UIEvent[] = [
        { type: 'log', entry: newTaskEntry },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      const state = getState();
      const summary = state!.entries.find(e => e.kind === 'task_agents_summary');
      expect(summary).toBeDefined();
      expect(summary!.text).toContain('3 Task agents finished');
      expect(summary!.childEntries).toHaveLength(3);
    });
  });

  describe('normal log events', () => {
    test('通常のlogイベントでstreamingTextがクリアされエントリが追加される', () => {
      const initialState = makeCurrentTask();
      initialState.streamingText = 'accumulated text';
      const { setter, getState } = createMockSetState(initialState);
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        {
          type: 'log',
          entry: { kind: 'assistant_text', text: 'Final text', timestamp: Date.now() },
        },
      ];

      processEvents(events, setter as any, setInitInfo as any);

      const state = getState();
      expect(state!.streamingText).toBe('');
      expect(state!.entries.some(e => e.kind === 'assistant_text' && e.text === 'Final text')).toBe(true);
    });
  });

  describe('null prev state', () => {
    test('prevがnullの場合stream_textはnullを返す', () => {
      const { setter, getState } = createMockSetState(null);
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        {
          type: 'log',
          entry: { kind: 'stream_text', text: 'Hello', timestamp: Date.now() },
        },
      ];

      processEvents(events, setter as any, setInitInfo as any);
      expect(getState()).toBeNull();
    });

    test('prevがnullの場合tool_progressはnullを返す', () => {
      const { setter, getState } = createMockSetState(null);
      const setInitInfo = mock(() => {});

      const events: UIEvent[] = [
        {
          type: 'log',
          entry: {
            kind: 'tool_progress',
            text: 'Running...',
            timestamp: Date.now(),
            toolUseId: 'tu-1',
          },
        },
      ];

      processEvents(events, setter as any, setInitInfo as any);
      expect(getState()).toBeNull();
    });
  });
});
