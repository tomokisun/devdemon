import { describe, test, expect } from 'bun:test';
import { parseDiffFromEditInput, parseDiffFromResultLines } from '../../../src/ui/hooks/diff-parser.js';

describe('parseDiffFromEditInput', () => {
  test('returns null when old_string is not a string', () => {
    expect(parseDiffFromEditInput({ old_string: 123, new_string: 'abc' })).toBeNull();
  });

  test('returns null when new_string is not a string', () => {
    expect(parseDiffFromEditInput({ old_string: 'abc', new_string: undefined })).toBeNull();
  });

  test('returns null when both fields are missing', () => {
    expect(parseDiffFromEditInput({})).toBeNull();
  });

  test('parses a simple single-line replacement', () => {
    const result = parseDiffFromEditInput({
      old_string: 'hello',
      new_string: 'world',
    });

    expect(result).not.toBeNull();
    expect(result!.addedCount).toBe(1);
    expect(result!.removedCount).toBe(1);
    expect(result!.lines).toHaveLength(2);
    expect(result!.lines[0].type).toBe('removed');
    expect(result!.lines[0].text).toBe('hello');
    expect(result!.lines[1].type).toBe('added');
    expect(result!.lines[1].text).toBe('world');
  });

  test('parses a multi-line edit with context', () => {
    const result = parseDiffFromEditInput({
      old_string: 'line1\nline2\nline3\nline4',
      new_string: 'line1\nmodified\nline3\nline4',
    });

    expect(result).not.toBeNull();
    expect(result!.addedCount).toBe(1);
    expect(result!.removedCount).toBe(1);

    // Should have context + removed + added + context lines
    const types = result!.lines.map(l => l.type);
    expect(types).toContain('context');
    expect(types).toContain('removed');
    expect(types).toContain('added');
  });

  test('parses additions only (no removals)', () => {
    const result = parseDiffFromEditInput({
      old_string: 'line1\nline2',
      new_string: 'line1\nnew_line\nline2',
    });

    expect(result).not.toBeNull();
    expect(result!.addedCount).toBeGreaterThan(0);
    expect(result!.removedCount).toBe(0);
  });

  test('parses removals only (no additions)', () => {
    const result = parseDiffFromEditInput({
      old_string: 'line1\nline2\nline3',
      new_string: 'line1\nline3',
    });

    expect(result).not.toBeNull();
    expect(result!.removedCount).toBeGreaterThan(0);
    expect(result!.addedCount).toBe(0);
  });

  test('returns null when old and new are identical', () => {
    const result = parseDiffFromEditInput({
      old_string: 'same content',
      new_string: 'same content',
    });

    // All lines are context, no changes detected -> null because no change indices
    expect(result).toBeNull();
  });

  test('handles empty strings', () => {
    const result = parseDiffFromEditInput({
      old_string: '',
      new_string: 'new content',
    });

    expect(result).not.toBeNull();
    expect(result!.addedCount).toBeGreaterThan(0);
  });

  test('line numbers are assigned to diff lines', () => {
    const result = parseDiffFromEditInput({
      old_string: 'alpha\nbeta',
      new_string: 'alpha\ngamma',
    });

    expect(result).not.toBeNull();
    for (const line of result!.lines) {
      expect(line.lineNumber).toBeGreaterThan(0);
    }
  });
});

describe('parseDiffFromResultLines', () => {
  test('returns null when no diff lines are found', () => {
    expect(parseDiffFromResultLines(['normal line', 'another line'])).toBeNull();
  });

  test('parses lines starting with + as added', () => {
    const result = parseDiffFromResultLines(['+added line']);

    expect(result).not.toBeNull();
    expect(result!.addedCount).toBe(1);
    expect(result!.removedCount).toBe(0);
    expect(result!.lines[0].type).toBe('added');
    expect(result!.lines[0].text).toBe('added line');
  });

  test('parses lines starting with - as removed', () => {
    const result = parseDiffFromResultLines(['-removed line']);

    expect(result).not.toBeNull();
    expect(result!.removedCount).toBe(1);
    expect(result!.lines[0].type).toBe('removed');
    expect(result!.lines[0].text).toBe('removed line');
  });

  test('ignores +++ and --- markers', () => {
    const result = parseDiffFromResultLines([
      '--- a/file.ts',
      '+++ b/file.ts',
      '-old',
      '+new',
    ]);

    expect(result).not.toBeNull();
    expect(result!.addedCount).toBe(1);
    expect(result!.removedCount).toBe(1);
    // --- and +++ lines should be context
    expect(result!.lines[0].type).toBe('context');
    expect(result!.lines[1].type).toBe('context');
  });

  test('mixes context, added, and removed lines', () => {
    const result = parseDiffFromResultLines([
      'context before',
      '-removed line',
      '+added line',
      'context after',
    ]);

    expect(result).not.toBeNull();
    expect(result!.addedCount).toBe(1);
    expect(result!.removedCount).toBe(1);
    expect(result!.lines).toHaveLength(4);
    expect(result!.lines[0].type).toBe('context');
    expect(result!.lines[1].type).toBe('removed');
    expect(result!.lines[2].type).toBe('added');
    expect(result!.lines[3].type).toBe('context');
  });

  test('assigns sequential line numbers', () => {
    const result = parseDiffFromResultLines(['+a', '+b', '+c']);

    expect(result).not.toBeNull();
    expect(result!.lines[0].lineNumber).toBe(1);
    expect(result!.lines[1].lineNumber).toBe(2);
    expect(result!.lines[2].lineNumber).toBe(3);
  });
});
