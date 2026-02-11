import { describe, test, expect, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import {
  getDevDemonDir,
  getStatePath,
  getQueuePath,
  getLogPath,
  getSettingsPath,
  ensureDevDemonDir,
} from '../../../src/utils/paths.js';

describe('Paths', () => {
  let testDir: string | undefined;

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    testDir = undefined;
  });

  test('getDevDemonDir() が .devdemon/ パスを返す', () => {
    const dir = getDevDemonDir('/my/repo');
    expect(dir).toBe(join('/my/repo', '.devdemon'));
  });

  test('getStatePath() が state.json パスを返す', () => {
    const p = getStatePath('/my/repo');
    expect(p).toBe(join('/my/repo', '.devdemon', 'state.json'));
  });

  test('getQueuePath() が queue.json パスを返す', () => {
    const p = getQueuePath('/my/repo');
    expect(p).toBe(join('/my/repo', '.devdemon', 'queue.json'));
  });

  test('getLogPath() が debug.log パスを返す', () => {
    const p = getLogPath('/my/repo');
    expect(p).toBe(join('/my/repo', '.devdemon', 'debug.log'));
  });

  test('ensureDevDemonDir() がディレクトリを作成する', () => {
    testDir = join(tmpdir(), `devdemon-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    const dir = ensureDevDemonDir(testDir);
    expect(existsSync(dir)).toBe(true);
    expect(dir).toBe(join(testDir, '.devdemon'));
  });

  test('すでに存在する場合はensureDevDemonDir()はエラーにならない', () => {
    testDir = join(tmpdir(), `devdemon-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    const dir1 = ensureDevDemonDir(testDir);
    const dir2 = ensureDevDemonDir(testDir);
    expect(dir1).toBe(dir2);
    expect(existsSync(dir2)).toBe(true);
  });

  test('getSettingsPath() が settings.json パスを返す', () => {
    const p = getSettingsPath('/my/repo');
    expect(p).toBe(join('/my/repo', '.devdemon', 'settings.json'));
  });
});
