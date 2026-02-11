import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
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

describe('InteractionLog - Extended Coverage', () => {
  describe('tool_group エントリのレンダリング', () => {
    test('tool_group with toolStats', () => {
      const entries: LogEntry[] = [
        makeEntry({
          kind: 'tool_group',
          text: 'Running tests',
          toolStats: {
            totalTokens: 1500,
            totalDurationMs: 65000,
            totalToolUseCount: 3
          }
        }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      const frame = lastFrame()!;
      expect(frame).toContain('Running tests');
      expect(frame).toContain('Done (3 tools · 1.5k tokens · 1m 5s)');
    });

    test('tool_group with single tool', () => {
      const entries: LogEntry[] = [
        makeEntry({
          kind: 'tool_group',
          text: 'Reading file',
          toolStats: {
            totalTokens: 500,
            totalDurationMs: 2000,
            totalToolUseCount: 1
          }
        }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      const frame = lastFrame()!;
      expect(frame).toContain('Done (1 tool · 500 tokens · 2s)');
    });

    test('tool_group with resultLines', () => {
      const entries: LogEntry[] = [
        makeEntry({
          kind: 'tool_group',
          text: 'Executing command',
          resultLines: ['Line 1 output', 'Line 2 output', 'Line 3 output']
        }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      const frame = lastFrame()!;
      expect(frame).toContain('Executing command');
      expect(frame).toContain('Line 1 output');
      expect(frame).toContain('Line 2 output');
      expect(frame).toContain('Line 3 output');
    });

    test('tool_group without toolStats or resultLines', () => {
      const entries: LogEntry[] = [
        makeEntry({
          kind: 'tool_group',
          text: 'Simple tool group'
        }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      const frame = lastFrame()!;
      expect(frame).toContain('Simple tool group');
    });
  });

  describe('cycle_separator エントリのレンダリング', () => {
    test('cycle_separatorは特殊な形式で表示される', () => {
      const entries: LogEntry[] = [
        makeEntry({
          kind: 'cycle_separator',
          text: '═══════════════ Cycle 2 ═══════════════'
        }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      const frame = lastFrame()!;
      expect(frame).toContain('═══════════════ Cycle 2 ═══════════════');
    });
  });

  describe('その他のエントリタイプ', () => {
    test('tool_result エントリ', () => {
      const entries: LogEntry[] = [
        makeEntry({ kind: 'tool_result', text: 'Command output here' }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      expect(lastFrame()!).toContain('Command output here');
    });

    test('tool_use_summary エントリ', () => {
      const entries: LogEntry[] = [
        makeEntry({ kind: 'tool_use_summary', text: 'Summary: 3 files read' }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      expect(lastFrame()!).toContain('Summary: 3 files read');
    });

    test('system_init エントリ', () => {
      const entries: LogEntry[] = [
        makeEntry({ kind: 'system_init', text: 'System initialized' }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      expect(lastFrame()!).toContain('System initialized');
    });

    test('system_status エントリ', () => {
      const entries: LogEntry[] = [
        makeEntry({ kind: 'system_status', text: 'Processing...' }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      expect(lastFrame()!).toContain('Processing...');
    });

    test('system_hook エントリ', () => {
      const entries: LogEntry[] = [
        makeEntry({ kind: 'system_hook', text: 'Hook executed' }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      expect(lastFrame()!).toContain('Hook executed');
    });

    test('compact_boundary エントリ', () => {
      const entries: LogEntry[] = [
        makeEntry({ kind: 'compact_boundary', text: '── Boundary ──' }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      expect(lastFrame()!).toContain('── Boundary ──');
    });

    test('stream_text エントリ', () => {
      const entries: LogEntry[] = [
        makeEntry({ kind: 'stream_text', text: 'Streaming content' }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      expect(lastFrame()!).toContain('Streaming content');
    });

    test('user_task エントリ', () => {
      const entries: LogEntry[] = [
        makeEntry({ kind: 'user_task', text: 'Fix the bug in login' }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      expect(lastFrame()!).toContain('Fix the bug in login');
    });
  });

  describe('Processing spinner', () => {
    let originalDateNow: typeof Date.now;
    let mockTime: number;

    beforeEach(() => {
      mockTime = 1000000;
      originalDateNow = Date.now;
      Date.now = () => mockTime;
    });

    afterEach(() => {
      Date.now = originalDateNow;
    });

    test('処理中のスピナーが表示される（エントリなし）', () => {
      const { lastFrame } = render(
        <InteractionLog
          entries={[]}
          streamingText=""
          isProcessing={true}
          cycleStartedAt={mockTime - 5000}
        />
      );
      const frame = lastFrame()!;
      expect(frame).toContain('Processing... (0s)');
    });

    test('処理中のスピナーが表示される（最後がtool_use）', () => {
      const entries: LogEntry[] = [
        makeEntry({ kind: 'tool_use', text: 'Reading file' }),
      ];
      const { lastFrame } = render(
        <InteractionLog
          entries={entries}
          streamingText=""
          isProcessing={true}
          cycleStartedAt={mockTime - 10000}
        />
      );
      const frame = lastFrame()!;
      expect(frame).toContain('Processing... (0s)');
    });

    test('処理中のスピナーが表示される（最後がuser_task）', () => {
      const entries: LogEntry[] = [
        makeEntry({ kind: 'user_task', text: 'User request' }),
      ];
      const { lastFrame } = render(
        <InteractionLog
          entries={entries}
          streamingText=""
          isProcessing={true}
          cycleStartedAt={mockTime - 3000}
        />
      );
      const frame = lastFrame()!;
      expect(frame).toContain('Processing... (0s)');
    });

    test('スピナーは処理中でない場合は表示されない', () => {
      const entries: LogEntry[] = [
        makeEntry({ kind: 'tool_use', text: 'Reading file' }),
      ];
      const { lastFrame } = render(
        <InteractionLog
          entries={entries}
          streamingText=""
          isProcessing={false}
        />
      );
      const frame = lastFrame()!;
      expect(frame).not.toContain('Processing...');
    });

    test('最後がassistant_textの場合はスピナーを表示しない', () => {
      const entries: LogEntry[] = [
        makeEntry({ kind: 'assistant_text', text: 'Response' }),
      ];
      const { lastFrame } = render(
        <InteractionLog
          entries={entries}
          streamingText=""
          isProcessing={true}
          cycleStartedAt={mockTime - 5000}
        />
      );
      const frame = lastFrame()!;
      expect(frame).not.toContain('Processing...');
    });
  });

  describe('formatTokensとformatDurationのテスト', () => {
    test('1000トークン以上はk単位で表示', () => {
      const entries: LogEntry[] = [
        makeEntry({
          kind: 'tool_group',
          text: 'Large operation',
          toolStats: {
            totalTokens: 2500,
            totalDurationMs: 1000,
            totalToolUseCount: 1
          }
        }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      expect(lastFrame()!).toContain('2.5k tokens');
    });

    test('60秒以上は分単位で表示', () => {
      const entries: LogEntry[] = [
        makeEntry({
          kind: 'tool_group',
          text: 'Long operation',
          toolStats: {
            totalTokens: 100,
            totalDurationMs: 125000, // 2m 5s
            totalToolUseCount: 1
          }
        }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      expect(lastFrame()!).toContain('2m 5s');
    });

    test('改行を含むテキストは最初の行のみ表示される', () => {
      const entries: LogEntry[] = [
        makeEntry({
          kind: 'assistant_text',
          text: 'First line\nSecond line\nThird line'
        }),
      ];
      const { lastFrame } = render(
        <InteractionLog entries={entries} streamingText="" />
      );
      const frame = lastFrame()!;
      expect(frame).toContain('First line');
      expect(frame).not.toContain('Second line');
      expect(frame).not.toContain('Third line');
    });
  });
});