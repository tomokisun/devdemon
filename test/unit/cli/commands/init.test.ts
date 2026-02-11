import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { initCommand } from '../../../../src/cli/commands/init.js';

describe('init command', () => {
  let testDir: string;
  let originalLog: typeof console.log;
  let originalCwd: typeof process.cwd;
  let logOutput: string[];

  beforeEach(() => {
    testDir = join(tmpdir(), `devdemon-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });

    // コンソール出力をキャプチャ
    originalLog = console.log;
    originalCwd = process.cwd;
    logOutput = [];

    console.log = (...args) => {
      logOutput.push(args.join(' '));
    };

    // process.cwdをモック
    process.cwd = mock(() => testDir);
  });

  afterEach(() => {
    console.log = originalLog;
    process.cwd = originalCwd;

    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  test('新規ディレクトリに.devdemon/とsettings.jsonを作成する', async () => {
    // コマンドを実行
    await initCommand.parseAsync([], { from: 'user' });

    // ディレクトリが作成されたか確認
    const devdemonDir = join(testDir, '.devdemon');
    expect(existsSync(devdemonDir)).toBe(true);

    // settings.jsonが作成されたか確認
    const settingsPath = join(devdemonDir, 'settings.json');
    expect(existsSync(settingsPath)).toBe(true);

    // settings.jsonの内容を確認
    const content = readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    expect(settings).toEqual({ language: '', model: '' });

    // コンソール出力を確認
    expect(logOutput).toContain('Created .devdemon/ directory.');
    expect(logOutput).toContain('Created .devdemon/settings.json template.');
  });

  test('既に.devdemon/が存在する場合、settings.jsonのみ作成する', async () => {
    // 先に.devdemon/ディレクトリを作成
    const devdemonDir = join(testDir, '.devdemon');
    mkdirSync(devdemonDir, { recursive: true });

    // コマンドを実行
    await initCommand.parseAsync([], { from: 'user' });

    // settings.jsonが作成されたか確認
    const settingsPath = join(devdemonDir, 'settings.json');
    expect(existsSync(settingsPath)).toBe(true);

    // コンソール出力を確認（ディレクトリ作成メッセージはない）
    expect(logOutput).not.toContain('Created .devdemon/ directory.');
    expect(logOutput).toContain('Created .devdemon/settings.json template.');
  });

  test('既に初期化済みの場合はメッセージを表示する', async () => {
    // .devdemon/とsettings.jsonを事前に作成
    const devdemonDir = join(testDir, '.devdemon');
    mkdirSync(devdemonDir, { recursive: true });
    const settingsPath = join(devdemonDir, 'settings.json');
    const template = JSON.stringify({ language: 'ja', model: 'claude' }, null, 2);
    require('fs').writeFileSync(settingsPath, template + '\n');

    // コマンドを実行
    await initCommand.parseAsync([], { from: 'user' });

    // コンソール出力を確認
    expect(logOutput).toContain('Already initialized: .devdemon/ directory exists.');
    expect(logOutput).not.toContain('Created .devdemon/ directory.');
    expect(logOutput).not.toContain('Created .devdemon/settings.json template.');
  });
});
