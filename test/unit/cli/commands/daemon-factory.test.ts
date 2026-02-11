import { describe, test, expect, mock, spyOn } from 'bun:test';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadPreviousStats, createDryRunDaemon } from '../../../../src/cli/commands/daemon-factory.js';
import type { RoleConfig } from '../../../../src/roles/types.js';

function makeRole(name: string): RoleConfig {
  return {
    frontmatter: {
      name,
      interval: 60,
      maxTurns: 5,
      permissionMode: 'acceptEdits',
    },
    body: `# ${name}`,
    filePath: `/roles/${name}.md`,
  };
}

describe('loadPreviousStats', () => {
  test('有効なstatsデータを読み込む', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'devdemon-test-'));
    const statePath = join(tmpDir, 'state.json');
    const stats = {
      totalCycles: 10,
      totalCostUsd: 1.5,
      totalTasks: 8,
      userTasks: 3,
      autonomousTasks: 5,
      failedTasks: 0,
    };
    writeFileSync(statePath, JSON.stringify({ version: 1, stats }));

    const result = loadPreviousStats(statePath);
    expect(result).not.toBeNull();
    expect(result!.totalCycles).toBe(10);
    expect(result!.totalCostUsd).toBe(1.5);
    expect(result!.totalTasks).toBe(8);
  });

  test('version不一致の場合はnullを返す', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'devdemon-test-'));
    const statePath = join(tmpDir, 'state.json');
    writeFileSync(statePath, JSON.stringify({ version: 2, stats: {} }));

    const result = loadPreviousStats(statePath);
    expect(result).toBeNull();
  });

  test('statsフィールドがない場合はnullを返す', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'devdemon-test-'));
    const statePath = join(tmpDir, 'state.json');
    writeFileSync(statePath, JSON.stringify({ version: 1 }));

    const result = loadPreviousStats(statePath);
    expect(result).toBeNull();
  });

  test('ファイルが存在しない場合はnullを返す', () => {
    const result = loadPreviousStats('/nonexistent/path/state.json');
    expect(result).toBeNull();
  });

  test('不正なJSONの場合はnullを返す', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'devdemon-test-'));
    const statePath = join(tmpDir, 'state.json');
    writeFileSync(statePath, 'not valid json');

    const result = loadPreviousStats(statePath);
    expect(result).toBeNull();
  });
});

describe('createDryRunDaemon', () => {
  test('正しいプロパティを持つdaemonオブジェクトを生成する', () => {
    const role = makeRole('test-role');
    const daemon = createDryRunDaemon(role, '/tmp/repo');

    expect(daemon.role).toBe(role);
    expect(daemon.repoPath).toBe('/tmp/repo');
    expect(daemon.queue.length).toBe(0);
    expect(daemon.isRunning()).toBe(false);
  });

  test('getStatsがゼロ初期値のstatsを返す', () => {
    const role = makeRole('test-role');
    const daemon = createDryRunDaemon(role, '/tmp/repo');

    const stats = daemon.state.getStats();
    expect(stats.totalCycles).toBe(0);
    expect(stats.totalCostUsd).toBe(0);
    expect(stats.totalTasks).toBe(0);
    expect(stats.userTasks).toBe(0);
    expect(stats.autonomousTasks).toBe(0);
    expect(stats.failedTasks).toBe(0);
  });

  test('saveが呼び出し可能で何もしない', () => {
    const role = makeRole('test-role');
    const daemon = createDryRunDaemon(role, '/tmp/repo');

    expect(() => daemon.state.save()).not.toThrow();
  });

  test('enqueueUserTaskがqueue.lengthをインクリメントする', () => {
    const role = makeRole('test-role');
    const daemon = createDryRunDaemon(role, '/tmp/repo');

    expect(daemon.queue.length).toBe(0);
    daemon.enqueueUserTask('test task');
    expect(daemon.queue.length).toBe(1);
    daemon.enqueueUserTask('another task');
    expect(daemon.queue.length).toBe(2);
  });

  test('stopが非同期で完了する', async () => {
    const role = makeRole('test-role');
    const daemon = createDryRunDaemon(role, '/tmp/repo');

    await expect(daemon.stop()).resolves.toBeUndefined();
  });

  test('startが非同期で完了する', async () => {
    const role = makeRole('test-role');
    const daemon = createDryRunDaemon(role, '/tmp/repo');

    await expect(daemon.start()).resolves.toBeUndefined();
  });

  test('EventEmitter機能を持つ', () => {
    const role = makeRole('test-role');
    const daemon = createDryRunDaemon(role, '/tmp/repo');

    const handler = mock(() => {});
    daemon.on('test-event', handler);
    daemon.emit('test-event', 'data');
    expect(handler).toHaveBeenCalledWith('data');
  });

  test('agentがEventEmitterである', () => {
    const role = makeRole('test-role');
    const daemon = createDryRunDaemon(role, '/tmp/repo');

    const handler = mock(() => {});
    daemon.agent.on('test', handler);
    daemon.agent.emit('test');
    expect(handler).toHaveBeenCalled();
  });
});
