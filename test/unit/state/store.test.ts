import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { StateStore } from '../../../src/state/store.js';
import { readFileSync, existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function tmpStatePath(): string {
  return join(tmpdir(), `devdemon-state-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

function createTask(overrides?: Partial<{ id: string; type: 'user' | 'autonomous'; prompt: string }>) {
  return {
    id: 'test-task-1',
    type: 'user' as const,
    prompt: 'Fix the bug',
    ...overrides,
  };
}

describe('StateStore', () => {
  let statePath: string;

  beforeEach(() => {
    statePath = tmpStatePath();
  });

  afterEach(() => {
    try {
      if (existsSync(statePath)) unlinkSync(statePath);
    } catch {
      // ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('loads existing state from file', () => {
      const existing = {
        version: 1,
        sessionId: 'existing-session',
        startedAt: '2026-01-01T00:00:00.000Z',
        currentRole: { name: 'SWE', file: '/tmp/swe.md' },
        currentTask: null,
        taskHistory: [],
        stats: {
          totalCycles: 5,
          totalCostUsd: 1.23,
          totalTasks: 5,
          userTasks: 3,
          autonomousTasks: 2,
          failedTasks: 0,
        },
      };
      writeFileSync(statePath, JSON.stringify(existing));

      const store = new StateStore(statePath, '/tmp/repo');
      const stats = store.getStats();
      expect(stats.totalCycles).toBe(5);
      expect(stats.totalCostUsd).toBe(1.23);
      expect(stats.totalTasks).toBe(5);
      expect(stats.userTasks).toBe(3);
      expect(stats.autonomousTasks).toBe(2);
    });

    it('creates default state when file is missing', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const stats = store.getStats();
      expect(stats.totalCycles).toBe(0);
      expect(stats.totalCostUsd).toBe(0);
      expect(stats.totalTasks).toBe(0);
      expect(stats.userTasks).toBe(0);
      expect(stats.autonomousTasks).toBe(0);
      expect(stats.failedTasks).toBe(0);
    });

    it('falls back to default state on corrupt file', () => {
      writeFileSync(statePath, 'not valid json {{{');
      const store = new StateStore(statePath, '/tmp/repo');
      const stats = store.getStats();
      expect(stats.totalCycles).toBe(0);
      expect(stats.totalTasks).toBe(0);
    });

    it('falls back to default state when version is missing', () => {
      writeFileSync(statePath, JSON.stringify({ foo: 'bar' }));
      const store = new StateStore(statePath, '/tmp/repo');
      const stats = store.getStats();
      expect(stats.totalCycles).toBe(0);
    });
  });

  describe('setCurrentTask', () => {
    it('sets the current task with running status', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const task = createTask();
      store.setCurrentTask(task);

      const data = JSON.parse(readFileSync(statePath, 'utf-8'));
      expect(data.currentTask).not.toBeNull();
      expect(data.currentTask.id).toBe('test-task-1');
      expect(data.currentTask.type).toBe('user');
      expect(data.currentTask.prompt).toBe('Fix the bug');
      expect(data.currentTask.status).toBe('running');
    });

    it('sets startedAt timestamp', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const before = new Date().toISOString();
      store.setCurrentTask(createTask());
      const after = new Date().toISOString();

      const data = JSON.parse(readFileSync(statePath, 'utf-8'));
      expect(data.currentTask.startedAt >= before).toBe(true);
      expect(data.currentTask.startedAt <= after).toBe(true);
    });

    it('saves to file after setting task', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      store.setCurrentTask(createTask());
      expect(existsSync(statePath)).toBe(true);
    });
  });

  describe('recordCompletion', () => {
    it('adds entry to task history', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const task = createTask();
      store.setCurrentTask(task);
      store.recordCompletion(task, {
        result: 'Bug fixed',
        costUsd: 0.05,
        numTurns: 3,
        durationMs: 5000,
        success: true,
      });

      const data = JSON.parse(readFileSync(statePath, 'utf-8'));
      expect(data.taskHistory).toHaveLength(1);
      expect(data.taskHistory[0].id).toBe('test-task-1');
      expect(data.taskHistory[0].result).toBe('Bug fixed');
      expect(data.taskHistory[0].status).toBe('completed');
    });

    it('clears current task', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const task = createTask();
      store.setCurrentTask(task);
      store.recordCompletion(task, {
        result: 'Done',
        costUsd: 0.01,
        numTurns: 1,
        durationMs: 1000,
        success: true,
      });

      const data = JSON.parse(readFileSync(statePath, 'utf-8'));
      expect(data.currentTask).toBeNull();
    });

    it('updates stats correctly for user task', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const task = createTask({ type: 'user' });
      store.setCurrentTask(task);
      store.recordCompletion(task, {
        result: 'Done',
        costUsd: 0.05,
        numTurns: 3,
        durationMs: 5000,
        success: true,
      });

      const stats = store.getStats();
      expect(stats.totalCycles).toBe(1);
      expect(stats.totalCostUsd).toBe(0.05);
      expect(stats.totalTasks).toBe(1);
      expect(stats.userTasks).toBe(1);
      expect(stats.autonomousTasks).toBe(0);
    });

    it('updates stats correctly for autonomous task', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const task = createTask({ id: 'auto-1', type: 'autonomous', prompt: 'Scan' });
      store.setCurrentTask(task);
      store.recordCompletion(task, {
        result: 'Scanned',
        costUsd: 0.10,
        numTurns: 5,
        durationMs: 10000,
        success: true,
      });

      const stats = store.getStats();
      expect(stats.totalCycles).toBe(1);
      expect(stats.totalCostUsd).toBe(0.10);
      expect(stats.totalTasks).toBe(1);
      expect(stats.userTasks).toBe(0);
      expect(stats.autonomousTasks).toBe(1);
    });

    it('sets completedAt timestamp', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const task = createTask();
      store.setCurrentTask(task);
      const before = new Date().toISOString();
      store.recordCompletion(task, {
        result: 'Done',
        costUsd: 0.01,
        numTurns: 1,
        durationMs: 100,
        success: true,
      });
      const after = new Date().toISOString();

      const data = JSON.parse(readFileSync(statePath, 'utf-8'));
      expect(data.taskHistory[0].completedAt >= before).toBe(true);
      expect(data.taskHistory[0].completedAt <= after).toBe(true);
    });

    it('preserves startedAt from currentTask', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const task = createTask();
      store.setCurrentTask(task);

      const data1 = JSON.parse(readFileSync(statePath, 'utf-8'));
      const startedAt = data1.currentTask.startedAt;

      store.recordCompletion(task, {
        result: 'Done',
        costUsd: 0.01,
        numTurns: 1,
        durationMs: 100,
        success: true,
      });

      const data2 = JSON.parse(readFileSync(statePath, 'utf-8'));
      expect(data2.taskHistory[0].startedAt).toBe(startedAt);
    });
  });

  describe('recordFailure', () => {
    it('adds failed entry to history', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const task = createTask();
      store.setCurrentTask(task);
      store.recordFailure(task, new Error('Something broke'));

      const data = JSON.parse(readFileSync(statePath, 'utf-8'));
      expect(data.taskHistory).toHaveLength(1);
      expect(data.taskHistory[0].status).toBe('failed');
      expect(data.taskHistory[0].result).toBe('Something broke');
    });

    it('increments failedTasks in stats', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const task = createTask();
      store.setCurrentTask(task);
      store.recordFailure(task, new Error('fail'));

      const stats = store.getStats();
      expect(stats.failedTasks).toBe(1);
    });

    it('clears current task', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const task = createTask();
      store.setCurrentTask(task);
      store.recordFailure(task, new Error('fail'));

      const data = JSON.parse(readFileSync(statePath, 'utf-8'));
      expect(data.currentTask).toBeNull();
    });

    it('handles non-Error values', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const task = createTask();
      store.setCurrentTask(task);
      store.recordFailure(task, 'string error');

      const data = JSON.parse(readFileSync(statePath, 'utf-8'));
      expect(data.taskHistory[0].result).toBe('string error');
    });

    it('increments totalTasks and totalCycles for failed tasks', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const task = createTask();
      store.setCurrentTask(task);
      store.recordFailure(task, new Error('fail'));

      const stats = store.getStats();
      expect(stats.totalTasks).toBe(1);
      expect(stats.totalCycles).toBe(1);
    });
  });

  describe('getRecentHistory', () => {
    it('returns last N items', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      for (let i = 0; i < 5; i++) {
        const task = createTask({ id: `task-${i}`, prompt: `Task ${i}` });
        store.setCurrentTask(task);
        store.recordCompletion(task, {
          result: `Done ${i}`,
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          success: true,
        });
      }

      const recent = store.getRecentHistory(3);
      expect(recent).toHaveLength(3);
      expect(recent[0].id).toBe('task-2');
      expect(recent[1].id).toBe('task-3');
      expect(recent[2].id).toBe('task-4');
    });

    it('returns all if fewer than requested', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      const task = createTask();
      store.setCurrentTask(task);
      store.recordCompletion(task, {
        result: 'Done',
        costUsd: 0.01,
        numTurns: 1,
        durationMs: 100,
        success: true,
      });

      const recent = store.getRecentHistory(10);
      expect(recent).toHaveLength(1);
    });

    it('returns empty array when no history', () => {
      const store = new StateStore(statePath, '/tmp/repo');
      expect(store.getRecentHistory(5)).toEqual([]);
    });
  });

  describe('getRepoPath', () => {
    it('returns the repo path passed to constructor', () => {
      const store = new StateStore(statePath, '/my/repo');
      expect(store.getRepoPath()).toBe('/my/repo');
    });
  });

  describe('save/load round-trip', () => {
    it('persists and reloads state', () => {
      const store1 = new StateStore(statePath, '/tmp/repo');
      const task = createTask();
      store1.setCurrentTask(task);
      store1.recordCompletion(task, {
        result: 'Round-trip',
        costUsd: 0.07,
        numTurns: 4,
        durationMs: 3000,
        success: true,
      });

      // Create a new store from the same file
      const store2 = new StateStore(statePath, '/tmp/repo');
      const stats = store2.getStats();
      expect(stats.totalCycles).toBe(1);
      expect(stats.totalCostUsd).toBe(0.07);
      expect(stats.totalTasks).toBe(1);

      const history = store2.getRecentHistory(10);
      expect(history).toHaveLength(1);
      expect(history[0].result).toBe('Round-trip');
    });

    it('preserves session ID across reloads', () => {
      const store1 = new StateStore(statePath, '/tmp/repo');
      store1.save();

      const data = JSON.parse(readFileSync(statePath, 'utf-8'));
      const sessionId = data.sessionId;
      expect(sessionId.length).toBeGreaterThan(0);

      const store2 = new StateStore(statePath, '/tmp/repo');
      const data2 = JSON.parse(readFileSync(statePath, 'utf-8'));
      expect(data2.sessionId).toBe(sessionId);
    });
  });
});
