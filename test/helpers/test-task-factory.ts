import type { Task } from '../../src/queue/types.js';

export type { Task };

export function createTestTask(overrides?: Partial<Task>): Task {
  return {
    id: 'test-task-1',
    type: 'user',
    prompt: 'Fix the bug',
    enqueuedAt: new Date().toISOString(),
    priority: 0,
    ...overrides,
  };
}
