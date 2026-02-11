import { describe, test, expect } from 'bun:test';
import { spawnDevDemon } from '../helpers/spawn-devdemon.js';

describe('devdemon roles (E2E)', () => {
  test('roles list displays default role names', async () => {
    const result = await spawnDevDemon(['roles', 'list']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Software Engineer');
    expect(result.stdout).toContain('Product Manager');
    expect(result.stdout).toContain('Code Reviewer');
  });

  test('roles show swe displays SWE role details', async () => {
    const result = await spawnDevDemon(['roles', 'show', 'swe']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Software Engineer');
    expect(result.stdout).toContain('Interval:');
    expect(result.stdout).toContain('300s');
    expect(result.stdout).toContain('Description:');
  });

  test('roles show nonexistent displays error and exits with code 1', async () => {
    const result = await spawnDevDemon(['roles', 'show', 'nonexistent']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Error: Role "nonexistent" not found');
  });

  test('roles create --help shows usage', async () => {
    const result = await spawnDevDemon(['roles', 'create', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Create a new role');
  });
});
