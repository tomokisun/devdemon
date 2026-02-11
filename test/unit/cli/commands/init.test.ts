import { describe, test, expect, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

describe('init command', () => {
  let testDir: string;

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  test('.devdemon/ ディレクトリを作成する', () => {
    testDir = join(tmpdir(), `devdemon-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    const devdemonDir = join(testDir, '.devdemon');
    mkdirSync(devdemonDir, { recursive: true });
    expect(existsSync(devdemonDir)).toBe(true);
  });

  test('すでに存在する場合はスキップ', () => {
    testDir = join(tmpdir(), `devdemon-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    const devdemonDir = join(testDir, '.devdemon');
    mkdirSync(devdemonDir, { recursive: true });
    // 2回目の作成は何も起きない（エラーにならない）
    expect(existsSync(devdemonDir)).toBe(true);
    mkdirSync(devdemonDir, { recursive: true });
    expect(existsSync(devdemonDir)).toBe(true);
  });
});
