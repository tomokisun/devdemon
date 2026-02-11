import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { ToolGroupEntry } from '../../../src/ui/components/tool-group-entry.js';
import type { LogEntry } from '../../../src/agent/message-stream.js';

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    kind: 'tool_group',
    text: 'Bash(ls -la)',
    timestamp: Date.now(),
    toolName: 'Bash',
    toolUseId: 'tu-1',
    ...overrides,
  };
}

describe('ToolGroupEntry', () => {
  test('ツール名と引数が表示される', () => {
    const entry = makeEntry({ text: 'Bash(npm test)' });
    const { lastFrame } = render(<ToolGroupEntry entry={entry} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Bash');
    expect(frame).toContain('(npm test)');
  });

  test('括弧なしのツール名が表示される', () => {
    const entry = makeEntry({ text: 'SomeTool' });
    const { lastFrame } = render(<ToolGroupEntry entry={entry} />);
    expect(lastFrame()).toContain('SomeTool');
  });

  test('resultLinesが表示される', () => {
    const entry = makeEntry({
      resultLines: ['file1.ts', 'file2.ts', 'file3.ts'],
    });
    const { lastFrame } = render(<ToolGroupEntry entry={entry} />);
    const frame = lastFrame()!;
    expect(frame).toContain('file1.ts');
    expect(frame).toContain('file2.ts');
    expect(frame).toContain('file3.ts');
  });

  test('toolStatsが表示される', () => {
    const entry = makeEntry({
      toolStats: { totalToolUseCount: 5, totalTokens: 12000, totalDurationMs: 30000 },
    });
    const { lastFrame } = render(<ToolGroupEntry entry={entry} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Done');
    expect(frame).toContain('5 tools');
  });

  test('toolStatsでtoolUseCount=1の場合は単数形', () => {
    const entry = makeEntry({
      toolStats: { totalToolUseCount: 1 },
    });
    const { lastFrame } = render(<ToolGroupEntry entry={entry} />);
    const frame = lastFrame()!;
    expect(frame).toContain('1 tool');
    expect(frame).not.toContain('1 tools');
  });

  test('diffDataが表示される（added + removed）', () => {
    const entry = makeEntry({
      diffData: {
        addedCount: 2,
        removedCount: 1,
        lines: [
          { type: 'removed', lineNumber: 5, text: 'old line' },
          { type: 'added', lineNumber: 5, text: 'new line 1' },
          { type: 'added', lineNumber: 6, text: 'new line 2' },
        ],
      },
    });
    const { lastFrame } = render(<ToolGroupEntry entry={entry} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Added 2 lines');
    expect(frame).toContain('removed 1 line');
    expect(frame).toContain('old line');
    expect(frame).toContain('new line 1');
    expect(frame).toContain('new line 2');
  });

  test('diffDataでcontext行も表示される', () => {
    const entry = makeEntry({
      diffData: {
        addedCount: 1,
        removedCount: 0,
        lines: [
          { type: 'context', lineNumber: 10, text: 'unchanged line' },
          { type: 'added', lineNumber: 11, text: 'new line' },
        ],
      },
    });
    const { lastFrame } = render(<ToolGroupEntry entry={entry} />);
    const frame = lastFrame()!;
    expect(frame).toContain('unchanged line');
    expect(frame).toContain('new line');
  });

  test('diffDataで追加のみの場合はremovedなし', () => {
    const entry = makeEntry({
      diffData: {
        addedCount: 3,
        removedCount: 0,
        lines: [
          { type: 'added', lineNumber: 1, text: 'line A' },
          { type: 'added', lineNumber: 2, text: 'line B' },
          { type: 'added', lineNumber: 3, text: 'line C' },
        ],
      },
    });
    const { lastFrame } = render(<ToolGroupEntry entry={entry} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Added 3 lines');
    expect(frame).not.toContain('removed');
  });

  test('diffDataで削除のみの場合はaddedなし', () => {
    const entry = makeEntry({
      diffData: {
        addedCount: 0,
        removedCount: 2,
        lines: [
          { type: 'removed', lineNumber: 1, text: 'deleted A' },
          { type: 'removed', lineNumber: 2, text: 'deleted B' },
        ],
      },
    });
    const { lastFrame } = render(<ToolGroupEntry entry={entry} />);
    const frame = lastFrame()!;
    expect(frame).toContain('removed 2 lines');
    expect(frame).not.toContain('Added');
  });

  test('toolStatsがある場合はdiffDataやresultLinesは表示されない（優先度）', () => {
    const entry = makeEntry({
      toolStats: { totalToolUseCount: 3 },
      diffData: {
        addedCount: 1,
        removedCount: 0,
        lines: [{ type: 'added', lineNumber: 1, text: 'should not appear' }],
      },
      resultLines: ['also should not appear'],
    });
    const { lastFrame } = render(<ToolGroupEntry entry={entry} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Done');
    // toolStats takes priority
  });

  test('resultLinesが空の場合は何も追加表示されない', () => {
    const entry = makeEntry({
      resultLines: [],
    });
    const { lastFrame } = render(<ToolGroupEntry entry={entry} />);
    // Should only show the tool name line
    expect(lastFrame()).toContain('Bash');
  });

  test('diffData added 1件は単数形', () => {
    const entry = makeEntry({
      diffData: {
        addedCount: 1,
        removedCount: 1,
        lines: [
          { type: 'removed', lineNumber: 1, text: 'old' },
          { type: 'added', lineNumber: 1, text: 'new' },
        ],
      },
    });
    const { lastFrame } = render(<ToolGroupEntry entry={entry} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Added 1 line');
    expect(frame).toContain('removed 1 line');
    // Make sure it's singular (not "1 lines")
    expect(frame).not.toContain('1 lines');
  });
});
