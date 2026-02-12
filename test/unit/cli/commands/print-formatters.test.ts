import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  formatTextOutput,
  formatJsonOutput,
  StreamJsonWriter,
} from '../../../../src/cli/commands/print-formatters.js';
import type { PrintJsonOutput } from '../../../../src/cli/commands/print-formatters.js';
import type { AgentResult } from '../../../../src/agent/agent.js';
import type { UIEvent } from '../../../../src/agent/message-stream.js';

function makeResult(overrides: Partial<AgentResult> = {}): AgentResult {
  return {
    success: true,
    result: 'test result',
    costUsd: 0.05,
    numTurns: 3,
    durationMs: 1500,
    errors: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// formatTextOutput
// ---------------------------------------------------------------------------
describe('formatTextOutput', () => {
  test('成功時にresultテキストを返す', () => {
    const result = makeResult({ success: true, result: 'hello world' });
    expect(formatTextOutput(result)).toBe('hello world');
  });

  test('成功時にresultがnullなら空文字列を返す', () => {
    const result = makeResult({ success: true, result: null });
    expect(formatTextOutput(result)).toBe('');
  });

  test('失敗時にエラーを改行結合で返す', () => {
    const result = makeResult({
      success: false,
      errors: ['err1', 'err2'],
    });
    expect(formatTextOutput(result)).toBe('err1\nerr2');
  });

  test('失敗時にエラーが空配列なら空文字列を返す', () => {
    const result = makeResult({ success: false, errors: [] });
    expect(formatTextOutput(result)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatJsonOutput
// ---------------------------------------------------------------------------
describe('formatJsonOutput', () => {
  test('正しいJSON構造を生成する', () => {
    const result = makeResult({
      success: true,
      result: 'done',
      costUsd: 0.1,
      numTurns: 5,
      durationMs: 2000,
    });
    const json = formatJsonOutput(result, 'sess-1', 'swe', 1234);
    const parsed: PrintJsonOutput = JSON.parse(json);

    expect(parsed.result).toBe('done');
    expect(parsed.session_id).toBe('sess-1');
    expect(parsed.role).toBe('swe');
    expect(parsed.is_error).toBe(false);
    expect(parsed.cost_usd).toBe(0.1);
    expect(parsed.num_turns).toBe(5);
    expect(parsed.duration_ms).toBe(2000);
    expect(parsed.total_tokens).toBe(1234);
  });

  test('is_errorが成功時にfalseになる', () => {
    const result = makeResult({ success: true });
    const parsed: PrintJsonOutput = JSON.parse(
      formatJsonOutput(result, 's', 'r', 0),
    );
    expect(parsed.is_error).toBe(false);
  });

  test('is_errorが失敗時にtrueになる', () => {
    const result = makeResult({ success: false });
    const parsed: PrintJsonOutput = JSON.parse(
      formatJsonOutput(result, 's', 'r', 0),
    );
    expect(parsed.is_error).toBe(true);
  });

  test('全数値フィールドが正しくマッピングされる', () => {
    const result = makeResult({
      costUsd: 0.999,
      numTurns: 42,
      durationMs: 9876,
    });
    const parsed: PrintJsonOutput = JSON.parse(
      formatJsonOutput(result, 'sid', 'role', 5555),
    );
    expect(parsed.cost_usd).toBe(0.999);
    expect(parsed.num_turns).toBe(42);
    expect(parsed.duration_ms).toBe(9876);
    expect(parsed.total_tokens).toBe(5555);
  });
});

// ---------------------------------------------------------------------------
// StreamJsonWriter
// ---------------------------------------------------------------------------
describe('StreamJsonWriter', () => {
  const originalWrite = process.stdout.write;
  let writtenData: string[];
  let writer: StreamJsonWriter;

  beforeEach(() => {
    writtenData = [];
    process.stdout.write = mock((data: string | Uint8Array) => {
      writtenData.push(
        typeof data === 'string' ? data : new TextDecoder().decode(data),
      );
      return true;
    }) as typeof process.stdout.write;
    writer = new StreamJsonWriter();
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
  });

  test('initイベントでsessionIdを保存しstdoutに書き込む', () => {
    const event: UIEvent = {
      type: 'init',
      sessionId: 'abc-123',
      model: 'claude-opus-4-20250514',
      tools: ['Read'],
    };
    writer.writeEvent(event);

    expect(writtenData).toHaveLength(1);
    const parsed = JSON.parse(writtenData[0].trimEnd());
    expect(parsed.type).toBe('init');
    expect(parsed.sessionId).toBe('abc-123');
  });

  test('logイベントのassistant_textをstdoutに書き込む', () => {
    const event: UIEvent = {
      type: 'log',
      entry: { kind: 'assistant_text', text: 'Hello', timestamp: Date.now() },
    };
    writer.writeEvent(event);

    expect(writtenData).toHaveLength(1);
    const parsed = JSON.parse(writtenData[0].trimEnd());
    expect(parsed.type).toBe('log');
    expect(parsed.entry.kind).toBe('assistant_text');
  });

  test('logイベントのtool_useをstdoutに書き込む', () => {
    const event: UIEvent = {
      type: 'log',
      entry: { kind: 'tool_use', text: 'Read /foo', timestamp: Date.now() },
    };
    writer.writeEvent(event);

    expect(writtenData).toHaveLength(1);
    const parsed = JSON.parse(writtenData[0].trimEnd());
    expect(parsed.entry.kind).toBe('tool_use');
  });

  test('logイベントのtool_resultをフィルタ（書き込まない）', () => {
    const event: UIEvent = {
      type: 'log',
      entry: { kind: 'tool_result', text: 'result data', timestamp: Date.now() },
    };
    writer.writeEvent(event);

    expect(writtenData).toHaveLength(0);
  });

  test('completionイベントをstdoutに書き込む', () => {
    const event: UIEvent = {
      type: 'completion',
      result: 'All done',
      costUsd: 0.05,
      durationMs: 1000,
      numTurns: 2,
    };
    writer.writeEvent(event);

    expect(writtenData).toHaveLength(1);
    const parsed = JSON.parse(writtenData[0].trimEnd());
    expect(parsed.type).toBe('completion');
    expect(parsed.result).toBe('All done');
  });

  test('errorイベントをstdoutに書き込む', () => {
    const event: UIEvent = {
      type: 'error',
      errors: ['something went wrong'],
    };
    writer.writeEvent(event);

    expect(writtenData).toHaveLength(1);
    const parsed = JSON.parse(writtenData[0].trimEnd());
    expect(parsed.type).toBe('error');
    expect(parsed.errors).toEqual(['something went wrong']);
  });

  test('token_updateイベントを書き込まずtotalTokensを保存する', () => {
    const event: UIEvent = {
      type: 'token_update',
      totalTokens: 4096,
    };
    writer.writeEvent(event);

    expect(writtenData).toHaveLength(0);
    expect(writer.getTotalTokens()).toBe(4096);
  });

  test('getSessionId()がinitから保存したsessionIdを返す', () => {
    expect(writer.getSessionId()).toBe('');

    writer.writeEvent({
      type: 'init',
      sessionId: 'my-session',
      model: 'claude-opus-4-20250514',
      tools: [],
    });

    expect(writer.getSessionId()).toBe('my-session');
  });

  test('getTotalTokens()がtoken_updateから保存した値を返す', () => {
    expect(writer.getTotalTokens()).toBe(0);

    writer.writeEvent({ type: 'token_update', totalTokens: 100 });
    expect(writer.getTotalTokens()).toBe(100);

    writer.writeEvent({ type: 'token_update', totalTokens: 250 });
    expect(writer.getTotalTokens()).toBe(250);
  });
});
