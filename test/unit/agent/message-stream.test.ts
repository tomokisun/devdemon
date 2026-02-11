import { describe, test, expect, beforeEach } from 'bun:test';
import { MessageStream } from '../../../src/agent/message-stream.js';
import type { UIEvent, LogEntry } from '../../../src/agent/message-stream.js';

describe('MessageStream', () => {
  let stream: MessageStream;

  beforeEach(() => {
    stream = new MessageStream();
  });

  // -----------------------------------------------------------------------
  // assistant messages
  // -----------------------------------------------------------------------
  describe('assistant messages', () => {
    test('テキストブロックからassistant_text LogEntryを返す', () => {
      const events = stream.processMessage({
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Hello world' }],
        },
      }) as UIEvent[];

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('log');
      const entry = (events[0] as { type: 'log'; entry: LogEntry }).entry;
      expect(entry.kind).toBe('assistant_text');
      expect(entry.text).toBe('Hello world');
    });

    test('tool_useブロックからtool_use LogEntryを返す', () => {
      const events = stream.processMessage({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'tool-1', name: 'Read', input: { path: '/foo' } },
          ],
        },
      }) as UIEvent[];

      expect(events).toHaveLength(1);
      const entry = (events[0] as { type: 'log'; entry: LogEntry }).entry;
      expect(entry.kind).toBe('tool_use');
      expect(entry.toolName).toBe('Read');
      expect(entry.toolUseId).toBe('tool-1');
      expect(entry.text).toContain('Read');
    });

    test('混合contentブロックで複数のUIEventを返す', () => {
      const events = stream.processMessage({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Analyzing...' },
            { type: 'tool_use', id: 'tool-2', name: 'Bash', input: { command: 'ls' } },
            { type: 'text', text: 'Done' },
          ],
        },
      }) as UIEvent[];

      expect(events).toHaveLength(3);
      expect((events[0] as { type: 'log'; entry: LogEntry }).entry.kind).toBe('assistant_text');
      expect((events[1] as { type: 'log'; entry: LogEntry }).entry.kind).toBe('tool_use');
      expect((events[2] as { type: 'log'; entry: LogEntry }).entry.kind).toBe('assistant_text');
    });

    test('空のcontentでnullを返す', () => {
      const result = stream.processMessage({
        type: 'assistant',
        message: { content: [] },
      });
      expect(result).toBeNull();
    });

    test('message.contentがない場合nullを返す', () => {
      const result = stream.processMessage({
        type: 'assistant',
        message: {},
      });
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // stream_event messages
  // -----------------------------------------------------------------------
  describe('stream_event messages', () => {
    test('text_deltaをバッファに蓄積しスロットル後にフラッシュする', () => {
      // First delta — should flush because lastStreamFlush is 0
      const event = stream.processMessage({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'hello' },
        },
      });

      // First call should flush since the time gap exceeds STREAM_THROTTLE_MS
      expect(event).not.toBeNull();
      expect((event as { type: 'log'; entry: LogEntry }).entry.kind).toBe('stream_text');
      expect((event as { type: 'log'; entry: LogEntry }).entry.text).toBe('hello');
    });

    test('非text_deltaイベントでnullを返す', () => {
      const result = stream.processMessage({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          delta: null,
        },
      });
      expect(result).toBeNull();
    });

    test('flushStreamでバッファをクリアする', () => {
      // Manually accumulate without auto-flush by making lastStreamFlush recent
      // We do this by calling processMessage once to set lastStreamFlush, then quickly accumulating
      stream.processMessage({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'a' },
        },
      });

      // Now the lastStreamFlush was just set. The next call within 100ms won't flush.
      // But flushStream should still return null since the buffer was already flushed.
      const flushed = stream.flushStream();
      expect(flushed).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // result messages
  // -----------------------------------------------------------------------
  describe('result messages', () => {
    test('success subtypeでcompletion UIEventを返す', () => {
      const event = stream.processMessage({
        type: 'result',
        subtype: 'success',
        result: 'Task completed',
        total_cost_usd: 0.05,
        duration_ms: 12000,
        num_turns: 3,
      });

      expect(event).toEqual({
        type: 'completion',
        result: 'Task completed',
        costUsd: 0.05,
        durationMs: 12000,
        numTurns: 3,
      });
    });

    test('error subtypeでerror UIEventを返す', () => {
      const event = stream.processMessage({
        type: 'result',
        subtype: 'error',
        errors: ['Something went wrong'],
      });

      expect(event).toEqual({
        type: 'error',
        errors: ['Something went wrong'],
      });
    });

    test('errorsが未定義の場合デフォルトエラーメッセージを返す', () => {
      const event = stream.processMessage({
        type: 'result',
        subtype: 'error',
      });

      expect(event).toEqual({
        type: 'error',
        errors: ['Unknown error'],
      });
    });
  });

  // -----------------------------------------------------------------------
  // system messages
  // -----------------------------------------------------------------------
  describe('system messages', () => {
    test('init subtypeでinit UIEventを返す（model, tools付き）', () => {
      const event = stream.processMessage({
        type: 'system',
        subtype: 'init',
        session_id: 'sess-123',
        model: 'claude-opus-4-6',
        tools: ['Read', 'Write', 'Bash'],
      });

      expect(event).toEqual({
        type: 'init',
        sessionId: 'sess-123',
        model: 'claude-opus-4-6',
        tools: ['Read', 'Write', 'Bash'],
      });
    });

    test('status subtypeでsystem_status LogEntryを返す', () => {
      const event = stream.processMessage({
        type: 'system',
        subtype: 'status',
        status: 'Processing',
      }) as { type: 'log'; entry: LogEntry };

      expect(event.type).toBe('log');
      expect(event.entry.kind).toBe('system_status');
      expect(event.entry.text).toBe('Processing');
    });

    test('hook_started subtypeでsystem_hook LogEntryを返す', () => {
      const event = stream.processMessage({
        type: 'system',
        subtype: 'hook_started',
        hook_name: 'pre-commit',
      }) as { type: 'log'; entry: LogEntry };

      expect(event.type).toBe('log');
      expect(event.entry.kind).toBe('system_hook');
    });

    test('hook_progress subtypeでsystem_hook LogEntryを返す', () => {
      const event = stream.processMessage({
        type: 'system',
        subtype: 'hook_progress',
        message: 'Hook running...',
      }) as { type: 'log'; entry: LogEntry };

      expect(event.type).toBe('log');
      expect(event.entry.kind).toBe('system_hook');
      expect(event.entry.text).toBe('Hook running...');
    });

    test('hook_response subtypeでsystem_hook LogEntryを返す', () => {
      const event = stream.processMessage({
        type: 'system',
        subtype: 'hook_response',
        message: 'Hook completed',
      }) as { type: 'log'; entry: LogEntry };

      expect(event.type).toBe('log');
      expect(event.entry.kind).toBe('system_hook');
      expect(event.entry.text).toBe('Hook completed');
    });

    test('compact_boundary subtypeでcompact_boundary LogEntryを返す', () => {
      const event = stream.processMessage({
        type: 'system',
        subtype: 'compact_boundary',
      }) as { type: 'log'; entry: LogEntry };

      expect(event.type).toBe('log');
      expect(event.entry.kind).toBe('compact_boundary');
      expect(event.entry.text).toBe('Context compacted');
    });

    test('未知のsystem subtypeでnullを返す', () => {
      const result = stream.processMessage({
        type: 'system',
        subtype: 'heartbeat',
      });
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // tool_progress messages
  // -----------------------------------------------------------------------
  describe('tool_progress messages', () => {
    test('tool_progress LogEntryを返す', () => {
      const event = stream.processMessage({
        type: 'tool_progress',
        tool_name: 'Bash',
        tool_use_id: 'tu-1',
        elapsed_time_seconds: 5,
      }) as { type: 'log'; entry: LogEntry };

      expect(event.type).toBe('log');
      expect(event.entry.kind).toBe('tool_progress');
      expect(event.entry.text).toBe('Bash running (5s)');
      expect(event.entry.toolName).toBe('Bash');
      expect(event.entry.toolUseId).toBe('tu-1');
    });
  });

  // -----------------------------------------------------------------------
  // tool_use_summary messages
  // -----------------------------------------------------------------------
  describe('tool_use_summary messages', () => {
    test('summaryフィールド付きのtool_use_summary LogEntryを返す', () => {
      const event = stream.processMessage({
        type: 'tool_use_summary',
        tool_name: 'Read',
        tool_use_id: 'tu-2',
        summary: 'Read 50 lines from config.ts',
      }) as { type: 'log'; entry: LogEntry };

      expect(event.type).toBe('log');
      expect(event.entry.kind).toBe('tool_use_summary');
      expect(event.entry.text).toBe('Read: Read 50 lines from config.ts');
      expect(event.entry.toolName).toBe('Read');
    });

    test('summaryがない場合resultにフォールバックする', () => {
      const event = stream.processMessage({
        type: 'tool_use_summary',
        tool_name: 'Bash',
        result: 'exit code 0',
      }) as { type: 'log'; entry: LogEntry };

      expect(event.entry.text).toBe('Bash: exit code 0');
    });

    test('summaryもresultもない場合デフォルトテキストを使う', () => {
      const event = stream.processMessage({
        type: 'tool_use_summary',
      }) as { type: 'log'; entry: LogEntry };

      expect(event.entry.text).toBe('Tool use summary');
    });
  });

  // -----------------------------------------------------------------------
  // user messages
  // -----------------------------------------------------------------------
  describe('user messages', () => {
    test('tool_use_result付きでtool_result LogEntryを返す', () => {
      const event = stream.processMessage({
        type: 'user',
        tool_use_result: 'File contents here',
        tool_name: 'Read',
        tool_use_id: 'tu-3',
      }) as { type: 'log'; entry: LogEntry };

      expect(event.type).toBe('log');
      expect(event.entry.kind).toBe('tool_result');
      expect(event.entry.text).toBe('File contents here');
    });

    test('長いtool_use_resultを500文字に切り詰める', () => {
      const longResult = 'x'.repeat(600);
      const event = stream.processMessage({
        type: 'user',
        tool_use_result: longResult,
      }) as { type: 'log'; entry: LogEntry };

      expect(event.entry.text.length).toBe(503); // 500 + '...'
      expect(event.entry.text.endsWith('...')).toBe(true);
    });

    test('tool_use_resultがオブジェクトの場合contentを抽出する', () => {
      const event = stream.processMessage({
        type: 'user',
        tool_use_result: { content: 'Result content', tool_name: 'Write' },
      }) as { type: 'log'; entry: LogEntry };

      expect(event.entry.text).toBe('Result content');
      expect(event.entry.toolName).toBe('Write');
    });

    test('tool_use_resultがない場合nullを返す', () => {
      const result = stream.processMessage({
        type: 'user',
      });
      expect(result).toBeNull();
    });

    test('配列contentからtextブロックのみ抽出する', () => {
      // First create a pending tool_use
      stream.processMessage({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 'tu_array', name: 'Read', input: { file_path: '/test.ts' } }] },
      });

      const result = stream.processMessage({
        type: 'user',
        tool_use_result: {
          content: [
            { type: 'text', text: 'First line' },
            { type: 'image', source: { data: 'base64...' } },
            { type: 'text', text: 'Second line' },
          ],
        },
        message: { content: [{ type: 'tool_result', tool_use_id: 'tu_array' }] },
      });

      expect(result).not.toBeNull();
      const event = result as any;
      expect(event.type).toBe('log');
      // The text should be joined from the two text blocks
      expect(event.entry.resultLines).toBeDefined();
      expect(event.entry.resultLines![0]).toBe('First line');
      expect(event.entry.resultLines![1]).toBe('Second line');
    });

    test('tool_groupにtotalResultLinesが含まれる', () => {
      // Create pending tool_use
      stream.processMessage({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 'tu_lines', name: 'Read', input: { file_path: '/test.ts' } }] },
      });

      // Create a result with 10 lines
      const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\n');
      const result = stream.processMessage({
        type: 'user',
        tool_use_result: lines,
        message: { content: [{ type: 'tool_result', tool_use_id: 'tu_lines' }] },
      });

      const event = result as any;
      expect(event.type).toBe('log');
      expect(event.entry.kind).toBe('tool_group');
      expect(event.entry.totalResultLines).toBe(10);
      // Should show 5 lines + "... +5 lines"
      expect(event.entry.resultLines).toHaveLength(6);
      expect(event.entry.resultLines![5]).toBe('... +5 lines');
    });

    test('5行以内のresultLinesには+N linesが付かない', () => {
      stream.processMessage({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 'tu_short', name: 'Read', input: { file_path: '/test.ts' } }] },
      });

      const lines = Array.from({ length: 3 }, (_, i) => `Line ${i + 1}`).join('\n');
      const result = stream.processMessage({
        type: 'user',
        tool_use_result: lines,
        message: { content: [{ type: 'tool_result', tool_use_id: 'tu_short' }] },
      });

      const event = result as any;
      expect(event.entry.resultLines).toHaveLength(3);
      expect(event.entry.totalResultLines).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // diff data for Edit tools
  // -----------------------------------------------------------------------
  describe('diff data for Edit tool_group', () => {
    test('Edit tool_groupにdiffDataが含まれる', () => {
      // Create pending Edit tool_use
      stream.processMessage({
        type: 'assistant',
        message: {
          content: [{
            type: 'tool_use',
            id: 'tu_edit_diff',
            name: 'Edit',
            input: {
              file_path: '/test.ts',
              old_string: 'hello world',
              new_string: 'hello universe',
            },
          }],
        },
      });

      const result = stream.processMessage({
        type: 'user',
        tool_use_result: 'OK',
        message: { content: [{ type: 'tool_result', tool_use_id: 'tu_edit_diff' }] },
      });

      const event = result as any;
      expect(event.type).toBe('log');
      expect(event.entry.kind).toBe('tool_group');
      expect(event.entry.diffData).toBeDefined();
      expect(event.entry.diffData.addedCount).toBeGreaterThan(0);
      expect(event.entry.diffData.removedCount).toBeGreaterThan(0);
      expect(event.entry.diffData.lines.length).toBeGreaterThan(0);
    });

    test('Edit以外のtool_groupにはdiffDataが含まれない', () => {
      // Create pending Read tool_use
      stream.processMessage({
        type: 'assistant',
        message: {
          content: [{
            type: 'tool_use',
            id: 'tu_read_nodiff',
            name: 'Read',
            input: { file_path: '/test.ts' },
          }],
        },
      });

      const result = stream.processMessage({
        type: 'user',
        tool_use_result: 'file contents here',
        message: { content: [{ type: 'tool_result', tool_use_id: 'tu_read_nodiff' }] },
      });

      const event = result as any;
      expect(event.entry.kind).toBe('tool_group');
      expect(event.entry.diffData).toBeUndefined();
    });

    test('old_stringが欠けている場合diffDataはundefined', () => {
      stream.processMessage({
        type: 'assistant',
        message: {
          content: [{
            type: 'tool_use',
            id: 'tu_edit_noinput',
            name: 'Edit',
            input: { file_path: '/test.ts', new_string: 'only new' },
          }],
        },
      });

      const result = stream.processMessage({
        type: 'user',
        tool_use_result: 'OK',
        message: { content: [{ type: 'tool_result', tool_use_id: 'tu_edit_noinput' }] },
      });

      const event = result as any;
      expect(event.entry.kind).toBe('tool_group');
      expect(event.entry.diffData).toBeUndefined();
    });

    test('Edit tool_groupのdiffDataに正しいline typeがある', () => {
      stream.processMessage({
        type: 'assistant',
        message: {
          content: [{
            type: 'tool_use',
            id: 'tu_edit_types',
            name: 'Edit',
            input: {
              file_path: '/test.ts',
              old_string: 'line1\nold_line\nline3',
              new_string: 'line1\nnew_line\nline3',
            },
          }],
        },
      });

      const result = stream.processMessage({
        type: 'user',
        tool_use_result: 'OK',
        message: { content: [{ type: 'tool_result', tool_use_id: 'tu_edit_types' }] },
      });

      const event = result as any;
      const diffData = event.entry.diffData;
      expect(diffData).toBeDefined();

      const types = diffData.lines.map((l: any) => l.type);
      expect(types).toContain('removed');
      expect(types).toContain('added');
      expect(types).toContain('context');
    });
  });

  // -----------------------------------------------------------------------
  // auth_status messages
  // -----------------------------------------------------------------------
  describe('auth_status messages', () => {
    test('nullを返す', () => {
      const result = stream.processMessage({ type: 'auth_status' });
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // unknown message types
  // -----------------------------------------------------------------------
  describe('unknown message types', () => {
    test('未知のtypeでnullを返す', () => {
      const result = stream.processMessage({ type: 'unknown_type' });
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // flushStream
  // -----------------------------------------------------------------------
  describe('flushStream', () => {
    test('バッファが空の場合nullを返す', () => {
      expect(stream.flushStream()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // summarizeToolInput (tested indirectly through tool_use)
  // -----------------------------------------------------------------------
  describe('summarizeToolInput (indirect)', () => {
    test('短いinputをそのまま表示する', () => {
      const events = stream.processMessage({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'tu-x', name: 'Read', input: { path: '/a' } },
          ],
        },
      }) as UIEvent[];

      const entry = (events[0] as { type: 'log'; entry: LogEntry }).entry;
      expect(entry.text).toBe('Read {"path":"/a"}');
    });

    test('長いinputを80文字+...に切り詰める', () => {
      const longInput = { data: 'x'.repeat(100) };
      const events = stream.processMessage({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'tu-y', name: 'Write', input: longInput },
          ],
        },
      }) as UIEvent[];

      const entry = (events[0] as { type: 'log'; entry: LogEntry }).entry;
      // "Write " (6 chars) + summarized input
      const inputPart = entry.text.slice('Write '.length);
      expect(inputPart.length).toBe(83); // 80 + '...'
      expect(inputPart.endsWith('...')).toBe(true);
    });

    test('null inputの場合空文字になる', () => {
      const events = stream.processMessage({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'tu-z', name: 'Noop', input: null },
          ],
        },
      }) as UIEvent[];

      const entry = (events[0] as { type: 'log'; entry: LogEntry }).entry;
      expect(entry.text).toBe('Noop ');
    });
  });
});
