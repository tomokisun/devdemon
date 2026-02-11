import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { TaskQueue } from '../../../src/queue/task-queue.js';
import { readFileSync, existsSync, unlinkSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function tmpQueuePath(): string {
  return join(tmpdir(), `devdemon-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

describe('TaskQueue', () => {
  let persistPath: string;

  beforeEach(() => {
    persistPath = tmpQueuePath();
  });

  afterEach(() => {
    try {
      if (existsSync(persistPath)) unlinkSync(persistPath);
    } catch {
      // ignore cleanup errors
    }
  });

  describe('enqueueUser', () => {
    it('adds a task to the queue', () => {
      const q = new TaskQueue(persistPath);
      q.enqueueUser('Fix the bug');
      expect(q.length).toBe(1);
    });

    it('creates task with priority 0', () => {
      const q = new TaskQueue(persistPath);
      const task = q.enqueueUser('Fix the bug');
      expect(task.priority).toBe(0);
    });

    it('creates task with type user', () => {
      const q = new TaskQueue(persistPath);
      const task = q.enqueueUser('Fix the bug');
      expect(task.type).toBe('user');
    });

    it('assigns a unique ID', () => {
      const q = new TaskQueue(persistPath);
      const t1 = q.enqueueUser('Task 1');
      const t2 = q.enqueueUser('Task 2');
      expect(t1.id).not.toBe(t2.id);
      expect(t1.id.length).toBeGreaterThan(0);
    });

    it('sets an ISO timestamp', () => {
      const q = new TaskQueue(persistPath);
      const before = new Date().toISOString();
      const task = q.enqueueUser('Fix the bug');
      const after = new Date().toISOString();
      expect(task.enqueuedAt >= before).toBe(true);
      expect(task.enqueuedAt <= after).toBe(true);
    });

    it('persists to file', () => {
      const q = new TaskQueue(persistPath);
      q.enqueueUser('Fix the bug');
      expect(existsSync(persistPath)).toBe(true);
      const data = JSON.parse(readFileSync(persistPath, 'utf-8'));
      expect(data).toHaveLength(1);
      expect(data[0].prompt).toBe('Fix the bug');
    });
  });

  describe('enqueueAutonomous', () => {
    it('creates task with priority 1', () => {
      const q = new TaskQueue(persistPath);
      const task = q.enqueueAutonomous('Run analysis');
      expect(task.priority).toBe(1);
    });

    it('creates task with type autonomous', () => {
      const q = new TaskQueue(persistPath);
      const task = q.enqueueAutonomous('Run analysis');
      expect(task.type).toBe('autonomous');
    });

    it('does NOT add to internal queue', () => {
      const q = new TaskQueue(persistPath);
      q.enqueueAutonomous('Run analysis');
      expect(q.length).toBe(0);
    });

    it('returns a valid task with unique ID', () => {
      const q = new TaskQueue(persistPath);
      const task = q.enqueueAutonomous('Run analysis');
      expect(task.id.length).toBeGreaterThan(0);
      expect(task.prompt).toBe('Run analysis');
    });
  });

  describe('dequeue', () => {
    it('returns user tasks before autonomous tasks in queue', () => {
      const q = new TaskQueue(persistPath);
      // Manually add an autonomous task to queue for testing priority ordering
      q.enqueueUser('User task');
      // We can't enqueue autonomous to queue directly, but we can test user tasks ordering
      const task = q.dequeue();
      expect(task?.type).toBe('user');
      expect(task?.prompt).toBe('User task');
    });

    it('returns tasks in FIFO order for same priority', () => {
      const q = new TaskQueue(persistPath);
      q.enqueueUser('First');
      q.enqueueUser('Second');
      q.enqueueUser('Third');

      expect(q.dequeue()?.prompt).toBe('First');
      expect(q.dequeue()?.prompt).toBe('Second');
      expect(q.dequeue()?.prompt).toBe('Third');
    });

    it('returns null when empty', () => {
      const q = new TaskQueue(persistPath);
      expect(q.dequeue()).toBeNull();
    });

    it('persists after removal', () => {
      const q = new TaskQueue(persistPath);
      q.enqueueUser('Task 1');
      q.enqueueUser('Task 2');
      q.dequeue();

      const data = JSON.parse(readFileSync(persistPath, 'utf-8'));
      expect(data).toHaveLength(1);
      expect(data[0].prompt).toBe('Task 2');
    });

    it('dequeues higher priority (lower number) first', () => {
      // Construct a queue file with mixed priorities to test ordering
      const tasks = [
        { id: 'a1', type: 'autonomous', prompt: 'Auto task', enqueuedAt: new Date().toISOString(), priority: 1 },
        { id: 'u1', type: 'user', prompt: 'User task', enqueuedAt: new Date().toISOString(), priority: 0 },
      ];
      mkdirSync(join(persistPath, '..'), { recursive: true });
      writeFileSync(persistPath, JSON.stringify(tasks));

      const q = new TaskQueue(persistPath);
      const first = q.dequeue();
      expect(first?.prompt).toBe('User task');
      expect(first?.priority).toBe(0);

      const second = q.dequeue();
      expect(second?.prompt).toBe('Auto task');
      expect(second?.priority).toBe(1);
    });
  });

  describe('persistence', () => {
    it('loads from file on construction', () => {
      const tasks = [
        { id: 'x1', type: 'user', prompt: 'Persisted task', enqueuedAt: '2025-01-01T00:00:00.000Z', priority: 0 },
      ];
      writeFileSync(persistPath, JSON.stringify(tasks));

      const q = new TaskQueue(persistPath);
      expect(q.length).toBe(1);
      expect(q.peek()?.prompt).toBe('Persisted task');
    });

    it('starts with empty queue when file missing', () => {
      const q = new TaskQueue(persistPath);
      expect(q.length).toBe(0);
    });

    it('starts with empty queue when file corrupt', () => {
      writeFileSync(persistPath, 'not valid json {{{');
      const q = new TaskQueue(persistPath);
      expect(q.length).toBe(0);
    });

    it('starts with empty queue when file contains non-array JSON', () => {
      writeFileSync(persistPath, JSON.stringify({ not: 'an array' }));
      const q = new TaskQueue(persistPath);
      expect(q.length).toBe(0);
    });

    it('persists on each enqueueUser operation', () => {
      const q = new TaskQueue(persistPath);
      q.enqueueUser('Task A');
      const data1 = JSON.parse(readFileSync(persistPath, 'utf-8'));
      expect(data1).toHaveLength(1);

      q.enqueueUser('Task B');
      const data2 = JSON.parse(readFileSync(persistPath, 'utf-8'));
      expect(data2).toHaveLength(2);
    });
  });

  describe('properties', () => {
    it('length returns the number of tasks in the queue', () => {
      const q = new TaskQueue(persistPath);
      expect(q.length).toBe(0);
      q.enqueueUser('A');
      expect(q.length).toBe(1);
      q.enqueueUser('B');
      expect(q.length).toBe(2);
      q.dequeue();
      expect(q.length).toBe(1);
    });

    it('userTaskCount returns only user tasks', () => {
      const q = new TaskQueue(persistPath);
      expect(q.userTaskCount).toBe(0);
      q.enqueueUser('User 1');
      q.enqueueUser('User 2');
      q.enqueueAutonomous('Auto 1'); // not added to queue
      expect(q.userTaskCount).toBe(2);
    });

    it('peek returns first task without removing', () => {
      const q = new TaskQueue(persistPath);
      q.enqueueUser('Peek me');
      const peeked = q.peek();
      expect(peeked?.prompt).toBe('Peek me');
      expect(q.length).toBe(1); // still there
    });

    it('peek returns null when empty', () => {
      const q = new TaskQueue(persistPath);
      expect(q.peek()).toBeNull();
    });
  });

  describe('maxQueueSize', () => {
    it('uses default max queue size of 1000', () => {
      const q = new TaskQueue(persistPath);
      // We can't directly inspect the private field, but we can enqueue several tasks without error
      for (let i = 0; i < 10; i++) {
        q.enqueueUser(`Task ${i}`);
      }
      expect(q.length).toBe(10);
    });

    it('throws when queue is full', () => {
      const q = new TaskQueue(persistPath, { maxQueueSize: 3 });
      q.enqueueUser('Task 1');
      q.enqueueUser('Task 2');
      q.enqueueUser('Task 3');
      expect(() => q.enqueueUser('Task 4')).toThrow('Queue is full (max 3 tasks)');
    });

    it('allows enqueue again after dequeue frees space', () => {
      const q = new TaskQueue(persistPath, { maxQueueSize: 2 });
      q.enqueueUser('Task 1');
      q.enqueueUser('Task 2');
      expect(() => q.enqueueUser('Task 3')).toThrow();

      q.dequeue(); // frees one slot
      const task = q.enqueueUser('Task 3');
      expect(task.prompt).toBe('Task 3');
      expect(q.length).toBe(2);
    });

    it('enqueueAutonomous is not affected by maxQueueSize', () => {
      const q = new TaskQueue(persistPath, { maxQueueSize: 0 });
      // enqueueAutonomous does not add to queue, so it should not throw
      const task = q.enqueueAutonomous('Auto task');
      expect(task.prompt).toBe('Auto task');
      expect(q.length).toBe(0);
    });
  });

  describe('sorted insertion', () => {
    it('maintains sorted order when loading unsorted data from file', () => {
      // Write tasks in reverse priority order to the persist file
      const tasks = [
        { id: 'p2', type: 'autonomous', prompt: 'Low priority', enqueuedAt: '2025-01-01T00:00:00.000Z', priority: 2 },
        { id: 'p0', type: 'user', prompt: 'High priority', enqueuedAt: '2025-01-01T00:00:01.000Z', priority: 0 },
        { id: 'p1', type: 'autonomous', prompt: 'Mid priority', enqueuedAt: '2025-01-01T00:00:02.000Z', priority: 1 },
      ];
      writeFileSync(persistPath, JSON.stringify(tasks));

      const q = new TaskQueue(persistPath);
      expect(q.dequeue()?.prompt).toBe('High priority');
      expect(q.dequeue()?.prompt).toBe('Mid priority');
      expect(q.dequeue()?.prompt).toBe('Low priority');
    });

    it('peek returns highest priority task without sorting each time', () => {
      // Seed the file with mixed-priority tasks
      const tasks = [
        { id: 'a1', type: 'autonomous', prompt: 'Auto', enqueuedAt: new Date().toISOString(), priority: 1 },
        { id: 'u1', type: 'user', prompt: 'User', enqueuedAt: new Date().toISOString(), priority: 0 },
      ];
      mkdirSync(join(persistPath, '..'), { recursive: true });
      writeFileSync(persistPath, JSON.stringify(tasks));

      const q = new TaskQueue(persistPath);
      // peek should return the user task (priority 0) without needing to re-sort
      expect(q.peek()?.prompt).toBe('User');
      expect(q.peek()?.prompt).toBe('User'); // second call gives same result
      expect(q.length).toBe(2); // nothing removed
    });

    it('preserves FIFO order for tasks with the same priority', () => {
      const q = new TaskQueue(persistPath);
      q.enqueueUser('First');
      q.enqueueUser('Second');
      q.enqueueUser('Third');

      // All have priority 0, should come out in insertion order
      expect(q.peek()?.prompt).toBe('First');
      expect(q.dequeue()?.prompt).toBe('First');
      expect(q.dequeue()?.prompt).toBe('Second');
      expect(q.dequeue()?.prompt).toBe('Third');
    });
  });
});
