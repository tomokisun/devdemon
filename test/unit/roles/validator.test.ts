import { describe, test, expect } from 'bun:test';
import { validateFrontmatter } from '../../../src/roles/validator.js';

describe('validateFrontmatter', () => {
  test('全フィールド指定でバリデーション通過', () => {
    const result = validateFrontmatter({
      name: 'Test Role',
      interval: 120,
      maxTurns: 10,
      tools: ['Read', 'Write'],
      permissionMode: 'bypassPermissions',
      description: 'A test role',
      tags: ['test', 'dev'],
    });
    expect(result.name).toBe('Test Role');
    expect(result.interval).toBe(120);
    expect(result.maxTurns).toBe(10);
    expect(result.tools).toEqual(['Read', 'Write']);
    expect(result.permissionMode).toBe('bypassPermissions');
    expect(result.description).toBe('A test role');
    expect(result.tags).toEqual(['test', 'dev']);
  });

  test('必須フィールドのみでデフォルト値適用', () => {
    const result = validateFrontmatter({ name: 'Minimal' });
    expect(result.name).toBe('Minimal');
    expect(result.interval).toBe(300);
    expect(result.maxTurns).toBe(25);
    expect(result.permissionMode).toBe('acceptEdits');
  });

  test('各デフォルト値が正しい（interval=300, maxTurns=25, permissionMode=acceptEdits）', () => {
    const result = validateFrontmatter({ name: 'Defaults Check' });
    expect(result.interval).toBe(300);
    expect(result.maxTurns).toBe(25);
    expect(result.permissionMode).toBe('acceptEdits');
    expect(result.tools).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.tags).toBeUndefined();
  });

  test('nameが空文字の場合はエラー', () => {
    expect(() => validateFrontmatter({ name: '' })).toThrow();
  });

  test('nameがない場合はエラー', () => {
    expect(() => validateFrontmatter({ interval: 300 })).toThrow();
  });

  test('intervalが数値でない場合はエラー', () => {
    expect(() => validateFrontmatter({ name: 'Bad', interval: 'not-a-number' })).toThrow();
  });

  test('不明なフィールドは無視される', () => {
    const result = validateFrontmatter({
      name: 'Extra Fields',
      unknownField: 'should be ignored',
      anotherExtra: 42,
    });
    expect(result.name).toBe('Extra Fields');
    expect((result as Record<string, unknown>)['unknownField']).toBeUndefined();
  });
});
