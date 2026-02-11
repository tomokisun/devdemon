import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { SettingsStore } from '../../../src/settings/store.js';

describe('SettingsStore', () => {
  let testDir: string;
  let settingsPath: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `devdemon-settings-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    settingsPath = join(testDir, 'settings.json');
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  test('ファイルが存在しない場合、デフォルトの空設定を返す', () => {
    const store = new SettingsStore(join(testDir, 'nonexistent', 'settings.json'));
    const settings = store.get();
    expect(settings).toEqual({});
  });

  test('ファイルから設定を読み込める', () => {
    writeFileSync(settingsPath, JSON.stringify({ model: 'claude-sonnet-4-5-20250929', language: 'Japanese' }));
    const store = new SettingsStore(settingsPath);
    const settings = store.get();
    expect(settings.model).toBe('claude-sonnet-4-5-20250929');
    expect(settings.language).toBe('Japanese');
  });

  test('無効なJSONの場合、デフォルト設定を返す', () => {
    writeFileSync(settingsPath, '{invalid json!!!');
    const store = new SettingsStore(settingsPath);
    const settings = store.get();
    expect(settings).toEqual({});
  });

  test('set()で設定を更新してファイルに保存する', () => {
    const store = new SettingsStore(settingsPath);
    store.set('model', 'claude-opus-4-20250514');
    expect(store.getModel()).toBe('claude-opus-4-20250514');

    // ファイルにも保存されていることを確認
    const saved = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(saved.model).toBe('claude-opus-4-20250514');
  });

  test('get()でDevDemonSettingsのコピーを返す', () => {
    writeFileSync(settingsPath, JSON.stringify({ model: 'test-model' }));
    const store = new SettingsStore(settingsPath);
    const settings1 = store.get();
    const settings2 = store.get();

    // コピーなので異なるオブジェクト参照
    expect(settings1).toEqual(settings2);
    expect(settings1).not.toBe(settings2);
  });

  test('getModel()がモデル名を返す', () => {
    writeFileSync(settingsPath, JSON.stringify({ model: 'claude-sonnet-4-5-20250929' }));
    const store = new SettingsStore(settingsPath);
    expect(store.getModel()).toBe('claude-sonnet-4-5-20250929');
  });

  test('getLanguage()が言語を返す', () => {
    writeFileSync(settingsPath, JSON.stringify({ language: 'English' }));
    const store = new SettingsStore(settingsPath);
    expect(store.getLanguage()).toBe('English');
  });

  test('remove()で設定を削除してファイルに保存する', () => {
    writeFileSync(settingsPath, JSON.stringify({ model: 'test-model', language: 'Japanese' }));
    const store = new SettingsStore(settingsPath);
    store.remove('model');

    expect(store.getModel()).toBeUndefined();
    expect(store.getLanguage()).toBe('Japanese');

    // ファイルにも反映されていることを確認
    const saved = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(saved.model).toBeUndefined();
    expect(saved.language).toBe('Japanese');
  });

  test('save()がファイルに書き込む', () => {
    const store = new SettingsStore(settingsPath);
    store.set('language', 'Korean');
    store.save();

    expect(existsSync(settingsPath)).toBe(true);
    const saved = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(saved.language).toBe('Korean');
  });
});
