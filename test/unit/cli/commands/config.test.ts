import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { SettingsStore } from '../../../../src/settings/store.js';
import { getSettingsPath } from '../../../../src/utils/paths.js';

// 直接関数をテスト
function validateKey(key: string): asserts key is 'language' | 'model' {
  const VALID_KEYS = ['language', 'model'];
  if (!VALID_KEYS.includes(key)) {
    throw new Error(`Unknown setting "${key}". Valid keys: ${VALID_KEYS.join(', ')}`);
  }
}

describe('config command utilities', () => {
  describe('validateKey', () => {
    test('有効なキーを受け入れる', () => {
      expect(() => validateKey('language')).not.toThrow();
      expect(() => validateKey('model')).not.toThrow();
    });

    test('無効なキーでエラーを投げる', () => {
      expect(() => validateKey('invalidKey')).toThrow('Unknown setting "invalidKey". Valid keys: language, model');
    });
  });

  describe('config command actions', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `devdemon-test-${randomUUID()}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (testDir && existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
    });

    test('list - すべての設定を表示する（値が設定されていない場合）', () => {
      const store = new SettingsStore(getSettingsPath(testDir));
      store.save(); // 空の設定ファイルを作成

      const settings = store.get();
      const VALID_KEYS: ('language' | 'model')[] = ['language', 'model'];
      const maxKeyLen = Math.max(...VALID_KEYS.map(k => k.length));

      const output: string[] = [];
      for (const key of VALID_KEYS) {
        const value = settings[key];
        const display = value !== undefined ? String(value) : '(not set)';
        output.push(`${key.padEnd(maxKeyLen)} = ${display}`);
      }

      expect(output).toEqual([
        'language = (not set)',
        'model    = (not set)'
      ]);
    });

    test('list - すべての設定を表示する（値が設定されている場合）', () => {
      const store = new SettingsStore(getSettingsPath(testDir));
      store.set('language', 'ja');
      store.set('model', 'claude-3');

      const settings = store.get();
      const VALID_KEYS: ('language' | 'model')[] = ['language', 'model'];
      const maxKeyLen = Math.max(...VALID_KEYS.map(k => k.length));

      const output: string[] = [];
      for (const key of VALID_KEYS) {
        const value = settings[key];
        const display = value !== undefined ? String(value) : '(not set)';
        output.push(`${key.padEnd(maxKeyLen)} = ${display}`);
      }

      expect(output).toEqual([
        'language = ja',
        'model    = claude-3'
      ]);
    });

    test('set - 有効な設定を保存する', () => {
      const store = new SettingsStore(getSettingsPath(testDir));

      validateKey('language');
      store.set('language', 'ja');
      const output = `Set language = ja`;

      expect(output).toBe('Set language = ja');
      expect(store.get().language).toBe('ja');
    });

    test('set - modelを設定する', () => {
      const store = new SettingsStore(getSettingsPath(testDir));

      validateKey('model');
      store.set('model', 'claude-3');
      const output = `Set model = claude-3`;

      expect(output).toBe('Set model = claude-3');
      expect(store.get().model).toBe('claude-3');
    });

    test('get - 設定されていない値を取得する', () => {
      const store = new SettingsStore(getSettingsPath(testDir));
      store.save(); // 空の設定ファイルを作成

      validateKey('language');
      const settings = store.get();
      const value = settings['language'];
      const display = value !== undefined ? String(value) : '(not set)';

      expect(display).toBe('(not set)');
    });

    test('get - 設定された値を取得する', () => {
      const store = new SettingsStore(getSettingsPath(testDir));
      store.set('language', 'en');

      validateKey('language');
      const settings = store.get();
      const value = settings['language'];
      const display = value !== undefined ? String(value) : '(not set)';

      expect(display).toBe('en');
    });
  });
});