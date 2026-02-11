import { describe, test, expect, mock } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { mkdtempSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseGitShortstat, useGitStats, type GitFileStats } from '../../../src/ui/hooks/use-git-stats.js';

describe('parseGitShortstat', () => {
  test('parses full output with files, insertions, and deletions', () => {
    const output = ' 3 files changed, 42 insertions(+), 10 deletions(-)';
    expect(parseGitShortstat(output)).toEqual({
      filesChanged: 3,
      insertions: 42,
      deletions: 10,
    });
  });

  test('parses output with only insertions', () => {
    const output = ' 1 file changed, 5 insertions(+)';
    expect(parseGitShortstat(output)).toEqual({
      filesChanged: 1,
      insertions: 5,
      deletions: 0,
    });
  });

  test('parses output with only deletions', () => {
    const output = ' 2 files changed, 8 deletions(-)';
    expect(parseGitShortstat(output)).toEqual({
      filesChanged: 2,
      insertions: 0,
      deletions: 8,
    });
  });

  test('parses single file singular form', () => {
    const output = ' 1 file changed, 1 insertion(+), 1 deletion(-)';
    expect(parseGitShortstat(output)).toEqual({
      filesChanged: 1,
      insertions: 1,
      deletions: 1,
    });
  });

  test('returns zeros for empty output', () => {
    expect(parseGitShortstat('')).toEqual({
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
    });
  });

  test('parses large numbers', () => {
    const output = ' 25 files changed, 775 insertions(+), 1232 deletions(-)';
    expect(parseGitShortstat(output)).toEqual({
      filesChanged: 25,
      insertions: 775,
      deletions: 1232,
    });
  });
});

// Hook tests for useGitStats
let capturedStats: GitFileStats | null = null;

function HookCapture({ repoPath }: { repoPath: string }) {
  const stats = useGitStats(repoPath);
  capturedStats = stats;
  return React.createElement('ink-text', null, JSON.stringify(stats));
}

describe('useGitStats hook', () => {
  test('returns file stats for a real git repo', async () => {
    capturedStats = null;
    // Use the project root which is a git repo
    const { unmount } = render(
      React.createElement(HookCapture, { repoPath: '/Users/tomoki_sun/github.com/tomokisun/devdemon' })
    );

    await new Promise(r => setTimeout(r, 200));

    // In a git repo, stats should be non-null (either zero changes or some)
    expect(capturedStats).not.toBeNull();
    expect(typeof capturedStats!.filesChanged).toBe('number');
    expect(typeof capturedStats!.insertions).toBe('number');
    expect(typeof capturedStats!.deletions).toBe('number');

    unmount();
  });

  test('returns null for a non-git directory', async () => {
    capturedStats = null;
    // /tmp is unlikely to be a git repo
    const { unmount } = render(
      React.createElement(HookCapture, { repoPath: '/tmp' })
    );

    await new Promise(r => setTimeout(r, 200));

    // For non-git dirs, the hook catches the error and sets null
    expect(capturedStats).toBeNull();

    unmount();
  });

  test('cleans up interval on unmount', async () => {
    capturedStats = null;
    const { unmount } = render(
      React.createElement(HookCapture, { repoPath: '/Users/tomoki_sun/github.com/tomokisun/devdemon' })
    );

    await new Promise(r => setTimeout(r, 100));

    // Unmount should clean up the interval without errors
    expect(() => unmount()).not.toThrow();
  });

  test('returns zero stats for a clean git repo (empty shortstat)', async () => {
    // Create a fresh git repo with a committed file and no uncommitted changes
    const cleanRepo = mkdtempSync(join(tmpdir(), 'devdemon-clean-git-'));
    execSync('git init', { cwd: cleanRepo, encoding: 'utf-8' });
    execSync('git config user.email "test@test.com"', { cwd: cleanRepo });
    execSync('git config user.name "Test"', { cwd: cleanRepo });
    writeFileSync(join(cleanRepo, 'file.txt'), 'hello');
    execSync('git add . && git commit -m "init"', { cwd: cleanRepo, encoding: 'utf-8' });

    capturedStats = null;
    const { unmount } = render(
      React.createElement(HookCapture, { repoPath: cleanRepo })
    );

    await new Promise(r => setTimeout(r, 200));

    // With no uncommitted changes, git diff --shortstat returns empty
    // so the hook should set stats to all zeros
    expect(capturedStats).not.toBeNull();
    expect(capturedStats!.filesChanged).toBe(0);
    expect(capturedStats!.insertions).toBe(0);
    expect(capturedStats!.deletions).toBe(0);

    unmount();
  });
});
