import { describe, test, expect } from 'bun:test';
import { formatBatchText, tryMergeBatch, BATCHABLE_TOOLS } from '../../../src/ui/hooks/tool-batching.js';
import type { LogEntry } from '../../../src/agent/message-stream.js';

function makeToolGroupEntry(toolName: string, toolUseId?: string): LogEntry {
  return {
    kind: 'tool_group',
    text: `${toolName}(...)`,
    timestamp: Date.now(),
    toolName,
    toolUseId: toolUseId ?? `tu-${toolName.toLowerCase()}-1`,
  };
}

function makeToolBatchEntry(batchedTools: Array<{ toolName: string; count: number }>): LogEntry {
  return {
    kind: 'tool_batch',
    text: formatBatchText(batchedTools),
    timestamp: Date.now(),
    batchedTools,
  };
}

describe('BATCHABLE_TOOLS', () => {
  test('Read, Grep, Globが含まれている', () => {
    expect(BATCHABLE_TOOLS.has('Read')).toBe(true);
    expect(BATCHABLE_TOOLS.has('Grep')).toBe(true);
    expect(BATCHABLE_TOOLS.has('Glob')).toBe(true);
  });

  test('Bash等は含まれていない', () => {
    expect(BATCHABLE_TOOLS.has('Bash')).toBe(false);
    expect(BATCHABLE_TOOLS.has('Write')).toBe(false);
  });
});

describe('formatBatchText', () => {
  test('検索系ツール(Grep/Glob)のカウントを合算する', () => {
    const result = formatBatchText([
      { toolName: 'Grep', count: 2 },
      { toolName: 'Glob', count: 3 },
    ]);
    expect(result).toContain('Searched for 5 patterns');
  });

  test('Read単体のフォーマット', () => {
    const result = formatBatchText([{ toolName: 'Read', count: 3 }]);
    expect(result).toBe('read 3 files');
  });

  test('Read1件の場合は単数形', () => {
    const result = formatBatchText([{ toolName: 'Read', count: 1 }]);
    expect(result).toBe('read 1 file');
  });

  test('検索1件の場合は単数形', () => {
    const result = formatBatchText([{ toolName: 'Grep', count: 1 }]);
    expect(result).toBe('Searched for 1 pattern');
  });

  test('検索とReadの混合', () => {
    const result = formatBatchText([
      { toolName: 'Grep', count: 2 },
      { toolName: 'Read', count: 1 },
    ]);
    expect(result).toContain('Searched for 2 patterns');
    expect(result).toContain('read 1 file');
  });

  test('未知のツール名のフォールバック', () => {
    const result = formatBatchText([{ toolName: 'CustomTool', count: 2 }]);
    expect(result).toContain('customtool 2 items');
  });

  test('未知のツール名1件の場合は単数形', () => {
    const result = formatBatchText([{ toolName: 'CustomTool', count: 1 }]);
    expect(result).toContain('customtool 1 item');
  });
});

describe('tryMergeBatch', () => {
  test('空の配列の場合はnullを返す', () => {
    const entry = makeToolGroupEntry('Read');
    const result = tryMergeBatch([], entry);
    expect(result).toBeNull();
  });

  test('非batchableツールの場合はnullを返す', () => {
    const entries = [makeToolGroupEntry('Bash')];
    const newEntry = makeToolGroupEntry('Bash');
    const result = tryMergeBatch(entries, newEntry);
    expect(result).toBeNull();
  });

  test('新エントリがtool_groupでない場合はnullを返す', () => {
    const entries = [makeToolGroupEntry('Read')];
    const newEntry: LogEntry = {
      kind: 'assistant_text',
      text: 'Hello',
      timestamp: Date.now(),
    };
    const result = tryMergeBatch(entries, newEntry);
    expect(result).toBeNull();
  });

  test('新エントリにtoolNameがない場合はnullを返す', () => {
    const entries = [makeToolGroupEntry('Read')];
    const newEntry: LogEntry = {
      kind: 'tool_group',
      text: 'something',
      timestamp: Date.now(),
      // toolName intentionally omitted
    };
    const result = tryMergeBatch(entries, newEntry);
    expect(result).toBeNull();
  });

  test('前のエントリがbatchableでない場合はnullを返す', () => {
    const entries: LogEntry[] = [
      { kind: 'assistant_text', text: 'Hello', timestamp: Date.now() },
    ];
    const newEntry = makeToolGroupEntry('Read');
    const result = tryMergeBatch(entries, newEntry);
    expect(result).toBeNull();
  });

  test('2つのbatchable tool_groupを1つのtool_batchにマージする', () => {
    const readEntry1 = makeToolGroupEntry('Read', 'tu-read-1');
    const readEntry2 = makeToolGroupEntry('Read', 'tu-read-2');

    const result = tryMergeBatch([readEntry1], readEntry2);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0].kind).toBe('tool_batch');
    expect(result![0].batchedTools).toHaveLength(1);
    expect(result![0].batchedTools![0].toolName).toBe('Read');
    expect(result![0].batchedTools![0].count).toBe(2);
    expect(result![0].text).toContain('read 2 files');
  });

  test('異なるbatchableツール同士でもマージする', () => {
    const readEntry = makeToolGroupEntry('Read', 'tu-read-1');
    const grepEntry = makeToolGroupEntry('Grep', 'tu-grep-1');

    const result = tryMergeBatch([readEntry], grepEntry);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0].kind).toBe('tool_batch');
    expect(result![0].batchedTools).toHaveLength(2);
  });

  test('既存のtool_batchに同じツールを追加する', () => {
    const batchEntry = makeToolBatchEntry([{ toolName: 'Read', count: 2 }]);
    const newEntry = makeToolGroupEntry('Read', 'tu-read-3');

    const result = tryMergeBatch([batchEntry], newEntry);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0].kind).toBe('tool_batch');
    expect(result![0].batchedTools![0].toolName).toBe('Read');
    expect(result![0].batchedTools![0].count).toBe(3);
    expect(result![0].text).toContain('read 3 files');
  });

  test('既存のtool_batchに異なるツールを追加する', () => {
    const batchEntry = makeToolBatchEntry([{ toolName: 'Read', count: 2 }]);
    const newEntry = makeToolGroupEntry('Grep', 'tu-grep-1');

    const result = tryMergeBatch([batchEntry], newEntry);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0].kind).toBe('tool_batch');
    expect(result![0].batchedTools).toHaveLength(2);
    expect(result![0].batchedTools![0].toolName).toBe('Read');
    expect(result![0].batchedTools![0].count).toBe(2);
    expect(result![0].batchedTools![1].toolName).toBe('Grep');
    expect(result![0].batchedTools![1].count).toBe(1);
  });

  test('前方のエントリは変更しない', () => {
    const textEntry: LogEntry = {
      kind: 'assistant_text',
      text: 'Thinking...',
      timestamp: Date.now(),
    };
    const readEntry = makeToolGroupEntry('Read', 'tu-read-1');
    const newRead = makeToolGroupEntry('Read', 'tu-read-2');

    const result = tryMergeBatch([textEntry, readEntry], newRead);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(2);
    expect(result![0].kind).toBe('assistant_text');
    expect(result![1].kind).toBe('tool_batch');
  });
});
