import { describe, test, expect, afterEach } from 'bun:test';
import { spawnDevDemonPty, type PtyProcess } from '../helpers/spawn-devdemon-pty.js';
import { resolve } from 'path';

const ROLES_DIR = resolve(import.meta.dir, '../fixtures/roles');
const TIMEOUT = 20000;

describe.skipIf(!!process.env.CI)('Terminal UI E2E (PTY)', () => {
  let pty: PtyProcess | null = null;

  afterEach(() => {
    pty?.kill();
    pty = null;
  });

  // Test 1: Role selection appears when multiple roles exist
  test('shows role selector with multiple roles', async () => {
    pty = spawnDevDemonPty(['--roles-dir', ROLES_DIR, '--dry-run']);
    const output = await pty.waitForText('Select a role:', TIMEOUT);
    expect(output).toContain('Software Engineer');
    expect(output).toContain('Product Manager');
  }, TIMEOUT);

  // Test 2: Pressing number key selects role and process continues running
  test('number key selects role and transitions to daemon UI', async () => {
    pty = spawnDevDemonPty(['--roles-dir', ROLES_DIR, '--dry-run']);
    await pty.waitForText('Select a role:', TIMEOUT);

    // The role selector should list all valid roles with numbers
    const beforeSelect = pty.getStrippedOutput();
    expect(beforeSelect).toMatch(/1\.\s+.*Role/);

    pty.write('1');
    // After selection, the role selector unmounts and the daemon UI renders.
    // Give time for the Ink re-render cycle to complete.
    await Bun.sleep(2000);

    // The process should still be running (dry-run keeps it alive).
    // waitForExit with a short timeout will kill the process after 500ms,
    // resulting in exit code 143 (SIGTERM). This confirms the process was
    // still alive and did not crash after role selection.
    const exitCode = await pty.waitForExit(500);
    // 143 = killed by our timeout (128 + SIGTERM=15), meaning still running
    // 0 = clean exit (also acceptable)
    expect(exitCode === 143 || exitCode === 0).toBe(true);
  }, TIMEOUT);

  // Test 3: With --role flag, auto-selects and goes directly to UI
  test('--role flag skips selector and shows daemon UI directly', async () => {
    pty = spawnDevDemonPty(['--roles-dir', ROLES_DIR, '--role', 'valid-swe', '--dry-run']);
    const output = await pty.waitForText('DevDemon', TIMEOUT);
    expect(output).toContain('Software Engineer');
  }, TIMEOUT);

  // Test 4: Text appears when typing in InputBar
  test('typed text appears in input bar', async () => {
    pty = spawnDevDemonPty(['--roles-dir', ROLES_DIR, '--role', 'valid-swe', '--dry-run']);
    await pty.waitForText('DevDemon', TIMEOUT);
    // Wait a bit for the UI to fully initialize
    await Bun.sleep(500);
    pty.write('hello world');
    const output = await pty.waitForText('hello world', TIMEOUT);
    expect(output).toContain('hello world');
  }, TIMEOUT);

  // Test 5: Shift+Enter inserts newline (Kitty keyboard protocol)
  test('Shift+Enter inserts newline without submitting', async () => {
    pty = spawnDevDemonPty(['--roles-dir', ROLES_DIR, '--role', 'valid-swe', '--dry-run']);
    await pty.waitForText('DevDemon', TIMEOUT);
    await Bun.sleep(500);

    pty.write('line one');
    await pty.waitForText('line one', TIMEOUT);

    // Shift+Enter via Kitty keyboard protocol
    pty.write('\x1b[13;2u');
    await Bun.sleep(300);

    pty.write('line two');
    const output = await pty.waitForText('line two', TIMEOUT);

    // Both lines should be visible (text was NOT submitted)
    expect(output).toContain('line one');
    expect(output).toContain('line two');
  }, TIMEOUT);

  // Test 6: Option+Enter (Meta+Enter) also inserts newline
  test('Option+Enter inserts newline without submitting', async () => {
    pty = spawnDevDemonPty(['--roles-dir', ROLES_DIR, '--role', 'valid-swe', '--dry-run']);
    await pty.waitForText('DevDemon', TIMEOUT);
    await Bun.sleep(500);

    pty.write('first');
    await pty.waitForText('first', TIMEOUT);

    // Option+Enter on macOS: ESC + CR
    pty.write('\x1b\r');
    await Bun.sleep(300);

    pty.write('second');
    const output = await pty.waitForText('second', TIMEOUT);

    expect(output).toContain('first');
    expect(output).toContain('second');
  }, TIMEOUT);

  // Test 7: Cursor block character is visible
  test('blinking cursor character appears in output', async () => {
    pty = spawnDevDemonPty(['--roles-dir', ROLES_DIR, '--role', 'valid-swe', '--dry-run']);
    await pty.waitForText('DevDemon', TIMEOUT);
    // Wait for at least one cursor blink cycle (500ms)
    await Bun.sleep(1500);
    const raw = pty.getRawOutput();
    expect(raw).toContain('\u2588');
  }, TIMEOUT);
});
