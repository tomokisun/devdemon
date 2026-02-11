import { describe, test, expect } from 'bun:test';
import { validateSettings } from '../../../src/settings/types.js';

describe('validateSettings', () => {
  test('有効な設定がバリデーションを通る', () => {
    const result = validateSettings({ language: 'Japanese', model: 'claude-sonnet-4-5-20250929' });
    expect(result.language).toBe('Japanese');
    expect(result.model).toBe('claude-sonnet-4-5-20250929');
  });

  test('空オブジェクトがバリデーションを通る', () => {
    const result = validateSettings({});
    expect(result).toEqual({});
  });

  test('languageのみの設定がバリデーションを通る', () => {
    const result = validateSettings({ language: 'English' });
    expect(result.language).toBe('English');
    expect(result.model).toBeUndefined();
  });

  test('modelのみの設定がバリデーションを通る', () => {
    const result = validateSettings({ model: 'claude-opus-4-20250514' });
    expect(result.model).toBe('claude-opus-4-20250514');
    expect(result.language).toBeUndefined();
  });

  test('不正な型（language: 123）の場合エラーになる', () => {
    expect(() => validateSettings({ language: 123 })).toThrow();
  });

  test('nullがエラーになる', () => {
    expect(() => validateSettings(null)).toThrow();
  });
});
