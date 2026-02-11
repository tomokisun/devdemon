import { describe, test, expect } from 'bun:test';
import { spawnDevDemon } from '../helpers/spawn-devdemon.js';

describe('devdemon start (E2E)', () => {
  test('--role with nonexistent role exits with error', async () => {
    // start options are on the main program (no 'start' subcommand)
    const result = await spawnDevDemon(['--role', 'nonexistent'], { timeout: 5000 });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Role "nonexistent" not found');
  });

  test('--help shows usage information', async () => {
    const result = await spawnDevDemon(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Autonomous AI agent daemon');
    expect(result.stdout).toContain('--role');
    expect(result.stdout).toContain('--repo');
  });

  test.skip('starting with valid role shows startup message', async () => {
    // Skip: The daemon attempts to call the Claude API via Agent SDK,
    // which requires valid API credentials. In CI/test environments without
    // API access, the process may hang or error unpredictably.
    const result = await spawnDevDemon(['--role', 'swe'], { timeout: 3000 });
    // Process will be killed by timeout; we just verify it attempted to start
    expect(result.stdout + result.stderr).toBeTruthy();
  });
});
