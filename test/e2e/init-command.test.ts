import { describe, test, expect, afterEach } from 'bun:test';
import { spawnDevDemon } from '../helpers/spawn-devdemon.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

describe('devdemon init (E2E)', () => {
  let testDir: string;

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  test('creates .devdemon/ directory in temp dir', async () => {
    testDir = join(tmpdir(), `devdemon-e2e-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });

    const result = await spawnDevDemon(['init'], { cwd: testDir });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('.devdemon/');
    expect(existsSync(join(testDir, '.devdemon'))).toBe(true);
  });

  test('running twice is idempotent', async () => {
    testDir = join(tmpdir(), `devdemon-e2e-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });

    const first = await spawnDevDemon(['init'], { cwd: testDir });
    expect(first.exitCode).toBe(0);

    const second = await spawnDevDemon(['init'], { cwd: testDir });
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain('Already initialized');
  });

});
