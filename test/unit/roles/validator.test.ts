import { describe, test, expect } from 'bun:test';
import {
  validateFrontmatter,
  validateInterval,
  validateMaxTurns,
  validatePermissionMode,
  validateRoleName,
  validateIntervalOverride,
  formatValidationError,
} from '../../../src/roles/validator.js';
import { z } from 'zod';

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
    expect(result.maxTurns).toBe(50);
    expect(result.permissionMode).toBe('acceptEdits');
  });

  test('各デフォルト値が正しい（interval=300, maxTurns=50, permissionMode=acceptEdits）', () => {
    const result = validateFrontmatter({ name: 'Defaults Check' });
    expect(result.interval).toBe(300);
    expect(result.maxTurns).toBe(50);
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

describe('validateInterval', () => {
  test('正の数値を受け付ける', () => {
    expect(validateInterval(60)).toBe(60);
    expect(validateInterval(1)).toBe(1);
    expect(validateInterval(0.5)).toBe(0.5);
  });

  test('0以下の値はエラー', () => {
    expect(() => validateInterval(0)).toThrow();
    expect(() => validateInterval(-1)).toThrow();
  });
});

describe('validateMaxTurns', () => {
  test('正の整数を受け付ける', () => {
    expect(validateMaxTurns(1)).toBe(1);
    expect(validateMaxTurns(50)).toBe(50);
    expect(validateMaxTurns(100)).toBe(100);
  });

  test('0以下の値はエラー', () => {
    expect(() => validateMaxTurns(0)).toThrow();
    expect(() => validateMaxTurns(-5)).toThrow();
  });

  test('小数はエラー', () => {
    expect(() => validateMaxTurns(1.5)).toThrow();
  });
});

describe('validatePermissionMode', () => {
  test('有効なpermissionModeを受け付ける', () => {
    expect(validatePermissionMode('default')).toBe('default');
    expect(validatePermissionMode('acceptEdits')).toBe('acceptEdits');
    expect(validatePermissionMode('bypassPermissions')).toBe('bypassPermissions');
  });

  test('無効な値はエラー', () => {
    expect(() => validatePermissionMode('invalid')).toThrow();
    expect(() => validatePermissionMode('')).toThrow();
  });
});

describe('validateRoleName', () => {
  test('有効なロール名を受け付ける', () => {
    expect(validateRoleName('swe')).toBe('swe');
    expect(validateRoleName('my-role')).toBe('my-role');
    expect(validateRoleName('Role 1')).toBe('Role 1');
  });

  test('空文字はエラー', () => {
    expect(() => validateRoleName('')).toThrow();
  });

  test('特殊文字で始まる名前はエラー', () => {
    expect(() => validateRoleName('-invalid')).toThrow();
  });
});

describe('validateIntervalOverride', () => {
  test('数値文字列を数値に変換する', () => {
    expect(validateIntervalOverride('60')).toBe(60);
    expect(validateIntervalOverride('0.5')).toBe(0.5);
  });

  test('非数値文字列はエラー', () => {
    expect(() => validateIntervalOverride('abc')).toThrow();
  });

  test('0以下の値はエラー', () => {
    expect(() => validateIntervalOverride('0')).toThrow();
    expect(() => validateIntervalOverride('-5')).toThrow();
  });
});

describe('formatValidationError', () => {
  test('ZodErrorのissuesをセミコロン区切りで連結する', () => {
    try {
      z.object({ name: z.string().min(1, 'Name required'), age: z.number().positive('Age must be positive') }).parse({ name: '', age: -1 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const msg = formatValidationError(error);
        expect(msg).toContain('Name required');
        expect(msg).toContain('Age must be positive');
        expect(msg).toContain('; ');
      }
    }
  });
});
