import { describe, test, expect, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { ProgressTracker } from '../../../src/agent/progress-tracker.js';

describe('ProgressTracker', () => {
  let testDir: string | undefined;

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    testDir = undefined;
  });

  test('read()はファイルが存在する場合その内容を返す', () => {
    testDir = join(tmpdir(), `devdemon-progress-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'progress.md'), '# Progress\n- Task 1 done');

    const tracker = new ProgressTracker(testDir);
    const content = tracker.read();
    expect(content).toBe('# Progress\n- Task 1 done');
  });

  test('read()はファイルが存在しない場合nullを返す', () => {
    testDir = join(tmpdir(), `devdemon-progress-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });

    const tracker = new ProgressTracker(testDir);
    const content = tracker.read();
    expect(content).toBeNull();
  });

  test('read()はファイルが空の場合空文字列を返す', () => {
    testDir = join(tmpdir(), `devdemon-progress-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'progress.md'), '');

    const tracker = new ProgressTracker(testDir);
    const content = tracker.read();
    expect(content).toBe('');
  });
});
