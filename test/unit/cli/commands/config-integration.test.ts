import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { Command } from 'commander';
import { configCommand } from '../../../../src/cli/commands/config.js';
import { SettingsStore } from '../../../../src/settings/store.js';
import { getSettingsPath } from '../../../../src/utils/paths.js';

describe('config command integration', () => {
  let testDir: string;
  let consoleLogMock: any;
  let consoleErrorMock: any;
  let processExitMock: any;
  let capturedOutput: string[];

  beforeEach(() => {
    testDir = join(tmpdir(), `devdemon-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    capturedOutput = [];

    // Mock console methods
    consoleLogMock = mock(() => {});
    consoleErrorMock = mock(() => {});
    processExitMock = mock(() => { throw new Error('process.exit'); });

    global.console.log = (...args: any[]) => {
      capturedOutput.push(args.join(' '));
      consoleLogMock(...args);
    };
    global.console.error = consoleErrorMock;
    global.process.exit = processExitMock as any;
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('config list', () => {
    test('設定されていない値を表示する', async () => {
      const rootCmd = new Command();
      rootCmd.option('--repo <path>');
      rootCmd.addCommand(configCommand);

      await rootCmd.parseAsync(['config', 'list', '--repo', testDir], { from: 'user' });

      expect(capturedOutput).toContain('language = (not set)');
      expect(capturedOutput).toContain('model    = (not set)');
    });

    test('設定された値を表示する', async () => {
      // 先に設定を保存
      const store = new SettingsStore(getSettingsPath(testDir));
      store.set('language', 'ja');
      store.set('model', 'claude-3-sonnet');

      const rootCmd = new Command();
      rootCmd.option('--repo <path>');
      rootCmd.addCommand(configCommand);

      await rootCmd.parseAsync(['config', 'list', '--repo', testDir], { from: 'user' });

      expect(capturedOutput).toContain('language = ja');
      expect(capturedOutput).toContain('model    = claude-3-sonnet');
    });
  });

  describe('config set', () => {
    test('languageを設定できる', async () => {
      const rootCmd = new Command();
      rootCmd.option('--repo <path>');
      rootCmd.addCommand(configCommand);

      await rootCmd.parseAsync(['config', 'set', 'language', 'en', '--repo', testDir], { from: 'user' });

      expect(capturedOutput).toContain('Set language = en');

      // 実際に保存されたか確認
      const store = new SettingsStore(getSettingsPath(testDir));
      expect(store.get().language).toBe('en');
    });

    test('modelを設定できる', async () => {
      const rootCmd = new Command();
      rootCmd.option('--repo <path>');
      rootCmd.addCommand(configCommand);

      await rootCmd.parseAsync(['config', 'set', 'model', 'claude-3-haiku', '--repo', testDir], { from: 'user' });

      expect(capturedOutput).toContain('Set model = claude-3-haiku');

      const store = new SettingsStore(getSettingsPath(testDir));
      expect(store.get().model).toBe('claude-3-haiku');
    });

    test('無効なキーでエラーになる', async () => {
      const rootCmd = new Command();
      rootCmd.option('--repo <path>');
      rootCmd.addCommand(configCommand);

      try {
        await rootCmd.parseAsync(['config', 'set', 'invalidKey', 'value', '--repo', testDir], { from: 'user' });
      } catch (error: any) {
        expect(error.message).toBe('process.exit');
      }

      expect(consoleErrorMock).toHaveBeenCalledWith('Error: Unknown setting "invalidKey". Valid keys: language, model');
      expect(processExitMock).toHaveBeenCalledWith(1);
    });
  });

  describe('config get', () => {
    test('設定されていない値を取得する', async () => {
      const rootCmd = new Command();
      rootCmd.option('--repo <path>');
      rootCmd.addCommand(configCommand);

      await rootCmd.parseAsync(['config', 'get', 'language', '--repo', testDir], { from: 'user' });

      expect(capturedOutput).toContain('(not set)');
    });

    test('設定された値を取得する', async () => {
      const store = new SettingsStore(getSettingsPath(testDir));
      store.set('model', 'claude-3-opus');

      const rootCmd = new Command();
      rootCmd.option('--repo <path>');
      rootCmd.addCommand(configCommand);

      await rootCmd.parseAsync(['config', 'get', 'model', '--repo', testDir], { from: 'user' });

      expect(capturedOutput).toContain('claude-3-opus');
    });

    test('無効なキーでエラーになる', async () => {
      const rootCmd = new Command();
      rootCmd.option('--repo <path>');
      rootCmd.addCommand(configCommand);

      try {
        await rootCmd.parseAsync(['config', 'get', 'invalidKey', '--repo', testDir], { from: 'user' });
      } catch (error: any) {
        expect(error.message).toBe('process.exit');
      }

      expect(consoleErrorMock).toHaveBeenCalledWith('Error: Unknown setting "invalidKey". Valid keys: language, model');
      expect(processExitMock).toHaveBeenCalledWith(1);
    });
  });

  describe('リポジトリパスのデフォルト値', () => {
    test('--repoオプションなしでprocess.cwd()を使用する', async () => {
      // cwdをテスト用ディレクトリに変更
      const originalCwd = process.cwd();
      // .devdemonディレクトリを事前に作成（Logger がログファイルを書き込むため）
      mkdirSync(join(testDir, '.devdemon'), { recursive: true });
      process.chdir(testDir);

      try {
        const rootCmd = new Command();
        rootCmd.option('--repo <path>');
        rootCmd.addCommand(configCommand);

        await rootCmd.parseAsync(['config', 'list'], { from: 'user' });

        expect(capturedOutput).toContain('language = (not set)');
        expect(capturedOutput).toContain('model    = (not set)');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});